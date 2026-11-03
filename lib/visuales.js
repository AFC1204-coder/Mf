/**
 * Visuales — une los diagramas y mapas guardados en archivos (datos/*.json) con lecciones y libros.
 *
 * Los diagramas de lección y los mapas de libro son *especificaciones* que dibujan lib/diagram.js
 * y lib/mapa.js. Viven en el repositorio, no en la base de datos: se revisan en un PR, se versionan
 * y no hace falta tocar Supabase para corregir un texto.
 *
 * Precedencia en una lección: diagrama de la base de datos (`imagenes_inline`) > diagrama del archivo
 * > SVG antiguo (`imagen_principal`, que solo se usa si no hay ninguno de los anteriores).
 * Excepción: las figuras del archivo con `adicional: true` (gráficas y esquemas de matemática sencilla)
 * se suman siempre a las que la lección ya tenga; no sustituyen a ninguna.
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
      if (!esLista(specs)) return;
      const validas = Diagrama ? specs.filter(s => Diagrama.valido(s)) : specs;
      if (!validas.length) return;
      if (tieneDiagramaPropio(l, Diagrama)) {
        // La lección ya trae diagrama en la base de datos: solo se le suman las figuras marcadas «adicional»
        // (gráficas y esquemas de matemática sencilla), que acompañan al diagrama y no lo sustituyen.
        const extra = validas.filter(s => s && s.adicional === true);
        if (!extra.length) return;
        let propios = l.imagenes_inline;
        if (typeof propios === 'string') { try { propios = JSON.parse(propios); } catch (e) { propios = []; } }
        if (propios && !Array.isArray(propios)) propios = [propios];
        l.imagenes_inline = (propios || []).concat(extra);
        l.diagrama_de_archivo = true;
        n++;
        return;
      }
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

  /** ¿El bloque es un párrafo corrido (no lista, tabla, título ni cita)? Solo detrás de uno así cabe una figura. */
  const esParrafo = p => {
    const t = String(p == null ? '' : p);
    return t.trim().length > 0 && !/^\s*([-*•|#>]|\d+[.)]\s)/.test(t) && !/<table/i.test(t);
  };

  /**
   * Dónde poner las figuras entre los párrafos de una lección. Devuelve, para cada figura, el índice del
   * párrafo detrás del cual va (0 = tras el primero). La primera va tras el primer párrafo (ilustra la idea ya
   * enunciada); las demás se reparten por el resto del texto, cada una tras un párrafo corrido, para que una
   * gráfica acompañe al texto que la explica y no se apilen todas juntas. Si no hay sitio, devuelve menos índices.
   */
  function colocarFiguras(partes, n) {
    const P = Array.isArray(partes) ? partes : [];
    const out = [];
    if (!(n > 0) || P.length < 2 || !esParrafo(P[0])) return out;
    out.push(0);
    const resto = n - 1;
    if (!resto) return out;
    // candidatos: párrafos corridos que no sean el último (la figura no cierra la lección)
    const cand = [];
    for (let i = 1; i < P.length - 1; i++) if (esParrafo(P[i])) cand.push(i);
    for (let k = 1; k <= resto; k++) {
      const ideal = Math.round(k * (P.length - 1) / (resto + 1));
      let mejor = null;
      cand.forEach(i => { if (!out.includes(i) && (mejor === null || Math.abs(i - ideal) < Math.abs(mejor - ideal))) mejor = i; });
      if (mejor !== null) out.push(mejor);
    }
    return out.sort((a, b) => a - b);
  }

  return { fusionarDiagramas, fusionarMapas, tieneDiagramaPropio, colocarFiguras, esParrafo };
});
