/**
 * Ambiente sonoro — la parte pura: catálogo de sonidos, curva de volumen y generadores de ruido.
 * El audio se genera en el propio dispositivo (Web Audio), sin descargar nada.
 * Diseño: pensado para leer — fondo estable, sin melodías, y con energía por encima de ~150 Hz
 * para que se oiga también por el altavoz del móvil.
 *
 * UMD: window.AmbienteDSP en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AmbienteDSP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SONIDOS = [
    { id: 'marron', corto: 'marrón', etiqueta: 'Ruido marrón', sub: 'Neutro: lo mejor para concentrarse' },
    { id: 'lluvia', corto: 'lluvia', etiqueta: 'Lluvia', sub: 'Constante, con gotas suaves' },
    { id: 'sala', corto: 'sala', etiqueta: 'Sala tranquila', sub: 'Un acorde abierto, casi inmóvil' }
  ];
  const POR_DEFECTO = 'marron';
  const VOLUMEN_POR_DEFECTO = 0.6;

  const tipoValido = id => (SONIDOS.some(s => s.id === id) ? id : POR_DEFECTO);
  const volumenValido = v => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : VOLUMEN_POR_DEFECTO; };
  /** Curva cuadrática: el oído percibe el volumen en escala logarítmica, así el deslizador se siente lineal. */
  const curvaVolumen = v => { const x = volumenValido(v); return x * x; };

  /** Iguala el final con el principio para que el bucle no «clic». */
  function empalmar(canales, fade) {
    canales.forEach(c => {
      const n = c.length;
      for (let i = 0; i < fade; i++) {
        const w = i / fade, j = n - fade + i;
        c[j] = c[j] * (1 - w) + c[i] * w;
      }
    });
    return canales;
  }

  function normalizar(canales, pico) {
    let m = 0;
    canales.forEach(c => { for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; } });
    const k = m > 0 ? pico / m : 1;
    canales.forEach(c => { for (let i = 0; i < c.length; i++) c[i] *= k; });
    return canales;
  }

  /** Ruido marrón (integral del ruido blanco con fuga). `fuga` más alta = más energía en los medios. */
  function ruidoMarron(n, rnd, fuga) {
    fuga = fuga == null ? 0.06 : fuga;
    const canal = () => {
      const c = new Float32Array(n);
      let a = 0;
      for (let i = 0; i < n; i++) { a = (a + fuga * (rnd() * 2 - 1)) / (1 + fuga); c[i] = a; }
      return c;
    };
    return normalizar([canal(), canal()], 0.9);
  }

  /**
   * Lluvia: siseo continuo con ligera variación lenta, un retumbo grave suave y gotas breves aleatorias.
   * @param {number} n muestras · @param {number} sr frecuencia de muestreo
   */
  function ruidoLluvia(n, sr, rnd) {
    const canal = () => {
      const c = new Float32Array(n);
      let prev = 0, lento = 0, grave = 0;
      for (let i = 0; i < n; i++) {
        const w = rnd() * 2 - 1;
        lento = (lento + 0.0004 * (rnd() * 2 - 1)) / 1.0004;      // variación lenta de intensidad
        const amp = 0.75 + 0.25 * Math.tanh(lento * 30);
        grave = (grave + 0.02 * w) / 1.02;
        c[i] = (0.42 * (w - 0.55 * prev)) * amp + 0.35 * grave;
        prev = w;
      }
      const gotas = Math.round((n / sr) * 26);
      const larga = Math.max(8, Math.round(sr * 0.012));
      for (let g = 0; g < gotas; g++) {
        const pos = Math.floor(rnd() * (n - larga));
        const fuerza = 0.12 + rnd() * 0.38;
        let p = 0;
        for (let k = 0; k < larga; k++) {
          const w = rnd() * 2 - 1;
          c[pos + k] += fuerza * Math.exp(-k / (sr * 0.0028)) * (w - 0.6 * p);
          p = w;
        }
      }
      return c;
    };
    return normalizar([canal(), canal()], 0.9);
  }

  /** Acorde de la «sala»: quinta abierta (re–la) con octavas, todo por encima de 140 Hz. */
  const SALA = [
    { f: 146.83, g: 0.10 }, { f: 220.00, g: 0.075 }, { f: 293.66, g: 0.055 },
    { f: 440.00, g: 0.028 }, { f: 587.33, g: 0.012 }
  ];

  return { SONIDOS, POR_DEFECTO, VOLUMEN_POR_DEFECTO, SALA, tipoValido, volumenValido, curvaVolumen, empalmar, normalizar, ruidoMarron, ruidoLluvia };
});
