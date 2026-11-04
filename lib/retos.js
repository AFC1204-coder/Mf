/**
 * Retos de pensamiento — lógica pura (sin red ni DOM).
 * Sustituyen al test de cada lección: no hay respuesta correcta ni nota. Lo que se guarda es lo que
 * piensa el usuario, para que la app se lo devuelva más adelante («¿sigues pensando lo mismo?»)
 * y para que las predicciones se comparen con lo que de verdad pasó.
 * Diseño: docs/retos-pensamiento.md
 *
 * UMD: window.Retos en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Retos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIA = 86400000;
  /** Días hasta volver a preguntar «¿sigues pensando lo mismo?», según cuántas veces se ha mantenido. */
  const INTERVALOS = [7, 21, 60, 150];
  /** Una predicción vuelve a los 30 días. */
  const DIAS_PREDICCION = 30;
  const MAX_TEXTO = 2000;

  const TIPOS = {
    predecir: { nombre: 'Predice', ayuda: 'Apunta qué esperas antes de que pase. Volveré a preguntarte.' },
    primeros_principios: { nombre: 'Desde cero', ayuda: 'Qué supuesto hay debajo, y qué pasa si lo quitas.' },
    choque: { nombre: 'Dos autores', ayuda: 'Dos posturas distintas. No hay una oficial.' },
    otra_cara: { nombre: 'La otra cara', ayuda: 'Busca el mejor argumento en contra.' },
    vida_real: { nombre: 'En tu vida', ayuda: 'Un caso real y reciente, en una línea.' },
    explicalo: { nombre: 'Explícalo', ayuda: 'Con tus palabras, como a alguien que no lo ha leído.' }
  };
  const RESULTADOS = ['acerto', 'fallo', 'a_medias', 'aun_no'];
  const VEREDICTOS = ['igual', 'matizo', 'cambio'];

  const addDias = (fecha, n) => new Date(new Date(fecha).getTime() + n * DIA).toISOString();

  /** Texto listo para guardar, o null si está vacío o se pasa de largo. */
  function limpiarTexto(t) {
    const s = String(t == null ? '' : t).replace(/\r/g, '').trim();
    return s && s.length <= MAX_TEXTO ? s : null;
  }

  /** Fila nueva de `respuestas_reto`. Las predicciones vuelven a los 30 días; el resto, a la primera revisión. */
  function nuevaRespuesta(o, ahora) {
    const texto = limpiarTexto(o && o.texto);
    if (!texto || !TIPOS[o.tipo] || !o.leccion_id) return null;
    const t = ahora || new Date();
    const dias = o.tipo === 'predecir' ? DIAS_PREDICCION : INTERVALOS[0];
    return {
      reto_id: o.reto_id || null,
      leccion_id: o.leccion_id,
      tipo: o.tipo,
      texto,
      nivel: 0,
      proxima_revision: addDias(t, dias),
      creada_at: new Date(t).toISOString()
    };
  }

  /**
   * Qué cambia al contestar «¿sigues pensando lo mismo?».
   * igual → sube de nivel y tarda más; matizo → mismo intervalo; cambio → vuelve a empezar.
   */
  function trasRevision(resp, veredicto, ahora) {
    if (VEREDICTOS.indexOf(veredicto) < 0) return null;
    const t = ahora || new Date();
    let nivel = Number(resp.nivel) || 0;
    if (veredicto === 'igual') nivel = Math.min(nivel + 1, INTERVALOS.length - 1);
    else if (veredicto === 'cambio') nivel = 0;
    return { nivel, ultima_revision: new Date(t).toISOString(), proxima_revision: addDias(t, INTERVALOS[nivel]) };
  }

  /** Cierra una predicción. «Aún no se sabe» la deja viva y la vuelve a preguntar en 30 días. */
  function resolverPrediccion(resp, resultado, ahora) {
    if (RESULTADOS.indexOf(resultado) < 0 || resp.tipo !== 'predecir') return null;
    const t = ahora || new Date();
    if (resultado === 'aun_no') {
      return { resultado: null, ultima_revision: new Date(t).toISOString(), proxima_revision: addDias(t, DIAS_PREDICCION) };
    }
    return { resultado, resuelta_at: new Date(t).toISOString(), ultima_revision: new Date(t).toISOString(),
      proxima_revision: addDias(t, 36500) };
  }

  const vencida = (r, ahora) => !r.resuelta_at && new Date(r.proxima_revision).getTime() <= (ahora || new Date()).getTime();

  /** Lo que toca hoy, separado: predicciones por comprobar y reflexiones por revisar. Lo más antiguo primero. */
  function pendientes(resps, ahora) {
    const t = ahora || new Date();
    const v = (resps || []).filter(r => vencida(r, t))
      .sort((a, b) => new Date(a.proxima_revision) - new Date(b.proxima_revision));
    return {
      predicciones: v.filter(r => r.tipo === 'predecir'),
      reflexiones: v.filter(r => r.tipo !== 'predecir')
    };
  }

  /**
   * Registro de predicciones agrupado por autor o por idea (título de la lección).
   * `info(leccion_id)` devuelve { autor, idea }.
   */
  function registro(resps, info, por) {
    const grupos = new Map();
    (resps || []).filter(r => r.tipo === 'predecir').forEach(r => {
      const i = info(r.leccion_id) || {};
      const clave = (por === 'autor' ? i.autor : i.idea) || 'Sin clasificar';
      if (!grupos.has(clave)) grupos.set(clave, { clave, acerto: 0, fallo: 0, a_medias: 0, pendientes: 0, items: [] });
      const g = grupos.get(clave);
      if (r.resultado === 'acerto') g.acerto++;
      else if (r.resultado === 'fallo') g.fallo++;
      else if (r.resultado === 'a_medias') g.a_medias++;
      else g.pendientes++;
      g.items.push(r);
    });
    return Array.from(grupos.values()).sort((a, b) => a.clave.localeCompare(b.clave, 'es'));
  }

  const ymd = f => new Date(f).toISOString().slice(0, 10);
  /** «hace 3 semanas», sin precisión falsa. */
  function hace(fecha, ahora) {
    const d = Math.max(0, Math.round(((ahora || new Date()).getTime() - new Date(fecha).getTime()) / DIA));
    if (d < 1) return 'hoy';
    if (d === 1) return 'ayer';
    if (d < 14) return 'hace ' + d + ' días';
    if (d < 60) return 'hace ' + Math.round(d / 7) + ' semanas';
    return 'hace ' + Math.round(d / 30) + ' meses';
  }

  return { INTERVALOS, DIAS_PREDICCION, MAX_TEXTO, TIPOS, RESULTADOS, VEREDICTOS,
    limpiarTexto, nuevaRespuesta, trasRevision, resolverPrediccion, pendientes, registro, hace, ymd };
});
