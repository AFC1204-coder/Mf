/**
 * Perfil — qué quieres entrenar, cuánto tiempo y cuántos días a la semana.
 * Lógica pura del onboarding: de tres respuestas sale una ruta recomendada.
 *
 * UMD: window.Perfil en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Perfil = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** `rutas`: ids de Didactica.RUTAS por orden de preferencia. */
  const OBJETIVOS = [
    { id: 'decidir',   etiqueta: 'Decidir mejor',          rutas: ['pensar', 'riesgo'] },
    { id: 'gente',     etiqueta: 'Entender a la gente',    rutas: ['influencia'] },
    { id: 'economia',  etiqueta: 'Pensar en economía',     rutas: ['economia', 'dinero'] },
    { id: 'emociones', etiqueta: 'Gestionar emociones',    rutas: ['emociones', 'sentido'] },
    { id: 'historia',  etiqueta: 'Entender la historia',   rutas: ['instituciones', 'estrategia'] },
    { id: 'explorar',  etiqueta: 'Solo explorar',          rutas: [] }
  ];

  const TIEMPOS = [
    { min: 3,  etiqueta: '3 min',  sub: 'Lo esencial: 2 minutos y recordar' },
    { min: 7,  etiqueta: '7 min',  sub: 'Recordar, leer y llevarte una acción' },
    { min: 15, etiqueta: '15 min', sub: 'Lectura completa y algo más' }
  ];

  const DIAS = [
    { dias: 3, etiqueta: '3 días', sub: 'Tranquilo' },
    { dias: 5, etiqueta: '5 días', sub: 'Constante' },
    { dias: 7, etiqueta: 'Todos', sub: 'Cada día' }
  ];

  const objetivo = id => OBJETIVOS.find(o => o.id === id) || null;

  /** Primera ruta preferida del objetivo que esté disponible (publicada); null si no hay. */
  function rutaPara(objetivoId, disponibles) {
    const o = objetivo(objetivoId);
    if (!o) return null;
    const ok = new Set(disponibles || []);
    return o.rutas.find(r => ok.has(r)) || null;
  }

  /** Modo de lectura por defecto según el tiempo disponible. */
  function modoPara(minutos) {
    return minutos >= 15 ? 'completa' : 'corta';
  }

  function crear(r, disponibles) {
    r = r || {};
    const dias = [3, 5, 7].includes(r.dias) ? r.dias : 5;
    const minutos = [3, 7, 15].includes(r.minutos) ? r.minutos : 7;
    return {
      objetivo: objetivo(r.objetivo) ? r.objetivo : 'explorar',
      minutos,
      dias,
      ruta: rutaPara(r.objetivo, disponibles),
      modo: modoPara(minutos),
      ts: r.ts || null
    };
  }

  /** ¿Es un perfil completo (no un «ahora no»)? */
  function completo(p) {
    return !!(p && p.objetivo && p.dias && p.minutos);
  }

  return { OBJETIVOS, TIEMPOS, DIAS, objetivo, rutaPara, modoPara, crear, completo };
});
