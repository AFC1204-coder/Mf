import { describe, it, expect } from 'vitest';
import R from '../lib/reporte.js';

const ID = '8475b09b-507d-4f33-a781-5df7f9739804';

describe('Reporte · fila', () => {
  it('construye la fila y recorta la nota', () => {
    const f = R.filaReporte('pregunta', ID, 'respuesta_mal', '  ' + 'x'.repeat(900) + '  ');
    expect(f.tipo).toBe('pregunta');
    expect(f.item_id).toBe(ID);
    expect(f.nota.length).toBe(R.NOTA_MAX);
  });
  it('la nota vacía queda en null', () => {
    expect(R.filaReporte('leccion', ID, 'otro', '   ').nota).toBeNull();
  });
  it('rechaza tipo, motivo o id no válidos', () => {
    expect(R.filaReporte('libro', ID, 'otro')).toBeNull();
    expect(R.filaReporte('leccion', ID, 'respuesta_mal')).toBeNull(); // una lección no tiene respuesta
    expect(R.filaReporte('pregunta', 'no-uuid', 'otro')).toBeNull();
  });
});

describe('Reporte · cola', () => {
  const f = R.filaReporte('pregunta', ID, 'otro');
  it('no duplica el mismo aviso', () => {
    expect(R.encolar(R.encolar([], f), f).length).toBe(1);
  });
  it('conserva los más recientes si se llena', () => {
    let c = [];
    for (let i = 0; i < 60; i++) c = R.encolar(c, { ...f, item_id: ID.slice(0, 30) + String(100000 + i).slice(1) });
    expect(c.length).toBe(R.COLA_MAX);
    expect(c[c.length - 1].item_id.endsWith('00059')).toBe(true);
  });
  it('tolera una cola corrupta', () => {
    expect(R.encolar(null, f)).toEqual([f]);
  });
});
