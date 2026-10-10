/**
 * Sesión de hoy — lógica pura: qué pasos tiene, cuánto dura y cuándo se
 * pregunta por la acción que te llevaste.
 *
 * Orden: Recuerda (compromiso de ayer + hasta 3 tarjetas) → Lee → Comprueba → Lleva.
 *
 * UMD: window.Sesion en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sesion = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_TARJETAS = 3;
  const SEG_TARJETA = 25;      // segundos por tarjeta
  const SEG_COMPRUEBA = 20;
  const SEG_LLEVA = 20;

  const ETIQUETA = {
    recuerda: 'Recuerda',
    lee: 'Lee',
    comprueba: 'Comprueba',
    lleva: 'Lleva'
  };

  /** Lectura de 2 minutos: ≈ la mitad de la completa, entre 1 y 3 min. */
  function minutosCorta(minCompleta) {
    return Math.min(3, Math.max(1, Math.round((minCompleta || 1) / 2)));
  }

  /**
   * Arma el plan de la sesión.
   * @param {object} o
   *   tarjetas  — array de tarjetas vencidas (se usan hasta 3)
   *   compromiso — compromiso de un día anterior por preguntar (o null)
   *   leccion   — lección de hoy (o null si no queda ninguna)
   *   pregunta  — pregunta de comprobación (o null)
   *   tieneAccion — la lección trae aplicación práctica
   *   modo      — 'corta' | 'completa'
   *   minCompleta — minutos de lectura completa
   */
  function construir(o) {
    o = o || {};
    const tarjetas = (o.tarjetas || []).slice(0, MAX_TARJETAS);
    const pasos = [];
    let seg = 0;

    const nRecuerda = tarjetas.length + (o.compromiso ? 1 : 0);
    if (nRecuerda) {
      pasos.push({ k: 'recuerda', n: nRecuerda });
      seg += tarjetas.length * SEG_TARJETA + (o.compromiso ? 15 : 0);
    }
    if (o.leccion) {
      const min = o.modo === 'completa' ? (o.minCompleta || 1) : minutosCorta(o.minCompleta);
      pasos.push({ k: 'lee', min });
      seg += min * 60;
      if (o.pregunta) { pasos.push({ k: 'comprueba' }); seg += SEG_COMPRUEBA; }
      if (o.tieneAccion) { pasos.push({ k: 'lleva' }); seg += SEG_LLEVA; }
    }
    return {
      pasos: pasos.map(p => Object.assign({ etiqueta: ETIQUETA[p.k] }, p)),
      minutos: Math.max(1, Math.round(seg / 60)),
      soloRecordar: !o.leccion && nRecuerda > 0,
      vacia: pasos.length === 0
    };
  }

  /** Día (YYYY-MM-DD) en que se pregunta «¿lo hiciste?» según la opción elegida. */
  function diaCompromiso(opcion, hoy) {
    const dias = opcion === 'semana' ? 4 : 1;
    const d = new Date(hoy + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Texto de la acción: primera frase o recorte limpio. */
  function textoAccion(raw, max) {
    max = max || 240;
    const t = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`|]/g, '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const corte = t.slice(0, max);
    const punto = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '), corte.lastIndexOf('! '));
    if (punto > max * 0.5) return corte.slice(0, punto + 1);
    return corte.replace(/\s+\S*$/, '') + '…';
  }

  /** Resumen del cierre: «3 recordadas · 1 leída · 1 acción». */
  function resumen(r) {
    r = r || {};
    const p = [];
    if (r.recordadas) p.push(`${r.recordadas} recordada${r.recordadas === 1 ? '' : 's'}`);
    if (r.leida) p.push('1 leída');
    if (r.accion) p.push('1 acción');
    return p.join(' · ');
  }

  return { MAX_TARJETAS, ETIQUETA, minutosCorta, construir, diaCompromiso, textoAccion, resumen };
});
