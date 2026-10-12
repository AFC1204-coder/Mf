/**
 * Paquete de libro (ya verificado) → SQL en dos pasos.
 *   alta:      inserta libro, lecciones y preguntas ocultos (publico=false / activa=false).
 *   publicar:  los muestra (publico=true / activa=true) y fija la fecha de alta de hoy, para la etiqueta «Nuevo».
 *
 * Uso:  node tools/libros/a-sql.js paquete.json alta|publicar > salida.sql
 */
const crypto = require('crypto');
const q = s => (s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");
const arr = a => (a && a.length ? 'array[' + a.map(q).join(',') + ']::text[]' : 'null');

function ids(paq) {
  // ids deterministas a partir del autor+título: repetir el alta no duplica nada
  const h = s => { const x = crypto.createHash('md5').update(s).digest('hex'); return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`; };
  const base = paq.libro.autor + '|' + paq.libro.titulo;
  return { libro: h(base), lec: n => h(base + '|l' + n), preg: (n, j) => h(base + '|l' + n + '|p' + j) };
}

function alta(paq) {
  const I = ids(paq), L = paq.libro, s = [];
  s.push('begin;');
  s.push(`insert into libros (id, autor, titulo, eje, eje_principal, sub_eje, descripcion_breve, "año", publico) values (${q(I.libro)}, ${q(L.autor)}, ${q(L.titulo)}, ${q(L.eje || L.sub_eje)}, ${q(L.eje_principal)}, ${q(L.sub_eje)}, ${q(L.descripcion_breve)}, ${L.año}, false) on conflict (id) do nothing;`);
  paq.lecciones.forEach(l => {
    s.push(`insert into lecciones (id, libro_id, titulo, cuerpo, idea_clave, conexion_cruzada, autocorreccion, aplicacion_practica, autores_relacionados, cita_memorable, dominio_aplicacion, orden, activa) values (${q(I.lec(l.orden))}, ${q(I.libro)}, ${q(l.titulo)}, ${q(l.cuerpo)}, ${q(l.idea_clave)}, ${q(l.conexion_cruzada)}, ${q(l.autocorreccion)}, ${q(l.aplicacion_practica)}, ${arr(l.autores_relacionados)}, ${q(l.cita_memorable)}, ${arr(l.dominio_aplicacion)}, ${l.orden}, false) on conflict (id) do nothing;`);
    l.preguntas.forEach((p, j) => {
      s.push(`insert into preguntas (id, libro_id, leccion_id, eje, texto, opciones, correcta, explicacion, dificultad, activa) values (${q(I.preg(l.orden, j + 1))}, ${q(I.libro)}, ${q(I.lec(l.orden))}, ${q(L.eje_principal)}, ${q(p.texto)}, ${q(JSON.stringify(p.opciones))}::jsonb, ${p.correcta}, ${q(p.explicacion)}, ${p.dificultad}, false) on conflict (id) do nothing;`);
    });
  });
  s.push('commit;');
  return s.join('\n') + '\n';
}

function publicar(paq) {
  const I = ids(paq);
  return `begin;
update libros set publico=true, fecha_creacion=now() where id=${q(I.libro)};
update lecciones set activa=true where libro_id=${q(I.libro)};
update preguntas set activa=true where libro_id=${q(I.libro)};
commit;
`;
}

module.exports = { alta, publicar, ids };

if (require.main === module) {
  const [, , f, modo] = process.argv;
  const paq = JSON.parse(require('fs').readFileSync(f, 'utf8'));
  process.stdout.write(modo === 'publicar' ? publicar(paq) : alta(paq));
}
