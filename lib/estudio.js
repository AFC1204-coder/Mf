/**
 * Estudio — cifras sobre cómo usas la herramienta: constancia, variedad, retención y retos.
 * Lógica pura (sin red ni DOM). Todo sale de datos que ya se guardan; no se inventa nada.
 * Con pocos datos las cifras engañan, así que cada bloque dice cuántos datos tiene detrás (`n`)
 * y las observaciones solo aparecen a partir de una muestra mínima.
 * Diseño: docs/estudio-uso.md
 *
 * UMD: window.Estudio en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Estudio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Muestras mínimas para decir algo de uno mismo. */
  const MIN = { habitos: 10, retencion: 15, predicciones: 5, fragil: 3 };
  const NIVEL_FIRME = 4;

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const sumaDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const lunes = dia => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const franjaDe = h => (h < 6 ? 'madrugada' : h < 12 ? 'mañana' : h < 20 ? 'tarde' : 'noche');

  /** Racha actual (cuenta si estuviste ayer aunque hoy aún no) y la mejor de siempre. */
  function rachas(dias, hoy) {
    const set = new Set(dias);
    let actual = 0, d = set.has(hoy) ? hoy : sumaDias(hoy, -1);
    while (set.has(d)) { actual++; d = sumaDias(d, -1); }
    let mejor = 0, corrida = 0, prev = null;
    Array.from(set).sort().forEach(x => { corrida = prev && sumaDias(prev, 1) === x ? corrida + 1 : 1; prev = x; if (corrida > mejor) mejor = corrida; });
    return { actual, mejor };
  }

  function constancia(o) {
    const diaDe = o.diaDe, hoy = o.hoy;
    const lecturas = (o.prog || []).filter(p => p.tipo === 'leccion' && p.fecha);
    const actividad = lecturas.map(p => p.fecha).concat(o.revisiones || [], (o.respuestas || []).map(r => r.creada_at)).filter(Boolean);
    const dias = Array.from(new Set(actividad.map(diaDe).filter(Boolean)));
    const desde = n => sumaDias(hoy, -(n - 1));
    const dias30 = dias.filter(d => d >= desde(30) && d <= hoy).length;
    const dias90 = dias.filter(d => d >= desde(90) && d <= hoy).length;
    // Lecciones leídas por semana (8 semanas, la actual la última).
    const ini = lunes(hoy);
    const semanas = [];
    for (let i = 7; i >= 0; i--) {
      const a = sumaDias(ini, -7 * i), b = sumaDias(a, 6);
      const vistas = new Set(lecturas.filter(p => { const d = diaDe(p.fecha); return d >= a && d <= b; }).map(p => p.item_id));
      semanas.push({ desde: a, lecciones: vistas.size });
    }
    const porDia = [0, 0, 0, 0, 0, 0, 0];     // lunes … domingo
    const franjas = { madrugada: 0, mañana: 0, tarde: 0, noche: 0 };
    lecturas.forEach(p => {
      const d = diaDe(p.fecha); if (!d) return;
      porDia[(new Date(d + 'T12:00:00').getDay() + 6) % 7]++;
      franjas[franjaDe(new Date(p.fecha).getHours())]++;
    });
    return Object.assign({ dias30, dias90, diasTotal: dias.length, semanas, porDia, franjas, nLecturas: lecturas.length }, rachas(dias, hoy));
  }

  function variedad(o) {
    const libroDe = id => (o.libros || []).find(b => b.id === id);
    const lecDe = id => (o.lecs || []).find(l => l.id === id);
    const hoy = o.hoy, diaDe = o.diaDe, ini30 = sumaDias(hoy, -29);
    const leidas = new Map();                                    // lección → última fecha
    (o.prog || []).filter(p => p.tipo === 'leccion' && p.fecha).forEach(p => {
      if (!leidas.has(p.item_id) || p.fecha > leidas.get(p.item_id)) leidas.set(p.item_id, p.fecha);
    });
    const porEje = {}, porLibro = {}, libros30 = new Set();
    leidas.forEach((f, id) => {
      const l = lecDe(id); if (!l) return;
      const b = libroDe(l.libro_id); if (!b) return;
      const eje = b.eje_principal || b.eje || 'Sin eje';
      porEje[eje] = (porEje[eje] || 0) + 1;
      porLibro[b.id] = (porLibro[b.id] || 0) + 1;
      if (diaDe(f) >= ini30) libros30.add(b.id);
    });
    const total = Array.from(leidas.keys()).filter(id => lecDe(id)).length;
    const ejes = Object.keys(porEje).map(e => ({ eje: e, lecciones: porEje[e], pct: pct(porEje[e], total) })).sort((a, b) => b.lecciones - a.lecciones);
    const totalPorLibro = {};
    (o.lecs || []).forEach(l => { totalPorLibro[l.libro_id] = (totalPorLibro[l.libro_id] || 0) + 1; });
    const ids = Object.keys(porLibro);
    const terminados = ids.filter(id => porLibro[id] >= totalPorLibro[id]).length;
    const mas = ids.sort((a, b) => porLibro[b] - porLibro[a])[0];
    const todosEjes = new Set((o.libros || []).map(b => b.eje_principal || b.eje).filter(Boolean));
    return {
      total, ejes, librosTocados: ids.length, libros30: libros30.size, terminados, empezadosSinTerminar: ids.length - terminados,
      libroMasLeido: mas ? { titulo: (libroDe(mas) || {}).titulo, lecciones: porLibro[mas], pct: pct(porLibro[mas], total) } : null,
      ejesSinTocar: Array.from(todosEjes).filter(e => !porEje[e]).sort()
    };
  }

  /** Retención a partir del repaso espaciado (tarjetas activas): aciertos, fallos y nivel por lección y por eje. */
  function retencion(o) {
    const activos = (o.repaso || []).filter(r => r.estado === 'activa');
    const lecDe = id => (o.lecs || []).find(l => l.id === id);
    const pregDe = id => (o.preg || []).find(p => p.id === id);
    const libroDe = id => (o.libros || []).find(b => b.id === id);
    const porLec = new Map();
    activos.forEach(r => {
      const lid = r.leccion_id || (pregDe(r.pregunta_id) || {}).leccion_id; if (!lid) return;
      const g = porLec.get(lid) || { leccion_id: lid, ok: 0, mal: 0, nivelMax: 0, tarjetas: 0 };
      g.ok += r.veces_correcta || 0; g.mal += r.veces_incorrecta || 0; g.tarjetas++;
      g.nivelMax = Math.max(g.nivelMax, r.nivel || 0);
      porLec.set(lid, g);
    });
    const lecciones = Array.from(porLec.values()).map(g => {
      const l = lecDe(g.leccion_id) || {}, b = libroDe(l.libro_id) || {};
      return Object.assign(g, { titulo: l.titulo || '', libro: b.titulo || '', eje: b.eje_principal || b.eje || 'Sin eje', acierto: pct(g.ok, g.ok + g.mal), intentos: g.ok + g.mal });
    });
    const ok = lecciones.reduce((s, g) => s + g.ok, 0), mal = lecciones.reduce((s, g) => s + g.mal, 0);
    const ejes = {};
    lecciones.forEach(g => { const e = ejes[g.eje] = ejes[g.eje] || { eje: g.eje, ok: 0, mal: 0 }; e.ok += g.ok; e.mal += g.mal; });
    return {
      intentos: ok + mal, acierto: pct(ok, ok + mal),
      leccionesEnRepaso: lecciones.length,
      asentadas: lecciones.filter(g => g.nivelMax >= NIVEL_FIRME).length,
      porEje: Object.values(ejes).map(e => ({ eje: e.eje, intentos: e.ok + e.mal, acierto: pct(e.ok, e.ok + e.mal) })).sort((a, b) => b.intentos - a.intentos),
      fragiles: lecciones.filter(g => g.intentos >= MIN.fragil && g.acierto < 60).sort((a, b) => a.acierto - b.acierto || b.intentos - a.intentos).slice(0, 5)
    };
  }

  function retos(o) {
    const rs = o.respuestas || [];
    const propias = rs.filter(r => r.tipo !== 'explicalo');
    const pred = rs.filter(r => r.tipo === 'predecir');
    const por = k => pred.filter(r => r.resultado === k).length;
    const comprobadas = por('acerto') + por('fallo') + por('a_medias');
    const rev = o.revisionesReto || [];
    const v = k => rev.filter(x => x.veredicto === k).length;
    return {
      contestados: propias.length, explicalo: rs.length - propias.length, activos: o.retosActivos || 0,
      revisiones: rev.length, igual: v('igual'), matizo: v('matizo'), cambio: v('cambio'),
      cambioPct: pct(v('cambio'), rev.length),
      predicciones: { total: pred.length, acerto: por('acerto'), fallo: por('fallo'), a_medias: por('a_medias'), pendientes: pred.length - comprobadas,
        comprobadas, aciertoPct: pct(por('acerto'), comprobadas) }
    };
  }

  const FRANJA_TXT = { madrugada: 'de madrugada', mañana: 'por la mañana', tarde: 'por la tarde', noche: 'por la noche' };
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  /** Frases sobrias; cada una solo aparece con muestra suficiente. */
  function observaciones(e) {
    const o = [];
    const c = e.constancia, v = e.variedad, r = e.retencion, t = e.retos;
    if (c.nLecturas >= MIN.habitos) {
      const f = Object.keys(c.franjas).sort((a, b) => c.franjas[b] - c.franjas[a])[0];
      if (pct(c.franjas[f], c.nLecturas) >= 50) o.push(`Lees sobre todo ${FRANJA_TXT[f]} (${pct(c.franjas[f], c.nLecturas)} % de tus lecciones).`);
      const dMax = c.porDia.indexOf(Math.max.apply(null, c.porDia));
      if (pct(c.porDia[dMax], c.nLecturas) >= 30) o.push(`El ${DIAS[dMax]} es tu día fuerte (${pct(c.porDia[dMax], c.nLecturas)} % de las lecciones).`);
    }
    if (v.total >= MIN.habitos && v.ejes[0] && v.ejes[0].pct >= 60) o.push(`El ${v.ejes[0].pct} % de lo que has leído es de «${v.ejes[0].eje}».`);
    if (v.empezadosSinTerminar >= 5) o.push(`Tienes ${v.empezadosSinTerminar} libros empezados sin terminar.`);
    if (r.intentos >= MIN.retencion && r.fragiles.length) o.push(`Lo que más se te olvida: «${r.fragiles[0].titulo}» (${r.fragiles[0].acierto} % en ${r.fragiles[0].intentos} repasos).`);
    if (t.revisiones >= MIN.predicciones && t.cambioPct != null) o.push(`Al revisar tus respuestas, has cambiado de opinión en ${t.cambioPct} % de los casos.`);
    if (t.predicciones.comprobadas >= MIN.predicciones) o.push(`Tus predicciones comprobadas: aciertas ${t.predicciones.aciertoPct} %.`);
    return o;
  }

  function analizar(o) {
    const e = { constancia: constancia(o), variedad: variedad(o), retencion: retencion(o), retos: retos(o) };
    e.observaciones = observaciones(e);
    return e;
  }

  return { MIN, rachas, constancia, variedad, retencion, retos, observaciones, analizar };
});
