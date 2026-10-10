/**
 * Visuales — une los diagramas y mapas guardados en archivos (datos/*.json) con lecciones y libros.
 *
 * Los diagramas de lección y los mapas de libro son *especificaciones* que dibujan lib/diagram.js
 * y lib/mapa.js. Viven en el repositorio, no en la base de datos: se revisan en un PR, se versionan
 * y no hace falta tocar Supabase para corregir un texto.
 *
 * Precedencia en una lección: diagrama de la base de datos (`imagenes_inline`) > diagrama del archivo
 * > SVG antiguo (`imagen_principal`, que solo se usa si no hay ninguno de los anteriores).
 *
 * UMD: window.Visuales en el navegador, module.exports en Node y tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Visuales = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esLista = v => Array.isArray(v) && v.length > 0;

  /** ¿La lección ya trae al menos un diagrama válido en la base de datos? */
  function tieneDiagramaPropio(lec, Diagrama) {
    return !!(Diagrama && Diagrama.deLeccion(lec).length);
  }

  /**
   * Añade a cada lección su diagrama del archivo si la base de datos no tiene ninguno.
   * @returns {number} lecciones a las que se ha añadido un diagrama
   */
  function fusionarDiagramas(lecs, datos, Diagrama) {
    if (!datos || typeof datos !== 'object') return 0;
    let n = 0;
    (lecs || []).forEach(l => {
      const specs = datos[l.id];
      if (!esLista(specs) || tieneDiagramaPropio(l, Diagrama)) return;
      const validas = Diagrama ? specs.filter(s => Diagrama.valido(s)) : specs;
      if (!validas.length) return;
      l.imagenes_inline = validas;
      l.diagrama_de_archivo = true;
      n++;
    });
    return n;
  }

  /** Añade a cada libro su mapa (`libro.mapa`) si el archivo lo trae y es válido. */
  function fusionarMapas(libros, datos, Mapa) {
    if (!datos || typeof datos !== 'object') return 0;
    let n = 0;
    (libros || []).forEach(b => {
      const spec = datos[b.id];
      if (!spec || (Mapa && Mapa.validar(spec).length)) return;
      b.mapa = spec;
      n++;
    });
    return n;
  }

  return { fusionarDiagramas, fusionarMapas, tieneDiagramaPropio };
});
