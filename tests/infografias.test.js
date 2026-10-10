import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { ejecutar, leerArgs } from '../tools/infografias/generar.mjs';

const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64').toString('base64');

let server, base, peticiones, estado;

function arrancar() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const cuerpo = Buffer.concat(chunks);
        peticiones.push({ m: req.method, url: req.url, h: req.headers, cuerpo });
        const j = (obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
        if (req.url.startsWith('/rest/v1/libros?select') && req.method === 'GET') {
          if (estado.sinColumnas && req.url.includes('infografia_url')) return j({ message: 'column does not exist' }, 400);
          return j(estado.libros);
        }
        if (req.url.startsWith('/rest/v1/lecciones')) {
          return j([{ id: 'l1', titulo: 'Resultados y decisiones', orden: 1, idea_clave: 'x' }, { id: 'l2', titulo: 'Apuestas y creencias', orden: 2 }, { id: 'l3', titulo: 'Equipos de decisión', orden: 3 }]);
        }
        if (req.url.startsWith('/auth/v1/token')) return j(estado.loginMal ? {} : { access_token: 'JWT_ADMIN' });
        if (req.url.startsWith('/images/generations')) {
          if (estado.limite429 > 0) { estado.limite429--; return j({ error: 'rate' }, 429); }
          return j({ data: [{ b64_json: PIXEL }] });
        }
        if (req.url.startsWith('/storage/v1/object/infografias/')) { res.writeHead(200); return res.end('{}'); }
        if (req.url.startsWith('/rest/v1/libros?id=eq.') && req.method === 'PATCH') { res.writeHead(204); return res.end(); }
        res.writeHead(404); res.end('no');
      });
    });
    server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
}

const LIBROS = [
  { id: 'b1', titulo: 'Thinking in Bets', autor: 'Annie Duke', descripcion_breve: 'Decidir con incertidumbre.', infografia_url: null, infografia_estado: null },
  { id: 'b2', titulo: 'Ya hecho', autor: 'X', descripcion_breve: '', infografia_url: 'http://x/y.webp', infografia_estado: 'aprobada' },
  { id: 'b3', titulo: 'Rechazado', autor: 'Y', descripcion_breve: '', infografia_url: 'http://x/z.webp', infografia_estado: 'rechazada' }
];

const env = () => ({ SUPABASE_URL: base, SUPABASE_ANON_KEY: 'ANON', OPENAI_BASE_URL: base, OPENAI_API_KEY: 'sk-test', ADMIN_EMAIL: 'a@b.c', ADMIN_PASSWORD: 'pw' });
const deps = () => ({ log: () => {}, pausa: 1 });

beforeEach(async () => { peticiones = []; estado = { libros: LIBROS, sinColumnas: false, loginMal: false, limite429: 0 }; await arrancar(); });
afterEach(() => new Promise(r => server.close(r)));

describe('leerArgs', () => {
  it('lee las opciones', () => {
    expect(leerArgs(['--ejecutar', '--limite', '5', '--calidad', 'high', '--libro', 'x'])).toMatchObject({ ejecutar: true, limite: 5, calidad: 'high', libro: 'x' });
  });
  it('por defecto simula con límite 3', () => {
    expect(leerArgs([])).toMatchObject({ ejecutar: false, limite: 3 });
  });
  it('rechaza opciones desconocidas', () => {
    expect(() => leerArgs(['--loquesea'])).toThrow();
  });
});

describe('simulación (por defecto)', () => {
  it('no llama a la API de imágenes ni escribe nada, y elige libros sin infografía o rechazados', async () => {
    const r = await ejecutar(leerArgs([]), env(), deps());
    expect(r.simulacion).toBe(true);
    expect(r.trabajos.map(t => t.libro.id)).toEqual(['b1', 'b3']);
    expect(peticiones.some(p => p.url.startsWith('/images') || p.url.startsWith('/auth') || p.url.startsWith('/storage') || p.m === 'PATCH')).toBe(false);
  });
  it('funciona antes de aplicar la migración (sin columnas infografia_*)', async () => {
    estado.sinColumnas = true;
    const r = await ejecutar(leerArgs([]), env(), deps());
    expect(r.simulacion).toBe(true);
    expect(r.trabajos.length).toBeGreaterThan(0);
  });
  it('respeta --solo-rechazadas y --libro', async () => {
    expect((await ejecutar(leerArgs(['--solo-rechazadas']), env(), deps())).trabajos.map(t => t.libro.id)).toEqual(['b3']);
    expect((await ejecutar(leerArgs(['--libro', 'b2']), env(), deps())).trabajos.map(t => t.libro.id)).toEqual(['b2']);
  });
});

describe('ejecución', () => {
  it('genera, sube a Storage con la sesión de administrador y deja la infografía pendiente', async () => {
    const r = await ejecutar(leerArgs(['--ejecutar', '--limite', '1']), env(), deps());
    expect(r.hechos).toEqual(['b1']);
    const img = peticiones.find(p => p.url.startsWith('/images/generations'));
    const cuerpoImg = JSON.parse(img.cuerpo.toString());
    expect(img.h.authorization).toBe('Bearer sk-test');
    expect(cuerpoImg).toMatchObject({ model: 'gpt-image-1.5', size: '1024x1536', quality: 'medium', output_format: 'webp', n: 1 });
    expect(cuerpoImg.prompt).toContain('Thinking in Bets');
    const sub = peticiones.find(p => p.url.startsWith('/storage/v1/object/infografias/libros/b1.webp'));
    expect(sub.h.authorization).toBe('Bearer JWT_ADMIN');
    expect(sub.h['content-type']).toBe('image/webp');
    expect(sub.h['x-upsert']).toBe('true');
    expect(sub.cuerpo.length).toBeGreaterThan(10);
    const patch = peticiones.find(p => p.m === 'PATCH');
    expect(patch.h.authorization).toBe('Bearer JWT_ADMIN');
    const cuerpoPatch = JSON.parse(patch.cuerpo.toString());
    expect(cuerpoPatch).toMatchObject({ infografia_estado: 'pendiente', infografia_modelo: 'gpt-image-1.5:medium' });
    expect(cuerpoPatch.infografia_url).toContain('/storage/v1/object/public/infografias/libros/b1.webp');
  });
  it('nunca envía la clave de OpenAI a Supabase ni la de Supabase a OpenAI', async () => {
    await ejecutar(leerArgs(['--ejecutar', '--limite', '1']), env(), deps());
    peticiones.filter(p => !p.url.startsWith('/images')).forEach(p => expect(p.h.authorization || '').not.toContain('sk-test'));
    peticiones.filter(p => p.url.startsWith('/images')).forEach(p => expect(p.h.authorization).not.toContain('JWT_ADMIN'));
  });
  it('reintenta ante 429 y termina bien', async () => {
    estado.limite429 = 2;
    const r = await ejecutar(leerArgs(['--ejecutar', '--limite', '1']), env(), deps());
    expect(r.hechos).toEqual(['b1']);
    expect(peticiones.filter(p => p.url.startsWith('/images')).length).toBe(3);
  });
  it('si la API falla siempre, lo registra como fallo y no sube ni modifica nada', async () => {
    estado.limite429 = 99;
    const r = await ejecutar(leerArgs(['--ejecutar', '--limite', '1']), env(), deps());
    expect(r.hechos).toEqual([]);
    expect(r.fallos).toHaveLength(1);
    expect(peticiones.some(p => p.url.startsWith('/storage') || p.m === 'PATCH')).toBe(false);
  });
  it('exige las claves', async () => {
    const e = env(); delete e.OPENAI_API_KEY;
    await expect(ejecutar(leerArgs(['--ejecutar']), e, deps())).rejects.toThrow(/OPENAI_API_KEY/);
    const e2 = env(); delete e2.ADMIN_PASSWORD;
    await expect(ejecutar(leerArgs(['--ejecutar']), e2, deps())).rejects.toThrow(/ADMIN_EMAIL/);
  });
  it('falla con mensaje claro si el login de administrador no devuelve sesión', async () => {
    estado.loginMal = true;
    await expect(ejecutar(leerArgs(['--ejecutar']), env(), deps())).rejects.toThrow(/iniciar sesión/);
  });
  it('se niega si el coste estimado supera el tope', async () => {
    await expect(ejecutar(leerArgs(['--ejecutar', '--limite', '10', '--calidad', 'high', '--max-coste', '0.1']), env(), deps())).rejects.toThrow(/supera el tope/);
    expect(peticiones.some(p => p.url.startsWith('/images'))).toBe(false);
  });
  it('si falta la migración, no genera y lo explica', async () => {
    estado.sinColumnas = true;
    await expect(ejecutar(leerArgs(['--ejecutar']), env(), deps())).rejects.toThrow(/20261012_infografias/);
    expect(peticiones.some(p => p.url.startsWith('/images'))).toBe(false);
  });
});
