/**
 * «¿Algo no cuadra?» — la parte pura: motivos, validación de la fila y cola de avisos pendientes.
 * El aviso se guarda en `reportes_contenido`; si no hay red se encola y se reintenta después.
 *
 * UMD: window.Reporte en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reporte = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MOTIVOS = {
    pregunta: [
      { id: 'respuesta_mal', etiqueta: 'La respuesta correcta es otra' },
      { id: 'dato_dudoso', etiqueta: 'Un dato o una atribución parece falso' },
      { id: 'no_se_entiende', etiqueta: 'Está ambigua o no se entiende' },
      { id: 'otro', etiqueta: 'Otra cosa' }
    ],
    leccion: [
      { id: 'dato_dudoso', etiqueta: 'Un dato, cita o atribución parece falso' },
      { id: 'no_se_entiende', etiqueta: 'No se entiende o está mal explicado' },
      { id: 'otro', etiqueta: 'Otra cosa' }
    ]
  };
  const NOTA_MAX = 500;
  const COLA_MAX = 50;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** Fila lista para insertar, o null si algo no es válido. */
  function filaReporte(tipo, itemId, motivo, nota) {
    if (!MOTIVOS[tipo] || !UUID.test(String(itemId))) return null;
    if (!MOTIVOS[tipo].some(m => m.id === motivo)) return null;
    const n = String(nota || '').trim().slice(0, NOTA_MAX);
    return { tipo, item_id: String(itemId), motivo, nota: n || null };
  }

  /** Añade a la cola sin duplicar el mismo (tipo, item, motivo) y acotando su tamaño. */
  function encolar(cola, fila) {
    const l = Array.isArray(cola) ? cola.slice() : [];
    if (!fila || l.some(f => f.tipo === fila.tipo && f.item_id === fila.item_id && f.motivo === fila.motivo)) return l;
    l.push(fila);
    return l.slice(-COLA_MAX);
  }

  return { MOTIVOS, NOTA_MAX, COLA_MAX, filaReporte, encolar };
});
