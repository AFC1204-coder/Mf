/**
 * Lint de especificaciones visuales: lo que debe cumplir un diagrama de lección o un mapa de libro
 * antes de guardarse en datos/*.json. Detecta formas rotas, textos largos, faltas de tilde típicas
 * y cifras o fechas sin dígitos (señal de dato inventado o mal puesto).
 *
 * UMD: window.LintVisual en el navegador, module.exports en Node y tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./diagram.js'), require('./mapa.js'));
  else root.LintVisual = factory(root.Diagrama, root.Mapa);
})(typeof self !== 'undefined' ? self : this, function (Diagrama, Mapa) {
  'use strict';

  const MAX_T = 40;      // título de bloque
  const MAX_D = 90;      // descripción
  const MAX_TITULO = 64; // título de la figura
  const MAX_PIE = 130;   // pie
  const MAX_BYTES = 6500;

  // Palabras que casi siempre llevan tilde y se suelen escribir sin ella.
  const SIN_TILDE = /\b(?:[a-zñ]{3,}(?:cion|sion)|tambien|ademas|despues|analisis|sintesis|hipotesis|metodo|numero|logica|economica|psicologica|critica|publico|unico|ultimo|tipico|basico|practico|teorico|historico)\b/i;
  const SOSPECHA_ENE = /\b(?:ano|anos|diseno|disenar|espanol|ensenanza|companero|pequeno|montana|cana|sueno|dueno)\b/i;

  const cadenas = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(x => cadenas(x, out));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => cadenas(x, out));
    return out;
  };

  function revisarTextos(spec, err) {
    cadenas(spec).forEach(s => {
      if (SIN_TILDE.test(s)) err.push(`posible falta de tilde: «${s}»`);
      if (SOSPECHA_ENE.test(s)) err.push(`posible ñ perdida: «${s}»`);
      if (/\s{2,}|^\s|\s$/.test(s)) err.push(`espacios sobrantes: «${s}»`);
      if (/[<>]/.test(s)) err.push(`caracteres no permitidos: «${s}»`);
    });
  }

  const largo = (s, max, que, err) => { if (typeof s === 'string' && s.length > max) err.push(`${que} demasiado largo (${s.length} > ${max}): «${s}»`); };
  const rango = (n, a, b, que, err) => { if (n < a || n > b) err.push(`${que}: ${n} (debe estar entre ${a} y ${b})`); };

  const REGLAS = {
    pasos(d, err) {
      const p = d.pasos || []; rango(p.length, 3, 6, 'pasos', err);
      p.forEach((x, i) => { largo(x.t, MAX_T, `paso ${i + 1}`, err); largo(x.d, MAX_D, `descripción del paso ${i + 1}`, err); if (!x.t) err.push(`paso ${i + 1} sin título`); });
    },
    matriz(d, err) {
      const c = d.celdas || []; rango(c.length, 4, 4, 'celdas', err);
      c.forEach((x, i) => { largo(x.t, MAX_T, `celda ${i + 1}`, err); largo(x.d, MAX_D, `descripción de la celda ${i + 1}`, err); });
      if (!d.ejeX || !d.ejeY) err.push('faltan ejeX / ejeY');
    },
    ciclo(d, err) {
      const n = d.nodos || []; rango(n.length, 3, 6, 'nodos', err);
      n.forEach((x, i) => largo(x.t, MAX_T, `nodo ${i + 1}`, err));
      largo(d.centro, 24, 'centro', err);
    },
    comparar(d, err) {
      ['izq', 'der'].forEach(k => {
        const c = d[k] || {}; rango((c.items || []).length, 2, 5, `elementos de ${k}`, err);
        largo(c.t, 30, `título de ${k}`, err); (c.items || []).forEach(i => largo(i, MAX_D, `elemento de ${k}`, err));
      });
    },
    espectro(d, err) {
      rango((d.polos || []).length, 2, 2, 'polos', err);
      const m = d.marcas || []; rango(m.length, 3, 5, 'marcas', err);
      m.forEach((x, i) => { if (typeof x.pos !== 'number' || x.pos < 0 || x.pos > 1) err.push(`marca ${i + 1}: pos fuera de 0–1`); largo(x.t, MAX_T, `marca ${i + 1}`, err); });
    },
    piramide(d, err) {
      const n = d.niveles || []; rango(n.length, 3, 5, 'niveles', err);
      n.forEach((x, i) => { largo(x.t, MAX_T, `nivel ${i + 1}`, err); largo(x.d, MAX_D, `descripción del nivel ${i + 1}`, err); });
    },
    mapa(d, err) {
      const n = d.nodos || []; rango(n.length, 3, 6, 'nodos', err);
      n.forEach((x, i) => largo(x.t, MAX_T, `nodo ${i + 1}`, err)); largo(d.centro, 30, 'centro', err);
    },
    curva(d, err) {
      rango((d.puntos || []).length, 3, 12, 'puntos', err); rango((d.etiquetas || []).length, 1, 4, 'etiquetas', err);
      (d.puntos || []).forEach((p, i) => { if (!Array.isArray(p) || p.some(v => typeof v !== 'number' || v < 0 || v > 1)) err.push(`punto ${i + 1} fuera de 0–1`); });
    },
    cifras(d, err) {
      const it = d.items || []; rango(it.length, 1, 6, 'cifras', err);
      it.forEach((x, i) => { if (!/\d/.test(String(x.n))) err.push(`cifra ${i + 1} sin dígitos: «${x.n}» (una cifra debe ser un número del texto)`); largo(x.t, MAX_D, `cifra ${i + 1}`, err); });
    },
    tiempo(d, err) {
      const e = d.eventos || []; rango(e.length, 2, 7, 'eventos', err);
      e.forEach((x, i) => { if (!/\d/.test(String(x.f))) err.push(`fecha ${i + 1} sin dígitos: «${x.f}»`); largo(x.t, MAX_D, `evento ${i + 1}`, err); });
    }
  };

  /** Errores de un diagrama de lección ([] = bueno). */
  function diagrama(spec) {
    const err = [];
    if (!Diagrama.valido(spec)) return ['no es un diagrama válido (tipo, plantilla o datos)'];
    if (!spec.titulo) err.push('falta el título');
    largo(spec.titulo, MAX_TITULO, 'título', err);
    if (!spec.pie) err.push('falta el pie');
    largo(spec.pie, MAX_PIE, 'pie', err);
    (REGLAS[spec.plantilla] || (() => {}))(spec.datos, err);
    revisarTextos(spec, err);
    const s = Diagrama.svg(spec);
    if (!s) err.push('la plantilla no puede dibujar estos datos');
    else if (Buffer.byteLength ? Buffer.byteLength(s) > MAX_BYTES : s.length > MAX_BYTES) err.push('el SVG pesa demasiado');
    return err;
  }

  /** Errores de un mapa de libro. */
  function mapa(spec) {
    const err = Mapa.validar(spec);
    if (spec && !err.length) revisarTextos(spec, err);
    return err;
  }

  return { diagrama, mapa, MAX_T, MAX_D, MAX_PIE };
});
