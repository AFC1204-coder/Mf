/**
 * Libros recomendados para Inicio, con el motivo a la vista.
 * Orden: el que dejaste a medias · afines a lo último que leíste · nuevos · más de tu tema favorito.
 * Lógica pura (sin DOM). UMD: window.Recomendar / module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Recomendar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX = 8;

  /**
   * o.libros, o.lecs, o.leidas (ids de lección, la más reciente primero),
   * o.relacionados(libro, n) → libros afines (opcional), o.esNuevo(libro) → bool (opcional),
   * o.azar() → número en [0,1) para desempatar (opcional), o.n (máximo).
   * Devuelve [{ libro, motivo, tipo, progreso? }].
   */
  function recomendar(o) {
    const libros = (o.libros || []).filter(b => b && b.id);
    const lecs = (o.lecs || []).filter(l => l && l.id);
    const n = o.n || MAX;
    const orden = o.leidas || [];
    const leidas = new Set(orden);
    const lecPorId = new Map(lecs.map(l => [l.id, l]));
    const libroPorId = new Map(libros.map(b => [b.id, b]));
    const total = {}, hechas = {};
    lecs.forEach(l => { total[l.libro_id] = (total[l.libro_id] || 0) + 1; if (leidas.has(l.id)) hechas[l.libro_id] = (hechas[l.libro_id] || 0) + 1; });
    const conLecs = b => (total[b.id] || 0) > 0;
    const sinTocar = b => conLecs(b) && !(hechas[b.id] > 0);

    // Libros leídos, del más reciente al más antiguo
    const recientes = [];
    orden.forEach(id => { const l = lecPorId.get(id); if (l && !recientes.includes(l.libro_id)) recientes.push(l.libro_id); });

    const out = [], vistos = new Set();
    const meter = (b, motivo, tipo, extra) => {
      if (!b || vistos.has(b.id) || out.length >= n) return;
      vistos.add(b.id);
      out.push(Object.assign({ libro: b, motivo, tipo }, extra || {}));
    };

    // 1 · A medias (el más reciente)
    for (const id of recientes) {
      const b = libroPorId.get(id);
      if (b && conLecs(b) && hechas[id] > 0 && hechas[id] < total[id]) { meter(b, 'Sigue aquí', 'sigue', { progreso: `${hechas[id]} de ${total[id]}` }); break; }
    }

    // 2 · Afines a lo último que leíste (los dos libros más recientes)
    const afines = [];
    if (typeof o.relacionados === 'function') {
      recientes.slice(0, 2).forEach(id => {
        const ancla = libroPorId.get(id);
        if (!ancla) return;
        (o.relacionados(ancla, 4) || []).filter(sinTocar).forEach(b => afines.push({ b, ancla }));
      });
    }
    // 3 · Nuevos sin tocar
    const nuevos = typeof o.esNuevo === 'function' ? libros.filter(b => sinTocar(b) && o.esNuevo(b)) : [];
    // Se intercalan para que haya variedad de motivos
    for (let i = 0; i < Math.max(afines.length, nuevos.length); i++) {
      if (afines[i]) meter(afines[i].b, `Porque leíste «${afines[i].ancla.titulo}»`, 'afin');
      if (nuevos[i]) meter(nuevos[i], 'Nuevo', 'nuevo');
    }

    // 4 · Más de tu tema favorito
    const porEje = {};
    orden.forEach(id => { const l = lecPorId.get(id); const b = l && libroPorId.get(l.libro_id); if (b && b.eje_principal) porEje[b.eje_principal] = (porEje[b.eje_principal] || 0) + 1; });
    const ejeTop = Object.keys(porEje).sort((a, b) => porEje[b] - porEje[a])[0] || null;
    const rnd = typeof o.azar === 'function' ? o.azar : () => 0.5;
    const baraja = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    if (ejeTop) baraja(libros.filter(b => sinTocar(b) && b.eje_principal === ejeTop)).forEach(b => meter(b, `Más de ${ejeTop}`, 'tema'));
    // 5 · Si no hay historial (o sobran huecos), libros con portada para empezar
    if (out.length < n) baraja(libros.filter(b => sinTocar(b) && b.portada_url)).forEach(b => meter(b, 'Para empezar', 'empezar'));
    return out;
  }

  return { MAX, recomendar };
});
