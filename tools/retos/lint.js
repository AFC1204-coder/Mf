#!/usr/bin/env node
/**
 * Lint de retos de pensamiento (docs/retos-pensamiento.md). Comprueba lo que se puede comprobar sin criterio:
 * forma, longitud, tipo, que un «choque» enfrente a otro autor y que nada pregunte «qué dice el autor».
 * La calidad de fondo (que el reto haga pensar y salga de la lección) la juzga un verificador independiente.
 *   node tools/retos/lint.js retos.json
 * Formato: [{ leccion_id, tipo, texto, leccion_contraste_id, justificacion }]
 */
'use strict';
const fs = require('fs');

const TIPOS = ['predecir', 'primeros_principios', 'choque', 'otra_cara', 'vida_real'];
const MIN = 40, MAX = 700;      // coincide con el CHECK de la tabla retos

// Preguntas que se contestan copiando el texto o sin pensar
const PROHIBIDAS = [
  /\bseg[uú]n el autor\b/i, /\bqu[eé] (dice|afirma|sostiene|propone|defiende|plantea|explica) (el|la|\w+)\b/i,
  /\bcu[aá]l es la idea (central|principal|clave)\b/i, /\bresume\b/i, /\bexplica con tus palabras (lo que|qu[eé])\b/i,
  /\bseg[uú]n la lecci[oó]n\b/i, /\bqu[eé] significa\b/i, /\bdefine\b/i, /\bcita\b/i, /\bcu[aá]ntos?\b.*\b(menciona|cita|propone)\b/i,
  /\bverdadero o falso\b/i, /\bcu[aá]l de las siguientes\b/i
];
const TIEMPO = /(30 d[ií]as|pr[oó]ximas? (semanas?|d[ií]as|cuatro semanas)|este mes|un mes|esta semana|hoy|en un mes|dentro de un mes)/i;

function revisar(retos, { lecciones } = {}) {
  const err = [];
  const vistos = new Set();
  (Array.isArray(retos) ? retos : []).forEach((r, i) => {
    const e = m => err.push(`reto ${i + 1} (${String(r && r.leccion_id || '').slice(0, 8)}): ${m}`);
    if (!r || typeof r !== 'object') return e('no es un objeto');
    if (!r.leccion_id) e('falta leccion_id');
    if (vistos.has(r.leccion_id)) e('hay dos retos para la misma lección (solo uno por lección)');
    vistos.add(r.leccion_id);
    if (!TIPOS.includes(r.tipo)) e(`tipo no válido «${r.tipo}» (${TIPOS.join(' · ')})`);
    const t = String(r.texto || '');
    if (t.length < MIN || t.length > MAX) e(`texto de ${t.length} caracteres (debe tener entre ${MIN} y ${MAX})`);
    if (!/[?¿]/.test(t)) e('un reto debe plantear una pregunta');
    if ((t.match(/¿/g) || []).length > 3) e('demasiadas preguntas en un solo reto (máximo 3)');
    if (/\s{2,}|^\s|\s$/.test(t)) e('espacios sobrantes');
    PROHIBIDAS.forEach(re => { if (re.test(t)) e(`pregunta que se contesta copiando el texto o sin pensar (${re}): «${t.slice(0, 80)}…»`); });
    if (r.tipo === 'choque') {
      if (!r.leccion_contraste_id) e('un «choque» necesita leccion_contraste_id');
      else if (r.leccion_contraste_id === r.leccion_id) e('el contraste no puede ser la misma lección');
    } else if (r.leccion_contraste_id) e('solo el «choque» lleva leccion_contraste_id');
    if (r.tipo === 'predecir' && !TIEMPO.test(t)) e('una predicción debe poder comprobarse en unas semanas: indica el plazo (p. ej. «en los próximos 30 días»)');
    if (r.tipo === 'vida_real' && !/(semana|d[ií]a|hoy|ayer|recientemente)/i.test(t)) e('«detectar en la vida real» debe anclarse en algo reciente (esta semana, hoy…)');
    if (r.tipo === 'otra_cara' && !/(contra|falla|objeci|refut|l[ií]mite|cu[aá]ndo (no|deja)|no se cumple|r[eé]plica|contraejemplo)/i.test(t)) e('«la otra cara» debe pedir el mejor argumento en contra o dónde falla');
    if (r.tipo === 'primeros_principios' && !/(supuesto|premisa|base|parte de|se sostiene|quitas|quitar|sin eso|asum)/i.test(t)) e('«primeros principios» debe preguntar por el supuesto básico y si se sostiene sin él');
    if (!r.justificacion || String(r.justificacion).length < 30) e('falta la justificación (por qué este tipo para esta lección)');
    if (lecciones && !lecciones.has(r.leccion_id)) e('la lección no existe o no está activa');
    if (lecciones && r.leccion_contraste_id && !lecciones.has(r.leccion_contraste_id)) e('la lección de contraste no existe o no está activa');
  });
  return err;
}

module.exports = { revisar, TIPOS, MIN, MAX };

if (require.main === module) {
  const f = process.argv[2];
  if (!f) { console.error('Uso: node tools/retos/lint.js retos.json'); process.exit(2); }
  const err = revisar(JSON.parse(fs.readFileSync(f, 'utf8')));
  if (err.length) { err.forEach(x => console.log('✗ ' + x)); process.exit(1); }
  console.log('OK');
}
