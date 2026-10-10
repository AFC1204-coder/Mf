#!/usr/bin/env node
/**
 * Renderiza un mapa SVG en Chromium a ancho de móvil y comprueba, midiendo de verdad:
 *  - ningún texto se sale del lienzo ni de su tarjeta,
 *  - ningún texto pisa a otro texto,
 *  - el texto más pequeño se lee en móvil (≥ 10 px a 350 px de ancho).
 * Uso: node tools/mapa/comprobar.mjs entrada.svg [salida.png]
 * Requiere `playwright` instalado (npm i -D playwright) y un Chromium disponible.
 */
import fs from 'node:fs';

export async function medir(svg, { ancho = 350, png = null } = {}) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch (e) { throw new Error('Falta el paquete playwright (npm i -D playwright)'); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: ancho + 40, height: 900 }, deviceScaleFactor: 2.5 });
    await p.setContent(`<body style="margin:20px;background:#000">${svg.replace('<svg ', `<svg width="${ancho}" `)}</body>`);
    const info = await p.evaluate(() => {
      const s = document.querySelector('svg'); const vb = s.viewBox.baseVal;
      const cajas = [...s.querySelectorAll('rect')].filter(r => r.getAttribute('rx')).map(r => ({ x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
      const textos = [...s.querySelectorAll('text')].map(t => { const bb = t.getBBox(); return { t: t.textContent, x: bb.x, y: bb.y, w: bb.width, h: bb.height, fs: parseFloat(t.getAttribute('font-size')) }; });
      const problemas = [];
      textos.forEach(a => {
        if (a.x < 0 || a.x + a.w > vb.width) problemas.push(`fuera del lienzo: «${a.t}»`);
        const caja = cajas.find(c => a.y >= c.y - 2 && a.y + a.h <= c.y + c.h + 2 && a.x >= c.x - 2 && a.x <= c.x + c.w);
        if (caja && a.x + a.w > caja.x + caja.w - 8) problemas.push(`desborda su tarjeta: «${a.t}»`);
      });
      for (let i = 0; i < textos.length; i++) for (let j = i + 1; j < textos.length; j++) {
        const a = textos[i], c = textos[j];
        const sx = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        const sy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (sx > 2 && sy > 3) problemas.push(`se pisan: «${a.t}» y «${c.t}»`);
      }
      const min = Math.min(...textos.map(t => t.fs));
      return { problemas, minFuente: min, pxMinMovil: Math.round(min * 350 / vb.width * 10) / 10, alto: vb.height };
    });
    if (png) await (await p.$('svg')).screenshot({ path: png });
    return info;
  } finally { await b.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , entrada, salida] = process.argv;
  if (!entrada) { console.error('Uso: node tools/mapa/comprobar.mjs entrada.svg [salida.png]'); process.exit(2); }
  medir(fs.readFileSync(entrada, 'utf8'), { png: salida }).then(r => {
    console.log(JSON.stringify(r, null, 1));
    process.exit(r.problemas.length || r.pxMinMovil < 10 ? 1 : 0);
  }).catch(e => { console.error('Error:', e.message); process.exit(2); });
}
