/**
 * Infografía — construye el encargo (prompt) para generar el «mapa visual» de un libro
 * con un modelo de imagen, con salvaguardas contra texto inventado.
 *
 * Idea: el modelo no decide el contenido. Se le da una lista cerrada de etiquetas cortas
 * sacadas de las lecciones del libro y se le pide copiarlas literalmente.
 *
 * UMD: window.Infografia en el navegador, module.exports en Node y tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Infografia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = '1024x1536';

  /** Precio oficial por imagen 1024×1536 (USD), consultado en las fichas de modelo de OpenAI (oct 2026). */
  const PRECIOS = {
    'gpt-image-1':      { low: 0.016, medium: 0.063, high: 0.25 },
    'gpt-image-1.5':    { low: 0.013, medium: 0.05,  high: 0.20 },
    'gpt-image-1-mini': { low: 0.006, medium: 0.015, high: 0.052 }
  };

  const FLOJAS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'del', 'con', 'por', 'para', 'a', 'un', 'una', 'que', 'o', 'u', 'al']);

  const limpiar = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const palabras = s => limpiar(s).split(' ').filter(Boolean);

  /**
   * Etiqueta corta (≤ maxPalabras) a partir de un título de lección.
   * Entre los tramos separados por «:» o « — » elige el más largo que quepa; si ninguno cabe,
   * recorta el primero sin dejar una palabra floja al final.
   */
  function etiqueta(titulo, maxPalabras) {
    maxPalabras = maxPalabras || 5;
    const t = limpiar(titulo).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (!t) return '';
    const partes = t.split(/\s+[—–-]\s+|:\s+/).map(limpiar).filter(Boolean);
    const caben = partes.filter(p => palabras(p).length <= maxPalabras);
    if (caben.length) return caben.sort((a, b) => palabras(b).length - palabras(a).length)[0];
    let w = palabras(partes[0]).slice(0, maxPalabras);
    while (w.length > 1 && FLOJAS.has(w[w.length - 1].toLowerCase())) w.pop();
    return w.join(' ');
  }

  /** Elige hasta n lecciones repartidas a lo largo del libro (principio, medio y final). */
  function repartir(lista, n) {
    if (lista.length <= n) return lista.slice();
    const out = [];
    for (let i = 0; i < n; i++) out.push(lista[Math.round((i * (lista.length - 1)) / (n - 1))]);
    return out;
  }

  /** Conceptos del mapa: etiqueta corta + idea clave de cada lección elegida. */
  function conceptos(lecciones, n) {
    n = n || 6;
    const ord = (lecciones || []).filter(l => l && limpiar(l.titulo)).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const vistos = new Set();
    const out = [];
    repartir(ord, n).forEach(l => {
      const et = etiqueta(l.titulo);
      const k = et.toLowerCase();
      if (et && !vistos.has(k)) { vistos.add(k); out.push({ etiqueta: et, idea: limpiar(l.idea_clave) }); }
    });
    return out;
  }

  /** Primera frase de la descripción, recortada, para el pie. */
  function pie(descripcion, max) {
    max = max || 90;
    const t = limpiar(descripcion);
    if (!t) return '';
    const m = t.match(/^.+?[.!?](?=\s|$)/);
    const f = m ? m[0] : t;
    if (f.length <= max) return f.replace(/[.!?]+$/, '');
    const corte = f.slice(0, max);
    return corte.slice(0, corte.lastIndexOf(' ') > 40 ? corte.lastIndexOf(' ') : max).replace(/[\s,;:—–-]+$/, '');
  }

  const ESTILO = 'infografía editorial vertical, sobria, serena y muy clara; fondo casi negro (#0d1117) con un único acento dorado apagado (#c9a84c) y grises azulados; '
    + 'títulos en tipografía serif elegante y etiquetas en sans-serif legible; abundante espacio en blanco; iconos de línea fina y simples; composición ordenada con jerarquía visual evidente';

  const PROHIBIDO = 'sin fotografías, sin personas reconocibles, sin logotipos, sin marcas de agua y sin reproducir la portada del libro';

  /**
   * Construye el encargo para un libro.
   * @param {{titulo:string, autor:string, descripcion_breve?:string}} libro
   * @param {Array<{titulo:string, orden?:number, idea_clave?:string}>} lecciones
   * @returns {{prompt:string, etiquetas:string[], titulo:string, autor:string, pie:string}}
   */
  function construirPrompt(libro, lecciones) {
    const titulo = limpiar(libro && libro.titulo);
    const autor = limpiar(libro && libro.autor);
    const cs = conceptos(lecciones, 6);
    const p = pie(libro && libro.descripcion_breve);
    const etiquetas = cs.map(c => c.etiqueta);
    const lista = etiquetas.map((e, i) => `${i + 1}. «${e}»`).join('\n');

    const prompt = [
      `Crea una ${ESTILO}, que sirva como mapa visual de las ideas del libro «${titulo}»${autor ? ' de ' + autor : ''}.`,
      '',
      'ESTRUCTURA',
      `- Arriba: el título «${titulo}»${autor ? ` y debajo el autor «${autor}»` : ''}.`,
      `- Centro: un esquema claro (flujo o mapa de conceptos) con ${etiquetas.length} nodos numerados del 1 al ${etiquetas.length}, conectados con flechas en un orden lógico de lectura.`,
      '- Cada nodo lleva exactamente la etiqueta indicada y un icono de línea sencillo que la represente.',
      p ? `- Abajo, como cierre: «${p}».` : '- Abajo: un cierre visual sencillo, sin texto.',
      '',
      'TEXTO EXACTO (cópialo literalmente, sin cambiar, traducir ni añadir ninguna palabra):',
      lista,
      '',
      'REGLAS',
      '- Todo el texto en español, con tildes y eñes correctas.',
      '- No escribas ningún texto aparte del indicado arriba: nada de párrafos, citas, cifras, fechas ni nombres inventados.',
      '- Texto grande y legible en un móvil (equivalente a 14 px o más en una pantalla de 400 px de ancho).',
      '- Nada cortado en los bordes y márgenes generosos.',
      `- ${PROHIBIDO}.`
    ].join('\n');

    return { prompt, etiquetas, titulo, autor, pie: p };
  }

  /** Coste estimado en USD de generar n imágenes; null si no se conoce el precio del modelo. */
  function coste(n, calidad, modelo) {
    const t = PRECIOS[modelo];
    if (!t || t[calidad] == null) return null;
    return Math.round(n * t[calidad] * 1000) / 1000;
  }

  return { SIZE, PRECIOS, etiqueta, repartir, conceptos, pie, construirPrompt, coste };
});
