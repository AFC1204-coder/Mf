/**
 * Comprueba que lo cargado en la BD es idéntico al paquete (la carga la hace un agente que transcribe SQL).
 *   node tools/libros/huellas.js paquete.json sql        → consulta que calcula las huellas en Supabase
 *   node tools/libros/huellas.js paquete.json esperado   → huellas esperadas (clave hash por línea)
 *   node tools/libros/huellas.js paquete.json comparar resultado.json   → resultado.json = filas {k,h} de la consulta
 */
const crypto = require('crypto');
const fs = require('fs');
const { ids } = require('./a-sql.js');
const md5 = s => crypto.createHash('md5').update(s).digest('hex');

function esperado(paq) {
  const I = ids(paq), out = {};
  paq.lecciones.forEach(l => {
    out['l' + l.orden] = md5([l.cuerpo, l.idea_clave, l.conexion_cruzada, l.autocorreccion, l.aplicacion_practica, l.cita_memorable].join('|'));
    const orden = l.preguntas.map((q, j) => ({ q, id: I.preg(l.orden, j + 1) })).sort((a, b) => (a.id < b.id ? -1 : 1));
    orden.forEach((x, r) => { out['q' + l.orden + '.' + (r + 1)] = md5([x.q.texto, '[' + x.q.opciones.map(o => JSON.stringify(o)).join(', ') + ']', x.q.correcta, x.q.explicacion].join('|')); });
  });
  return out;
}
function sql(paq) {
  const L = ids(paq).libro;
  return `select 'l'||l.orden k, md5(l.cuerpo||'|'||l.idea_clave||'|'||l.conexion_cruzada||'|'||l.autocorreccion||'|'||l.aplicacion_practica||'|'||l.cita_memorable) h from lecciones l where libro_id='${L}'
union all select 'q'||l.orden||'.'||row_number() over (partition by p.leccion_id order by p.id), md5(p.texto||'|'||p.opciones::text||'|'||p.correcta||'|'||p.explicacion) from preguntas p join lecciones l on l.id=p.leccion_id where p.libro_id='${L}' order by 1;`;
}
/** Una sola consulta que devuelve las diferencias (vacío = idéntico), con las huellas esperadas incrustadas. */
function sqlComparar(paq) {
  const e = esperado(paq);
  const vals = Object.entries(e).map(([k, h]) => `('${k}','${h}')`).join(',');
  return `with e(k,h) as (values ${vals}), r as (${sql(paq).replace(/ order by 1;$/, '')}) select coalesce(e.k,r.k) k, e.h esperado, r.h cargado from e full join r on e.k=r.k where e.h is distinct from r.h;`;
}
module.exports = { esperado, sql, sqlComparar };
if (require.main === module) {
  const [, , f, modo, res] = process.argv;
  const paq = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (modo === 'sql') console.log(sql(paq));
  else if (modo === 'comparar-sql') console.log(sqlComparar(paq));
  else if (modo === 'esperado') console.log(JSON.stringify(esperado(paq), null, 1));
  else {
    const e = esperado(paq), r = Object.fromEntries(JSON.parse(fs.readFileSync(res, 'utf8')).map(x => [x.k, x.h]));
    const mal = [...new Set([...Object.keys(e), ...Object.keys(r)])].filter(k => e[k] !== r[k]);
    console.log(mal.length ? 'DIFIEREN: ' + mal.join(', ') : 'IDÉNTICO (' + Object.keys(e).length + ' elementos)');
    process.exit(mal.length ? 1 : 0);
  }
}
