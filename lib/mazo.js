/**
 * Mazo de fichas: la entrada rápida de la app (docs/rediseno-uso-diario.md §16.2–16.3).
 * Cinco fichas finitas que piden algo (recordar, ampliar, leer) y terminan con una única oferta
 * de subir a la lectura. También decide cuándo reabrir una lectura que quedó a medias.
 *
 * Lógica pura: recibe datos y devuelve qué mostrar. UMD: window.Mazo / module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mazo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAM = 5;
  const REABRIR_MS = 12 * 3600 * 1000;      // lectura activa más reciente que esto → se reabre directamente
  const RECORDAR_MS = 7 * 24 * 3600 * 1000; // más antigua que 12 h pero < 7 días → ficha «Seguías en»

  /** PRNG determinista (mulberry32) para que el mazo sea estable dentro de la misma apertura. */
  function azar(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const semillaDe = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  const tiene = (s, n) => typeof s === 'string' && s.trim().length >= (n || 20);

  /** Primeras frases de un texto, sin marcas, hasta ~max caracteres. */
  function extracto(txt, max) {
    const t = String(txt || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const frases = t.match(/[^.!?…]+[.!?…]+/g) || [t];
    let out = '';
    for (const f of frases) { if ((out + f).length > max) break; out += f; }
    return (out || t.slice(0, max).replace(/\s+\S*$/, '') + '…').trim();
  }

  /**
   * ¿Qué hacer con la lectura guardada al abrir la app?
   * 'abrir' (volver directamente a ella), 'ficha' (ofrecerla como primera ficha) o null.
   */
  function decidirReanudar(estado, ahora, completadas) {
    if (!estado || !estado.lecId || !(estado.ts > 0)) return null;
    if (completadas && completadas.has(estado.lecId)) return null;
    const edad = ahora - estado.ts;
    if (edad < 0) return null;
    if (estado.activa && edad < REABRIR_MS) return 'abrir';
    if (edad < RECORDAR_MS && (estado.y || 0) > 0.05) return 'ficha';
    return null;
  }

  /** Minutos que quedan de una lectura según la fracción ya leída. */
  function minutosRestantes(total, fraccion) {
    const f = Math.min(1, Math.max(0, Number(fraccion) || 0));
    return Math.max(1, Math.round((total || 1) * (1 - f)));
  }

  /**
   * Compone el mazo.
   * o.lecs, o.libros, o.completadas (Set), o.siguiente (lección que toca leer o null),
   * o.reanudar ({ lec, restante } o null), o.vistas (ids vistos hace poco), o.semilla.
   * Devuelve fichas { tipo, lecId, ... } — tipos: reanudar · recuerda · idea · matiz · cita · cierre.
   */
  function componer(o) {
    const lecs = (o.lecs || []).filter(l => l && l.id);
    const comp = o.completadas || new Set();
    const vistas = new Set(o.vistas || []);
    const rnd = azar(typeof o.semilla === 'number' ? o.semilla : semillaDe(o.semilla || 'mf'));
    const usadas = new Set();
    const elegir = (cands) => {
      const frescas = cands.filter(l => !usadas.has(l.id) && !vistas.has(l.id));
      const pool = frescas.length ? frescas : cands.filter(l => !usadas.has(l.id));
      if (!pool.length) return null;
      const l = pool[Math.floor(rnd() * pool.length)];
      usadas.add(l.id);
      return l;
    };
    const fichas = [];

    // 1 · Reanudar lo que quedó a medias o recordar algo ya leído
    if (o.reanudar && o.reanudar.lec) {
      usadas.add(o.reanudar.lec.id);
      fichas.push({ tipo: 'reanudar', lecId: o.reanudar.lec.id, restante: o.reanudar.restante || null });
    } else {
      const leidas = lecs.filter(l => comp.has(l.id) && tiene(l.idea_clave));
      const r = elegir(leidas);
      if (r) fichas.push({ tipo: 'recuerda', lecId: r.id });
    }

    // 2–3 · Ideas de lo que toca leer: preparan la lectura
    const sig = o.siguiente && !usadas.has(o.siguiente.id) ? o.siguiente : null;
    if (sig) { usadas.add(sig.id); fichas.push({ tipo: 'idea', lecId: sig.id, siguiente: true }); }
    const delMismo = sig
      ? lecs.filter(l => l.libro_id === sig.libro_id && !comp.has(l.id) && (l.orden || 0) > (sig.orden || 0) && tiene(l.idea_clave))
          .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      : [];
    const sinLeer = lecs.filter(l => !comp.has(l.id) && tiene(l.idea_clave));
    while (fichas.filter(f => f.tipo === 'idea').length < 2) {
      const l = (delMismo.length && !usadas.has(delMismo[0].id)) ? delMismo.shift() : elegir(sinLeer);
      if (!l) break;
      usadas.add(l.id);
      fichas.push({ tipo: 'idea', lecId: l.id });
    }

    // 4 · Un matiz (autocorrección) o una cita, mejor de algo ya leído
    const base = lecs.filter(l => comp.has(l.id));
    const fuente = base.length ? base : lecs;
    const conMatiz = fuente.filter(l => tiene(l.autocorreccion, 60));
    const conCita = fuente.filter(l => tiene(l.cita_memorable, 15));
    const m = rnd() < 0.5 ? (elegir(conMatiz) || elegir(conCita)) : (elegir(conCita) || elegir(conMatiz));
    if (m) {
      const puedeMatiz = conMatiz.includes(m), puedeCita = conCita.includes(m);
      const tipo = puedeMatiz && puedeCita ? (rnd() < 0.5 ? 'matiz' : 'cita') : (puedeMatiz ? 'matiz' : 'cita');
      fichas.push({ tipo, lecId: m.id });
    }

    // 5 · Cierre con una sola oferta de subir (la lección que toca, o la primera idea del mazo)
    const oferta = (o.reanudar && o.reanudar.lec) ? o.reanudar.lec.id
      : (sig ? sig.id : (fichas.find(f => f.tipo === 'idea') || {}).lecId || null);
    fichas.push({ tipo: 'cierre', lecId: oferta });
    return fichas.slice(0, TAM);
  }

  return { TAM, REABRIR_MS, RECORDAR_MS, azar, semillaDe, extracto, decidirReanudar, minutosRestantes, componer };
});
