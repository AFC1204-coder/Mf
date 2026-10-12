/**
 * Reparte la posición de la respuesta correcta de un paquete de libro de forma equilibrada y determinista
 * (el modelo tiende a poner la correcta en A o B). Uso: node tools/libros/barajar.js paquete.json  (reescribe el fichero)
 */
const crypto = require('crypto');
const fs = require('fs');

function barajar(paq) {
  const todas = paq.lecciones.flatMap(l => l.preguntas);
  const hash = (p, k) => crypto.createHash('md5').update(p.texto + '|' + k).digest('hex');
  const orden = todas.map(p => p).sort((a, b) => hash(a, 'pos').localeCompare(hash(b, 'pos')));
  orden.forEach((p, i) => {
    const objetivo = i % 4;
    const corr = p.opciones[p.correcta];
    const otras = p.opciones.filter((_, k) => k !== p.correcta).sort((a, b) => hash(p, a).localeCompare(hash(p, b)));
    p.opciones = [...otras.slice(0, objetivo), corr, ...otras.slice(objetivo)];
    p.correcta = objetivo;
  });
  return paq;
}
module.exports = { barajar };
if (require.main === module) {
  const f = process.argv[2];
  const paq = barajar(JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.writeFileSync(f, JSON.stringify(paq, null, 1));
  console.log('Barajadas', paq.lecciones.reduce((n, l) => n + l.preguntas.length, 0), 'preguntas');
}
