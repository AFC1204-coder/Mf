#!/usr/bin/env node
/**
 * Dibuja un lote de figuras (el mismo JSON que agregar.mjs) con la hoja de estilos real de la app y saca una
 * imagen para revisarlas a ojo antes de guardarlas.
 *   node tools/datos/galeria.mjs lote.json salida.png [--kindle]
 * Cada figura sale con el id de su lección encima. Requiere Playwright (ya instalado en el entorno de trabajo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const Diagrama = require(path.join(RAIZ, 'lib', 'diagram.js'));

const [, , archivo, salida, ...flags] = process.argv;
if (!archivo || !salida) { console.error('Uso: node tools/datos/galeria.mjs lote.json salida.png [--kindle]'); process.exit(2); }
const lote = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const kindle = flags.includes('--kindle');
let n = 0, sin = [];
const bloques = Object.entries(lote).map(([id, v]) => {
  const specs = Array.isArray(v) ? v : [v];
  return `<div class="g-id">${id}</div>` + specs.map(s => { const h = Diagrama.render(s); if (!h) sin.push(id); else n++; return `<div class="folio g">${h}</div>`; }).join('');
}).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(RAIZ, 'styles.css'))}">
<style>body{padding:12px;background:#0b0b0b;font-family:sans-serif} .g{max-width:420px;margin:0 auto 18px} .g-id{color:#888;font:11px monospace;text-align:center;margin:14px 0 4px}</style>
</head><body class="${kindle ? 'kindle' : ''}">${bloques}</body></html>`;
const tmp = path.join(path.dirname(path.resolve(salida)), `_galeria-${process.pid}-${Date.now()}.html`);   // único: varias ejecuciones a la vez no se pisan
fs.writeFileSync(tmp, html);
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(tmp).href);
await p.waitForTimeout(500);
await p.screenshot({ path: salida, fullPage: true });
await b.close();
try { fs.unlinkSync(tmp); } catch (e) { /* otro proceso ya lo borró */ }
console.log(`Figuras dibujadas: ${n}${sin.length ? ' · NO se dibujan: ' + sin.join(', ') : ''} → ${salida}`);
