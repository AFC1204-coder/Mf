/**
 * Convierte paquetes de cruce (ya verificados) en SQL para la tabla `articulos`.
 *
 * Uso:  node tools/cruces/a-sql.js --libros=mapa.json [--publico] cruce1.json [cruce2.json ...] > cargar.sql
 *
 * - `lectura_cruzada` se guarda en la columna `sintesis_original`.
 * - Por defecto los cruces se cargan con publico=false; `--publico` los publica (hacerlo solo tras
 *   la verificación independiente y el lint).
 * - `libros_referenciados` es uuid[] en la base: hace falta `--libros=mapa.json` ({ "título del libro": "uuid" }); si un título
 *   no está en el mapa, el script se detiene. El mapa se obtiene de la tabla libros por título.
 * - Es idempotente por título: si ya existe un artículo con el mismo título, lo actualiza.
 */
const fs = require('fs');

const args = process.argv.slice(2);
const publico = args.includes('--publico');
const opMapa = args.find(a => a.startsWith('--libros='));
const ficheros = args.filter(a => !a.startsWith('--'));
const mapaLibros = opMapa ? JSON.parse(fs.readFileSync(opMapa.slice('--libros='.length), 'utf8')) : null;
if (!mapaLibros) { console.error('Falta --libros=mapa.json (título → uuid de libros)'); process.exit(1); }
const uuids = ts => `array[${ts.map(t => { if (!mapaLibros[t]) { console.error('Libro sin id en el mapa: ' + t); process.exit(1); } return `'${mapaLibros[t]}'`; }).join(',')}]::uuid[]`;
if (!ficheros.length) { console.error('Uso: node tools/cruces/a-sql.js [--publico] cruce.json ...'); process.exit(1); }

let n = 0;
const tag = () => '$c' + (n++) + '$';
const txt = s => { const t = tag(); return `${t}${String(s)}${t}`; };
const arr = a => `array[${a.map(txt).join(',')}]::text[]`;
const js = o => { const t = tag(); return `${t}${JSON.stringify(o)}${t}::jsonb`; };

const sql = [];
for (const f of ficheros) {
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  const cols = {
    titulo: txt(c.titulo),
    pregunta_generadora: txt(c.pregunta_generadora),
    tipo: txt(c.tipo),
    autores_convocados: arr(c.autores_convocados),
    libros_referenciados: uuids(c.libros_referenciados),
    cuerpo: txt(c.cuerpo),
    convergencias: txt(c.convergencias),
    divergencias: txt(c.divergencias),
    sintesis_original: txt(c.lectura_cruzada),
    aplicacion: txt(c.aplicacion),
    cautelas: txt(c.cautelas),
    esquemas: js(c.esquemas),
    capsulas: js(c.capsulas),
    fuentes: js(c.fuentes),
    preguntas: js(c.preguntas),
    publico: publico ? 'true' : 'false',
  };
  const nombres = Object.keys(cols);
  const set = nombres.map(k => `${k}=${cols[k]}`).join(', ');
  sql.push(
    `update articulos set ${set}, updated_at=now() where titulo=${cols.titulo};\n` +
    `insert into articulos (${nombres.join(',')}) select ${nombres.map(k => cols[k]).join(',')} ` +
    `where not exists (select 1 from articulos where titulo=${cols.titulo});`
  );
}
process.stdout.write(sql.join('\n') + '\n');
