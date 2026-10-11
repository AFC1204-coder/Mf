/**
 * Métricas de uso a partir de la tabla `eventos` (ver supabase/migrations/20261011_sesion_eventos.sql).
 * Lógica pura: recibe filas {usuario_id, dia, tipo, props} y devuelve cifras para el panel de admin.
 *
 * UMD: window.Metricas en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Metricas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Tipos que cuentan como «día activo». */
  const ACTIVOS = ['sesion_cerrada', 'leccion_leida', 'tarjeta'];

  const sumaDias = (iso, n) => {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const mediana = xs => {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };

  /** Eventos de los últimos `dias` días hasta `hoy` (incluido). */
  function ventana(eventos, hoy, dias) {
    const ini = sumaDias(hoy, -(dias - 1));
    return (eventos || []).filter(e => e && e.dia >= ini && e.dia <= hoy);
  }

  /** Sesiones: empezadas, cerradas, abandonadas, tasa de finalización, tiempo mediano y dónde se abandona. */
  function sesiones(eventos) {
    const ev = eventos || [];
    const emp = ev.filter(e => e.tipo === 'sesion_inicio');
    const cer = ev.filter(e => e.tipo === 'sesion_cerrada');
    const aba = ev.filter(e => e.tipo === 'sesion_abandonada');
    const porPaso = {};
    aba.forEach(e => { const k = (e.props && e.props.paso) || 'fin'; porPaso[k] = (porPaso[k] || 0) + 1; });
    const segs = cer.map(e => Number(e.props && e.props.segundos)).filter(n => n > 0);
    return {
      empezadas: emp.length, cerradas: cer.length, abandonadas: aba.length,
      finalizacion: pct(cer.length, emp.length),
      segundosMediana: mediana(segs),
      abandonoPorPaso: porPaso
    };
  }

  /** Días activos por usuario dentro de la ventana, y cuántos usuarios hubo. */
  function actividad(eventos, hoy, dias) {
    const ev = ventana(eventos, hoy, dias).filter(e => ACTIVOS.includes(e.tipo));
    const porUsuario = {};
    ev.forEach(e => { (porUsuario[e.usuario_id || 'default'] = porUsuario[e.usuario_id || 'default'] || new Set()).add(e.dia); });
    const us = Object.keys(porUsuario);
    const dist = us.map(u => porUsuario[u].size);
    return {
      usuarios: us.length,
      diasActivosMediana: mediana(dist),
      diasActivosMax: dist.length ? Math.max.apply(null, dist) : 0,
      diasConActividad: new Set(ev.map(e => e.dia)).size
    };
  }

  /**
   * Retención D1 / D7 / D30: de los usuarios cuyo primer día activo es lo bastante antiguo,
   * qué parte volvió exactamente ese día (D1, D7) o en esa ventana (D30 = días 25–35, para no exigir un día exacto).
   */
  function retencion(eventos, hoy) {
    const porUsuario = {};
    (eventos || []).filter(e => ACTIVOS.includes(e.tipo)).forEach(e => {
      (porUsuario[e.usuario_id || 'default'] = porUsuario[e.usuario_id || 'default'] || new Set()).add(e.dia);
    });
    const medir = (dMin, dMax) => {
      let base = 0, vuelven = 0;
      Object.values(porUsuario).forEach(set => {
        const dias = Array.from(set).sort();
        const primero = dias[0];
        if (sumaDias(primero, dMax) > hoy) return;       // aún no ha pasado el plazo completo
        base++;
        if (dias.some(d => d >= sumaDias(primero, dMin) && d <= sumaDias(primero, dMax))) vuelven++;
      });
      return { base, vuelven, pct: pct(vuelven, base) };
    };
    return { d1: medir(1, 1), d7: medir(7, 7), d30: medir(25, 35) };
  }

  /** Compromisos: respondidos por resultado. */
  function compromisos(eventos) {
    const r = { si: 0, a_medias: 0, no: 0 };
    (eventos || []).filter(e => e.tipo === 'compromiso_respondido').forEach(e => {
      const k = e.props && e.props.resultado;
      if (k in r) r[k]++;
    });
    const total = r.si + r.a_medias + r.no;
    return Object.assign(r, { total, cumplidos: pct(r.si, total) });
  }

  /** Comprobación: aciertos de «Comprueba» en la sesión. */
  function comprobacion(eventos) {
    const ev = (eventos || []).filter(e => e.tipo === 'comprobacion');
    const ok = ev.filter(e => e.props && e.props.ok).length;
    return { total: ev.length, aciertos: ok, pct: pct(ok, ev.length) };
  }

  /** Serie diaria (más antiguo primero) con sesiones cerradas y lecturas, para una mini-gráfica. */
  function serieDiaria(eventos, hoy, dias) {
    const ini = sumaDias(hoy, -(dias - 1));
    const out = [];
    for (let i = 0; i < dias; i++) {
      const d = sumaDias(ini, i);
      const del = (eventos || []).filter(e => e.dia === d);
      out.push({
        dia: d,
        sesiones: del.filter(e => e.tipo === 'sesion_cerrada').length,
        lecturas: del.filter(e => e.tipo === 'leccion_leida').length,
        tarjetas: del.filter(e => e.tipo === 'tarjeta').length
      });
    }
    return out;
  }

  /** Todo junto para el panel. */
  function resumen(eventos, hoy, dias) {
    dias = dias || 30;
    const v = ventana(eventos, hoy, dias);
    return {
      dias,
      eventos: v.length,
      sesiones: sesiones(v),
      actividad: actividad(eventos, hoy, dias),
      retencion: retencion(eventos, hoy),
      compromisos: compromisos(v),
      comprobacion: comprobacion(v),
      onboarding: {
        iniciado: v.filter(e => e.tipo === 'onboarding_inicio').length,
        completado: v.filter(e => e.tipo === 'onboarding').length,
        omitido: v.filter(e => e.tipo === 'onboarding_omitido').length
      },
      serie: serieDiaria(eventos, hoy, Math.min(dias, 30))
    };
  }

  return { ACTIVOS, sumaDias, ventana, sesiones, actividad, retencion, compromisos, comprobacion, serieDiaria, resumen };
});
