#!/usr/bin/env node
/**
 * Valida un lote de especificaciones y lo fusiona en datos/diagramas.json o datos/mapas.json.
 *   node tools/datos/agregar.mjs diagramas lote.json     # {idLección: [spec, …]}
 *   node tools/datos/agregar.mjs mapas lote.json         # {idLibro: spec}
 *   --anadir     suma las figuras (con "adicional": true) a las que la lección ya tiene, en vez de sustituirlas
 *   --solo-lint  comprueba el lote y muestra los errores sin escribir nada
 * Lo que no pasa el lint NO se guarda y se muestra el motivo. Código de salida 1 si algo se rechaza.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import LintVisual from '../../lib/lint-visual.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESTINO = { diagramas: path.join(RAIZ, 'datos', 'diagramas.json'), mapas: path.join(RAIZ, 'datos', 'mapas.json') };

export function fusionar(tipo, existente, lote, opciones = {}) {
  const salida = { ...existente };
  const aceptadas = [], rechazadas = [];
  for (const [id, valor] of Object.entries(lote)) {
    if (tipo === 'diagramas') {
      const specs = Array.isArray(valor) ? valor : [valor];
      const errs = specs.flatMap((s, i) => LintVisual.diagrama(s).map(e => `figura ${i + 1}: ${e}`));
      if (opciones.anadir) {
        // Suma las figuras (marcadas «adicional») a las que ya tenga la lección, sin duplicar plantilla + título
        specs.forEach((s, i) => { if (!s || s.adicional !== true) errs.push(`figura ${i + 1}: al añadir, la figura debe llevar "adicional": true`); });
      }
      if (errs.length) rechazadas.push({ id, errores: errs });
      else {
        if (opciones.anadir) {
          const previas = Array.isArray(salida[id]) ? salida[id] : [];
          const clave = s => `${s.plantilla}|${s.titulo}`;
          const ya = new Set(previas.map(clave));
          salida[id] = previas.concat(specs.filter(s => !ya.has(clave(s))));
        } else salida[id] = specs;
        aceptadas.push(id);
      }
    } else {
      const errs = LintVisual.mapa(valor);
      if (errs.length) rechazadas.push({ id, errores: errs }); else { salida[id] = valor; aceptadas.push(id); }
    }
  }
  const ordenado = Object.fromEntries(Object.keys(salida).sort().map(k => [k, salida[k]]));
  return { datos: ordenado, aceptadas, rechazadas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , tipo, archivo, ...flags] = process.argv;
  if (!DESTINO[tipo] || !archivo) { console.error('Uso: node tools/datos/agregar.mjs diagramas|mapas lote.json [--anadir] [--solo-lint]'); process.exit(2); }
  const existente = JSON.parse(fs.readFileSync(DESTINO[tipo], 'utf8') || '{}');
  const lote = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const r = fusionar(tipo, existente, lote, { anadir: flags.includes('--anadir') });
  if (r.aceptadas.length && !flags.includes('--solo-lint')) fs.writeFileSync(DESTINO[tipo], JSON.stringify(r.datos));
  if (flags.includes('--solo-lint')) console.log('(solo comprobación: no se ha escrito nada)');
  console.log(`Aceptadas: ${r.aceptadas.length} · rechazadas: ${r.rechazadas.length} · total en archivo: ${Object.keys(r.datos).length}`);
  r.rechazadas.forEach(x => console.log(`✗ ${x.id}\n   - ${x.errores.join('\n   - ')}`));
  process.exit(r.rechazadas.length ? 1 : 0);
}
