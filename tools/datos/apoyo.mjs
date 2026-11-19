#!/usr/bin/env node
/**
 * Comprueba que una figura NO dice más que su lección: cifras, nombres propios y palabras con significado
 * de la figura que no aparecen en el texto de la lección. Es un filtro mecánico (no sustituye a una lectura):
 * atrapa lo inventado, no lo mal entendido.
 *
 *   node tools/datos/apoyo.mjs lote.json lecciones.json [--json] [--solo-errores]
 *     lote.json       {idLección: [figura, …]}   (el mismo formato que agregar.mjs)
 *     lecciones.json  lista de lecciones con id, titulo, cuerpo, idea_clave, cita_memorable, autocorreccion,
 *                     aplicacion_practica, conexion_cruzada (y, si hay, libro y autor)
 *
 * ERROR  = cifra (2+ dígitos) o nombre propio que no está en la lección. Código de salida 1.
 * AVISO  = frase de la figura con pocas palabras que la lección use (puede ser una paráfrasis legítima: revisar).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/đ/g, 'd');

// Palabras que una figura usa para hablar de sí misma o de la lección, no de su contenido.
const META = new Set(('leccion lecciones figura esquema segun autor autora autores libro texto tesis ilustrativa ilustrativo '
  + 'aproximada aproximado interpretacion lectura sintesis propia propio nuestra nuestro discutida discutido discutidas '
  + 'idea ideas centro paso pasos').split(' '));
const STOP = new Set(('sobre entre desde hasta cuando donde porque tambien aunque cada solo mismo misma otros otras ellos ellas '
  + 'tiene tienen puede pueden hace hacen debe deben mucho muchos mucha muchas mayor menor mejor peor siempre nunca '
  + 'antes despues durante mientras ademas pero sino como para esto esta estos estas aquello aquella cual cuales '
  + 'algo alguien nadie nada todo toda todos todas otro otra ser estar haber hacer tener poder deber cosa cosas '
  + 'lugar parte partes manera forma formas modo tipo tipos caso casos vez veces').split(' '));

export function texto(l) {
  return norm([l.titulo, l.idea_clave, l.cita_memorable, l.cuerpo, l.autocorreccion, l.aplicacion_practica, l.conexion_cruzada, l.libro, l.autor]
    .filter(Boolean).join(' \n '));
}

function cadenas(v, ruta, out) {
  if (typeof v === 'string') out.push([ruta, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => cadenas(x, `${ruta}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['tono', 'tonoA', 'tonoB', 'icono', 'lado', 'plantilla', 'tipo'].includes(k)) cadenas(x, ruta ? `${ruta}.${k}` : k, out);
  return out;
}

const palabras = s => norm(s).split(/[^a-z0-9ñ]+/).filter(Boolean);
const stem = w => (w.length > 5 ? w.slice(0, 5) : w);
const tieneStem = (set, w) => set.has(w) || (w.length >= 5 && set.has(stem(w)));
const soloDigitos = s => s.replace(/[^\d]/g, '');

/** Errores y avisos de una figura frente al texto de su lección. */
export function revisar(spec, leccion) {
  const t = texto(leccion);
  const vocab = new Set(), stems = new Set();
  for (const w of palabras(t)) { vocab.add(w); if (w.length >= 5) stems.add(stem(w)); }
  const numeros = new Set((t.match(/\d[\d.,]*\d|\d/g) || []).map(soloDigitos));
  const errores = [], avisos = [];
  const textos = [['titulo', spec.titulo], ['pie', spec.pie], ...cadenas(spec.datos, 'datos', [])].filter(([, s]) => typeof s === 'string' && s.trim());
  for (const [donde, s] of textos) {
    // 1 · cifras con 2+ dígitos que la lección no tiene (las de 1 dígito suelen ser «paso 1», «dos»…)
    for (const n of s.match(/\d[\d.,]*\d/g) || []) {
      const d = soloDigitos(n);
      if (!numeros.has(d) && !t.includes(norm(n))) errores.push(`${donde}: la cifra «${n}» no está en la lección`);
    }
    // 2 · nombres propios (mayúscula que no abre la cadena ni sigue a signo de apertura/puntuación final)
    const ws = s.split(/(\s+)/);
    let abre = true;
    for (let i = 0; i < ws.length; i += 2) {
      const w = ws[i].replace(/^[«"“'(¿¡]+|[»"”'),.;:!?…]+$/g, '');
      const previo = i > 0 ? ws[i - 2] : '';
      const inicio = abre || /[.!?:…]["»”')]*$/.test(previo);
      abre = false;
      if (!w || inicio || !/^[A-ZÁÉÍÓÚÑ][a-záéíóúüñ'’-]{2,}/.test(w)) continue;
      const partes = norm(w.replace(/['’]s$/, '')).split(/[-'’]/).filter(p => p.length >= 3);   // «Free-Range»: cada parte debe estar
      if (partes.some(p => !tieneStem(vocab, p) && !tieneStem(stems, p))) errores.push(`${donde}: el nombre «${w}» no aparece en la lección`);
    }
    // 3 · apoyo léxico de las palabras con significado
    const cont = palabras(s).filter(w => w.length >= 5 && !META.has(w) && !STOP.has(w) && !/^\d/.test(w));
    if (cont.length >= 3) {
      const sin = cont.filter(w => !tieneStem(vocab, w) && !tieneStem(stems, w));
      if (sin.length / cont.length > 0.5) avisos.push(`${donde}: poco apoyo en la lección (${sin.join(', ')}): «${s}»`);
    }
  }
  return { errores, avisos };
}

export function revisarLote(lote, lecciones) {
  const por = new Map(lecciones.map(l => [l.id, l]));
  const out = {};
  for (const [id, valor] of Object.entries(lote)) {
    const l = por.get(id);
    if (!l) { out[id] = { errores: ['la lección no está en el fichero de lecciones'], avisos: [] }; continue; }
    const specs = Array.isArray(valor) ? valor : [valor];
    const r = { errores: [], avisos: [] };
    specs.forEach((s, i) => { const x = revisar(s, l); x.errores.forEach(e => r.errores.push(`figura ${i + 1}, ${e}`)); x.avisos.forEach(e => r.avisos.push(`figura ${i + 1}, ${e}`)); });
    out[id] = r;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , archivo, fLecciones, ...flags] = process.argv;
  if (!archivo || !fLecciones) { console.error('Uso: node tools/datos/apoyo.mjs lote.json lecciones.json [--json] [--solo-errores]'); process.exit(2); }
  const lote = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const lecciones = JSON.parse(fs.readFileSync(fLecciones, 'utf8'));
  const r = revisarLote(lote, Array.isArray(lecciones) ? lecciones : Object.entries(lecciones).map(([id, l]) => ({ id, ...l })));
  const conError = Object.entries(r).filter(([, x]) => x.errores.length);
  const conAviso = Object.entries(r).filter(([, x]) => x.avisos.length);
  if (flags.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    for (const [id, x] of Object.entries(r)) {
      const titulo = (lecciones.find ? lecciones.find(l => l.id === id) : null)?.titulo || '';
      x.errores.forEach(e => console.log(`ERROR ${id.slice(0, 8)} ${titulo.slice(0, 40)} · ${e}`));
      if (!flags.includes('--solo-errores')) x.avisos.forEach(e => console.log(`aviso ${id.slice(0, 8)} ${titulo.slice(0, 40)} · ${e}`));
    }
    console.log(`Lecciones: ${Object.keys(r).length} · con ERROR: ${conError.length} · con aviso: ${conAviso.length}`);
  }
  process.exit(conError.length ? 1 : 0);
}
