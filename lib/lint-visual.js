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
  const L = 'a-zñáéíóúü';  // \b no sirve con letras acentuadas: «seleccionó» no es una falta
  const SIN_TILDE = new RegExp('(?<![' + L + '])(?:[' + L + ']{3,}(?:cion|sion)|tambien|ademas|despues|analisis|sintesis|hipotesis|metodo|numero|logica|economica|psicologica|critica|publico|unico|ultimo|tipico|basico|practico|teorico|historico)(?![' + L + '])', 'i');
  const SOSPECHA_ENE = new RegExp('(?<![' + L + '])(?:ano|anos|diseno|disenar|espanol|ensenanza|companero|pequeno|montana|cana|sueno|dueno)(?![' + L + '])', 'i');

  const cadenas = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(x => cadenas(x, out));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => cadenas(x, out));
    return out;
  };

  function revisarTextos(spec, err) {
    const permitidas = new Set(spec && spec.plantilla === 'formula' && spec.datos ? (spec.datos.lineas || []).map(String) : []);
    // el nombre de la plantilla y el tipo son identificadores, no texto de la figura (p. ej. «posicion» no lleva tilde)
    const { plantilla, tipo, ...texto } = spec || {};
    cadenas(texto).forEach(s => {
      if (SIN_TILDE.test(s)) err.push(`posible falta de tilde: «${s}»`);
      if (SOSPECHA_ENE.test(s)) err.push(`posible ñ perdida: «${s}»`);
      if (/\s{2,}|^\s|\s$/.test(s)) err.push(`espacios sobrantes: «${s}»`);
      if (/[<>]/.test(s) && !permitidas.has(s)) err.push(`caracteres no permitidos: «${s}»`);
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
    },
    grafica(d, err) {
      ['xmin', 'xmax', 'ymin', 'ymax'].forEach(k => { if (typeof d[k] !== 'number' || !isFinite(d[k])) err.push(`${k} debe ser un número`); });
      if (d.xmax <= d.xmin) err.push('xmax debe ser mayor que xmin');
      if (d.ymax <= d.ymin) err.push('ymax debe ser mayor que ymin');
      if (!d.ejeX || !d.ejeY) err.push('faltan ejeX / ejeY (qué se mide en cada eje)');
      largo(d.ejeX, 28, 'ejeX', err); largo(d.ejeY, 28, 'ejeY', err);
      const S = d.series || []; rango(S.length, 1, 3, 'series', err);
      S.forEach((x, i) => {
        largo(x.t, 24, `nombre de la serie ${i + 1}`, err);
        if (x.f !== undefined) {
          const f = Diagrama.compilar(x.f);
          if (!f) { err.push(`serie ${i + 1}: la expresión «${x.f}» no es válida (solo x, números, + - * / ^, paréntesis, pi, e y sqrt exp ln log10 log2 abs sin cos tan min max)`); return; }
          let validos = 0, dentro = 0;
          for (let k = 0; k <= 60; k++) { const v = f(d.xmin + (d.xmax - d.xmin) * k / 60); if (isFinite(v)) { validos++; if (v >= d.ymin && v <= d.ymax) dentro++; } }
          if (validos < 40) err.push(`serie ${i + 1}: la expresión no está definida en casi todo el rango`);
          else if (dentro < 20) err.push(`serie ${i + 1}: la curva casi no entra en el rango de y (ajusta ymin/ymax)`);
        } else if (!Array.isArray(x.puntos) || x.puntos.length < 2 || x.puntos.length > 40 || x.puntos.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => typeof v !== 'number' || !isFinite(v)))) err.push(`serie ${i + 1}: usa f (expresión) o puntos [[x,y],…] (2–40)`);
      });
      (d.puntos || []).forEach((p, i) => { largo(p.t, 36, `punto ${i + 1}`, err); if (typeof p.x !== 'number' || typeof p.y !== 'number') err.push(`punto ${i + 1}: x e y deben ser números`); });
      rango((d.puntos || []).length, 0, 5, 'puntos señalados', err);
      (d.zonas || []).forEach((z, i) => largo(z.t, 20, `zona ${i + 1}`, err));
      (d.lineas || []).forEach((z, i) => largo(z.t, 20, `línea ${i + 1}`, err));
    },
    barras(d, err) {
      const it = d.items || []; rango(it.length, 2, 8, 'barras', err);
      it.forEach((x, i) => { largo(x.t, 44, `barra ${i + 1}`, err); if (!x.t) err.push(`barra ${i + 1} sin nombre`); if (typeof x.v !== 'number' || !isFinite(x.v)) err.push(`barra ${i + 1}: el valor debe ser un número`); });
      largo(d.unidad, 6, 'unidad', err);
      if (d.ref) largo(d.ref.t, 24, 'línea de referencia', err);
    },
    formula(d, err) {
      const l = d.lineas || []; rango(l.length, 1, 3, 'líneas de la fórmula', err);
      l.forEach((x, i) => { largo(String(x), 44, `línea ${i + 1}`, err); });
      const t = d.terminos || []; rango(t.length, 0, 6, 'términos', err);
      t.forEach((x, i) => { if (!x.s || String(x.s).length > 4) err.push(`término ${i + 1}: el símbolo debe tener 1–4 caracteres`); largo(x.t, MAX_D, `significado del término ${i + 1}`, err); });
      largo(d.nota, MAX_D, 'nota', err);
    },
    tabla(d, err) {
      const c = d.cols || [], f = d.filas || [];
      rango(c.length, 2, 4, 'columnas', err); rango(f.length, 1, 5, 'filas', err);
      c.forEach((x, i) => largo(x, 22, `columna ${i + 1}`, err));
      f.forEach((x, i) => {
        largo(x.t, 28, `fila ${i + 1}`, err);
        if (!Array.isArray(x.c) || x.c.length !== c.length) err.push(`fila ${i + 1}: debe tener ${c.length} celdas`);
        else x.c.forEach((v, j) => largo(String(v), 30, `celda ${i + 1}.${j + 1}`, err));
      });
      (d.resaltar || []).forEach((p, i) => { if (!Array.isArray(p) || !(p[0] >= 0 && p[0] < f.length) || !(p[1] >= 0 && p[1] < c.length)) err.push(`resaltado ${i + 1} fuera de la tabla`); });
    },
    arbol(d, err) {
      largo(d.raiz, 30, 'raíz', err); if (!d.raiz) err.push('falta la raíz');
      const r = d.ramas || []; rango(r.length, 2, 4, 'ramas', err);
      let hojas = 0;
      r.forEach((x, i) => {
        largo(x.t, 12, `etiqueta de la rama ${i + 1}`, err); largo(x.n, 36, `nodo ${i + 1}`, err);
        const h = x.ramas || []; hojas += Math.max(1, h.length);
        rango(h.length, 0, 3, `subramas de la rama ${i + 1}`, err);
        h.forEach((y, k) => { largo(y.t, 12, `etiqueta ${i + 1}.${k + 1}`, err); largo(y.n, 36, `nodo ${i + 1}.${k + 1}`, err); });
      });
      if (hojas > 8) err.push(`demasiadas hojas (${hojas} > 8)`);
    },
    venn(d, err) {
      const c = d.conjuntos || []; rango(c.length, 2, 3, 'conjuntos', err);
      c.forEach((x, i) => { largo(x.t, 24, `conjunto ${i + 1}`, err); largo(x.d, MAX_D, `descripción del conjunto ${i + 1}`, err); });
      largo(d.centro, 20, 'zona común', err);
    },
    bucle(d, err) {
      const n = d.nodos || []; rango(n.length, 3, 5, 'nodos', err);
      n.forEach((x, i) => largo(x.t, 28, `nodo ${i + 1}`, err));
      const s = d.signos || [];
      if (s.length !== n.length) err.push(`signos: debe haber uno por flecha (${n.length}), hay ${s.length}`);
      s.forEach((x, i) => { if (!/^[+\-−–]$/.test(String(x).trim())) err.push(`signo ${i + 1}: «${x}» (solo + o −)`); });
      largo(d.nombre, 24, 'nombre del bucle', err);
    },
    embudo(d, err) {
      const e = d.etapas || []; rango(e.length, 3, 5, 'etapas', err);
      e.forEach((x, i) => { largo(x.t, MAX_T, `etapa ${i + 1}`, err); largo(x.d, MAX_D, `descripción de la etapa ${i + 1}`, err); if (!x.t) err.push(`etapa ${i + 1} sin título`); });
      const con = e.filter(x => x.v != null && String(x.v) !== '');
      if (con.length && con.length !== e.length) err.push('si una etapa lleva cifra, todas deben llevarla');
      con.forEach((x, i) => { if (!/\d/.test(String(x.v))) err.push(`cifra ${i + 1} sin dígitos: «${x.v}» (debe ser un número de la lección)`); largo(String(x.v), 12, `cifra ${i + 1}`, err); });
      const nums = con.map(x => Number(String(x.v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')));
      if (nums.length === e.length && nums.every(Number.isFinite) && nums.some((v, i) => i && v > nums[i - 1])) err.push('un embudo no puede crecer: las cifras deben ir bajando (si no, usa «barras»)');
      largo(d.unidad, 12, 'unidad', err);
    },
    escalera(d, err) {
      const e = d.escalones || []; rango(e.length, 3, 6, 'escalones', err);
      e.forEach((x, i) => { largo(x.t, MAX_T, `escalón ${i + 1}`, err); largo(x.d, MAX_D, `descripción del escalón ${i + 1}`, err); if (!x.t) err.push(`escalón ${i + 1} sin título`); });
    },
    flujo(d, err) {
      const q = d.decisiones || []; rango(q.length, 1, 4, 'decisiones', err);
      q.forEach((x, i) => {
        largo(x.p, 70, `pregunta ${i + 1}`, err); largo(x.no, 60, `salida «no» ${i + 1}`, err);
        if (!/\?$/.test(String(x.p || '').trim())) err.push(`pregunta ${i + 1}: debe ser una pregunta de sí o no, acabada en «?»`);
        if (!x.no) err.push(`decisión ${i + 1} sin salida «no»`);
      });
      if (!d.final || !d.final.t) err.push('falta el resultado final'); else { largo(d.final.t, MAX_T, 'resultado final', err); largo(d.final.d, MAX_D, 'descripción del resultado', err); }
      largo(d.inicio, 60, 'inicio', err);
    },
    capas(d, err) {
      const c = d.capas || []; rango(c.length, 2, 4, 'capas', err);
      c.forEach((x, i) => { largo(x.t, MAX_T, `capa ${i + 1}`, err); largo(x.d, MAX_D, `descripción de la capa ${i + 1}`, err); if (!x.t) err.push(`capa ${i + 1} sin título`); });
    },
    iceberg(d, err) {
      rango((d.visibles || []).length, 1, 3, 'elementos visibles', err); rango((d.ocultos || []).length, 2, 5, 'elementos ocultos', err);
      (d.visibles || []).concat(d.ocultos || []).forEach((x, i) => { largo(x.t, MAX_T, `elemento ${i + 1}`, err); largo(x.d, MAX_D, `descripción del elemento ${i + 1}`, err); if (!x.t) err.push(`elemento ${i + 1} sin título`); });
      largo(d.etiquetaVisible, 14, 'etiqueta superior', err); largo(d.etiquetaOculto, 14, 'etiqueta inferior', err);
    },
    fuerzas(d, err) {
      if (!d.estado || !d.estado.t) err.push('falta el estado central'); else { largo(d.estado.t, 28, 'estado', err); largo(d.estado.d, 60, 'descripción del estado', err); }
      ['impulsan', 'frenan'].forEach(k => {
        const a = d[k] || []; rango(a.length, 1, 4, `fuerzas que ${k === 'impulsan' ? 'impulsan' : 'frenan'}`, err);
        a.forEach((x, i) => { largo(x.t, 40, `${k} ${i + 1}`, err); largo(x.d, 60, `descripción de ${k} ${i + 1}`, err); if (!x.t) err.push(`${k} ${i + 1} sin texto`); });
      });
      largo(d.etiquetaImpulsan, 20, 'etiqueta izquierda', err); largo(d.etiquetaFrenan, 20, 'etiqueta derecha', err);
    },
    red(d, err) {
      const n = d.nodos || [], r = d.relaciones || [];
      rango(n.length, 3, 6, 'nodos', err); rango(r.length, 1, 8, 'relaciones', err);
      n.forEach((x, i) => largo(x.t, 32, `nodo ${i + 1}`, err));
      const usados = new Set();
      r.forEach((x, i) => {
        if (!Number.isInteger(x.de) || !Number.isInteger(x.a) || x.de < 0 || x.a < 0 || x.de >= n.length || x.a >= n.length) err.push(`relación ${i + 1}: de/a deben ser índices de nodos (0–${n.length - 1})`);
        else if (x.de === x.a) err.push(`relación ${i + 1}: un nodo no se relaciona consigo mismo`);
        else { usados.add(x.de); usados.add(x.a); }
        if (!x.t) err.push(`relación ${i + 1} sin etiqueta (di qué relación es)`);
        largo(x.t, 14, `etiqueta de la relación ${i + 1}`, err);
      });
      n.forEach((x, i) => { if (!usados.has(i)) err.push(`el nodo ${i + 1} («${x.t}») no tiene ninguna relación`); });
    },
    reparto(d, err) {
      const p = d.partes || []; rango(p.length, 2, 6, 'partes', err);
      p.forEach((x, i) => {
        largo(x.t, 28, `parte ${i + 1}`, err); largo(x.d, 60, `descripción de la parte ${i + 1}`, err);
        if (!x.t) err.push(`parte ${i + 1} sin nombre`);
        if (typeof x.v !== 'number' || !isFinite(x.v) || x.v <= 0) err.push(`parte ${i + 1}: el valor debe ser un número positivo`);
      });
      largo(d.unidad, 6, 'unidad', err);
      const suma = p.reduce((s, x) => s + (typeof x.v === 'number' ? x.v : 0), 0);
      if (d.unidad === '%' && suma > 100.0001) err.push(`las partes suman ${suma} % (más de 100)`);
      if (d.total !== undefined && (typeof d.total !== 'number' || d.total < suma)) err.push('el total debe ser un número no menor que la suma de las partes');
      if (!/lecci|dato|seg[uú]n|c[aá]lcul/i.test(d.__pie || '')) { /* el pie lo comprueba diagrama() */ }
    },
    jerarquia(d, err) {
      largo(d.raiz, 40, 'raíz', err); if (!d.raiz) err.push('falta la raíz');
      const r = d.ramas || []; rango(r.length, 2, 4, 'ramas', err);
      let hijos = 0;
      r.forEach((x, i) => {
        largo(x.t, 32, `rama ${i + 1}`, err); if (!x.t) err.push(`rama ${i + 1} sin nombre`);
        const h = x.hijos || []; hijos += h.length; rango(h.length, 0, 4, `elementos de la rama ${i + 1}`, err);
        h.forEach((y, k) => { largo(y.t, 40, `elemento ${i + 1}.${k + 1}`, err); largo(y.d, 60, `descripción ${i + 1}.${k + 1}`, err); });
      });
      if (hijos > 10) err.push(`demasiados elementos (${hijos} > 10)`);
    },
    posicion(d, err) {
      const p = d.puntos || []; rango(p.length, 2, 7, 'puntos', err);
      p.forEach((x, i) => {
        largo(x.t, 26, `punto ${i + 1}`, err);
        ['x', 'y'].forEach(k => { if (typeof x[k] !== 'number' || x[k] < 0 || x[k] > 1) err.push(`punto ${i + 1}: ${k} debe estar entre 0 y 1`); });
      });
      ['ejeX', 'ejeY'].forEach(k => { const e = d[k] || {}; const a = k === 'ejeX' ? ['izq', 'der'] : ['abajo', 'arriba']; a.forEach(z => { if (!e[z]) err.push(`falta ${k}.${z}`); largo(e[z], 22, `${k}.${z}`, err); }); });
    },
    recta(d, err) {
      if (typeof d.min !== 'number' || typeof d.max !== 'number' || d.max <= d.min) err.push('min y max deben ser números con max > min');
      const m = d.marcas || []; rango(m.length, 2, 6, 'marcas', err);
      m.forEach((x, i) => { largo(x.t, 26, `marca ${i + 1}`, err); if (typeof x.x !== 'number' || x.x < d.min || x.x > d.max) err.push(`marca ${i + 1} fuera del rango`); });
      (d.intervalos || []).forEach((x, i) => largo(x.t, 22, `intervalo ${i + 1}`, err));
      rango((d.intervalos || []).length, 0, 3, 'intervalos', err);
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
    if (spec.plantilla === 'grafica' && spec.datos && spec.datos.sinEscala === true && !/ilustrativ|esquem|forma/i.test(spec.pie || '')) err.push('una gráfica sin escala debe decir en el pie que es ilustrativa («Forma ilustrativa…»)');
    if (spec.plantilla === 'posicion' && !/aproximad|ilustrativ|cualitativ/i.test(spec.pie || '')) err.push('una figura de posición debe decir en el pie que la colocación es aproximada o ilustrativa (no es una medida)');
    if (spec.plantilla === 'reparto' && spec.datos && spec.datos.unidad === '%' && (spec.datos.partes || []).reduce((s, x) => s + (typeof x.v === 'number' ? x.v : 0), 0) < 99.9999 && !/resto|calcul|complement/i.test(spec.pie || '')) err.push('si las partes no suman 100 %, el pie debe decir que el resto es un cálculo («el resto es el complemento»)');
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
