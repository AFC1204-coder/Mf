/**
 * Puerta de calidad para la incorporación autónoma de libros (docs/libros-preceptos.md).
 * Decide, SIN juicio libre, si un paquete puede pasar al siguiente paso: cargarse como borrador oculto o publicarse.
 * Devuelve { veredicto: 'publicar' | 'revisar' | 'rechazar' | 'esperar', motivos: [...] }.
 *   publicar  → cumple todos los preceptos para esta fase;
 *   revisar   → hay algo que una persona debe mirar (riesgo, confianza baja, avisos…); no se publica solo;
 *   rechazar  → no cumple lo mínimo (lint, duplicado, verificador lo rechaza…);
 *   esperar   → hoy no toca (tope semanal, demasiados avisos abiertos).
 *
 * Uso:  node tools/libros/puerta.js paquete.json --informes v1.json,v2.json --libros corpus.json
 *         [--fase cargar|publicar] [--huellas-ok] [--publicados-semana N] [--abiertos N] [--autores autores.json]
 * UMD: module.exports en Node/tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lint.js'));
  else root.LibroPuerta = factory(root.LibroLint);
})(typeof self !== 'undefined' ? self : this, function (LibroLint) {
  'use strict';

  const TOPE_SEMANAL = 2;
  const MAX_AVISOS_LINT = 5;
  const MAX_REPORTES_ABIERTOS = 5;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  /** Temas que nunca se publican solos: consejo accionable de salud o de dinero. */
  const RIESGO = {
    salud: /\b(dieta|ayuno|suplement|c[aá]ncer|tratamiento|terapia|medicaci[oó]n|cetog|cura|enfermedad|colesterol|diabetes|vitamina|hormon)/i,
    finanzas: /\b(inversi[oó]n|invertir|trading|bolsa|criptomoneda|opciones financieras|apalanc|especular)/i,
    sexualidad: /\b(sexual|er[oó]tic|orgasm|libido)/i,
  };

  function riesgosDe(p) {
    const texto = [p.libro && p.libro.titulo, p.libro && p.libro.descripcion_breve, ...(p.lecciones || []).map(l => l.titulo)].join(' ');
    return Object.keys(RIESGO).filter(k => RIESGO[k].test(texto));
  }

  function erroresEn(informe) {
    return ((informe && informe.hallazgos) || []).filter(h => String(h.severidad).toUpperCase() === 'ERROR').length;
  }

  function esDuplicado(libro, corpus) {
    const t = norm(libro && libro.titulo), a = norm(libro && libro.autor);
    if (!t) return null;
    for (const b of corpus || []) {
      const bt = norm(b.titulo), ba = norm(b.autor);
      if (!bt) continue;
      const mismoTitulo = bt === t || (t.length >= 8 && (bt.startsWith(t) || t.startsWith(bt)));
      const mismoAutor = !a || !ba || ba.includes(a.split(' ').pop()) || a.includes(ba.split(' ').pop());
      if (mismoTitulo && mismoAutor) return b.titulo;
    }
    return null;
  }

  /**
   * p = paquete; o = { informes: [informe…] (de más antiguo a más reciente), corpus: [{titulo,autor}], autores: [...],
   *   fase: 'cargar'|'publicar', huellasOk: bool, publicadosSemana: n, reportesAbiertos: n }
   */
  function evaluar(p, o) {
    o = o || {};
    const fase = o.fase === 'publicar' ? 'publicar' : 'cargar';
    const rechazos = [], revisar = [], esperar = [];

    // Tope y avisos pendientes: hoy no toca
    if ((o.publicadosSemana || 0) >= TOPE_SEMANAL) esperar.push(`tope semanal alcanzado (${o.publicadosSemana} de ${TOPE_SEMANAL} publicados por la rutina en 7 días)`);
    if ((o.reportesAbiertos || 0) > MAX_REPORTES_ABIERTOS) esperar.push(`hay ${o.reportesAbiertos} avisos «¿Algo no cuadra?» abiertos (máximo ${MAX_REPORTES_ABIERTOS}): atenderlos primero`);

    // 1 · Forma (lint determinista)
    const lint = LibroLint.lint(p, o.autores || []);
    lint.errores.forEach(e => rechazos.push('lint: ' + e));
    if (lint.avisos.length > MAX_AVISOS_LINT) revisar.push(`lint: ${lint.avisos.length} avisos (máximo ${MAX_AVISOS_LINT} sin revisar)`);

    // 2 · No duplicar
    const dup = esDuplicado(p.libro, o.corpus);
    if (dup) rechazos.push(`ya existe en la biblioteca: «${dup}»`);

    // 3 · Honestidad sobre lo que se sabe del libro
    const conf = String(p.confianza || '').toLowerCase();
    if (!['alta', 'media', 'baja'].includes(conf)) rechazos.push('el paquete no declara su confianza (alta | media | baja)');
    if (conf === 'baja') revisar.push('confianza baja: el generador no domina el libro');

    // 4 · Verificación independiente
    const inf = o.informes || [];
    if (!inf.length) rechazos.push('falta la verificación independiente');
    else {
      const ult = inf[inf.length - 1];
      const ver = String(ult.veredicto || '').toLowerCase();
      if (ver === 'rechazar') rechazos.push('el verificador rechaza el libro');
      if (erroresEn(ult) > 0) rechazos.push(`el último informe aún tiene ${erroresEn(ult)} ERROR sin resolver`);
      const huboError = inf.slice(0, -1).some(i => erroresEn(i) > 0);
      if (huboError && inf.length < 2) rechazos.push('hubo ERROR de contenido: hace falta una segunda verificación sobre el texto corregido');
      if (inf.length === 1 && erroresEn(inf[0]) > 0) rechazos.push('hubo ERROR de contenido: hace falta una segunda verificación sobre el texto corregido');
      if (!['publicar', 'corregir', 'rechazar'].includes(ver)) rechazos.push('el último informe no trae un veredicto válido (publicar | corregir | rechazar)');
    }

    // 5 · Temas de riesgo: nunca solos
    const riesgos = riesgosDe(p);
    const declarado = String((p.riesgo && p.riesgo.tipo) || p.riesgo || '').toLowerCase();
    const aviso = riesgos.filter(r => r === 'salud' || r === 'finanzas' || r === 'sexualidad');
    if (aviso.length) revisar.push(`tema de riesgo (${aviso.join(', ')}): requiere visto bueno de una persona`);
    if (declarado && /salud|finanzas|sexual/.test(declarado) && !aviso.length) revisar.push(`el paquete declara riesgo «${declarado}»: requiere visto bueno de una persona`);

    // 6 · Utilidad mínima
    const lecs = p.lecciones || [];
    const conAplicacion = lecs.filter(l => String(l.aplicacion_practica || '').trim().length >= 120).length;
    if (lecs.length && conAplicacion < lecs.length) rechazos.push('todas las lecciones deben traer una aplicación práctica concreta');
    const conCruce = lecs.filter(l => String(l.conexion_cruzada || '').trim().length >= 200).length;
    if (lecs.length && conCruce < Math.ceil(lecs.length / 2)) revisar.push('menos de la mitad de las lecciones conectan con otros autores de la biblioteca');

    // 7 · Antes de publicar: lo cargado coincide con lo verificado
    if (fase === 'publicar' && o.huellasOk !== true) rechazos.push('no se ha comprobado que lo cargado coincide con lo verificado (huellas md5)');

    const motivos = [...rechazos.map(m => 'RECHAZO · ' + m), ...revisar.map(m => 'REVISAR · ' + m), ...esperar.map(m => 'ESPERAR · ' + m)];
    const veredicto = rechazos.length ? 'rechazar' : revisar.length ? 'revisar' : esperar.length ? 'esperar' : 'publicar';
    return { veredicto, motivos, fase, resumen: lint.resumen };
  }

  /**
   * Puntuación de utilidad de un candidato (0–100+): su prioridad, más un empujón si el hueco del eje/sub-eje está poco poblado,
   * menos si es de tema de riesgo. `corpus` = [{eje_principal, sub_eje}] de los libros existentes.
   */
  function puntuar(c, corpus) {
    let s = Number(c.prioridad) || 50;
    const mismo = (corpus || []).filter(b => b.sub_eje && c.sub_eje && b.sub_eje === c.sub_eje).length;
    const total = (corpus || []).length || 1;
    const cuota = mismo / total;                     // 0 = hueco vacío
    s += Math.round(15 * (1 - Math.min(1, cuota * 6)));
    const texto = [c.titulo, c.motivo].join(' ');
    if (Object.values(RIESGO).some(r => r.test(texto))) s -= 30;
    return s;
  }

  /** Elige el siguiente candidato: pendiente, no duplicado, de mayor puntuación (desempata por prioridad y título). */
  function elegirCandidato(cands, corpus) {
    return (cands || [])
      .filter(c => c.estado === 'pendiente' && !esDuplicado(c, corpus))
      .map(c => ({ c, s: puntuar(c, corpus) }))
      .sort((a, b) => b.s - a.s || (b.c.prioridad - a.c.prioridad) || String(a.c.titulo).localeCompare(String(b.c.titulo)))
      .map(x => x.c)[0] || null;
  }

  return { TOPE_SEMANAL, MAX_REPORTES_ABIERTOS, evaluar, puntuar, elegirCandidato, esDuplicado, riesgosDe };
});

if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);
  const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const leer = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const paq = args[0];
  const informes = (val('--informes') || '').split(',').filter(Boolean).map(leer);
  const r = module.exports.evaluar(leer(paq), {
    informes,
    corpus: val('--libros') ? leer(val('--libros')) : [],
    autores: val('--autores') ? leer(val('--autores')) : [],
    fase: val('--fase') || 'cargar',
    huellasOk: args.includes('--huellas-ok'),
    publicadosSemana: Number(val('--publicados-semana') || 0),
    reportesAbiertos: Number(val('--abiertos') || 0),
  });
  console.log(JSON.stringify({ veredicto: r.veredicto, fase: r.fase, resumen: r.resumen }));
  r.motivos.forEach(m => console.log(m));
  process.exit(r.veredicto === 'publicar' ? 0 : 1);
}
