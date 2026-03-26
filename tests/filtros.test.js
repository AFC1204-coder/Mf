import { describe, it, expect } from 'vitest';
import { filtrarLibrosActivos } from '../lib/core.js';

const libros = [
  { id: 'L1', titulo: 'Pensar rápido, pensar despacio', autor: 'Daniel Kahneman', eje_principal: 'Psicología y Conducta', sub_eje: 'Cognitiva', eje: 'Psicología' },
  { id: 'L2', titulo: 'Antifrágil', autor: 'Nassim Taleb', eje_principal: 'Economía y Mercados', sub_eje: 'Economía', eje: 'Economía' },
  { id: 'L3', titulo: 'Sapiens', autor: 'Yuval Harari', eje_principal: 'Pensamiento y Civilización', sub_eje: 'Historia', eje: 'Historia' },
  { id: 'L4', titulo: 'El cisne negro', autor: 'Nassim Taleb', eje_principal: 'Economía y Mercados', sub_eje: 'Economía', eje: 'Economía' },
  { id: 'L5', titulo: 'Mindset', autor: 'Carol Dweck', eje_principal: 'Desarrollo Humano', sub_eje: 'Mentalidad', eje: 'Desarrollo Personal' },
];

describe('filtrarLibrosActivos', () => {

  it('sin filtros devuelve todos', () => {
    expect(filtrarLibrosActivos(libros, null, null, '')).toHaveLength(5);
  });

  it('filtra por eje principal', () => {
    const result = filtrarLibrosActivos(libros, 'Economía y Mercados', null, '');
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id).sort()).toEqual(['L2', 'L4']);
  });

  it('filtra por sub-eje', () => {
    const result = filtrarLibrosActivos(libros, null, 'Cognitiva', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('L1');
  });

  it('filtra por búsqueda de título', () => {
    const result = filtrarLibrosActivos(libros, null, null, 'cisne');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('L4');
  });

  it('filtra por búsqueda de autor', () => {
    const result = filtrarLibrosActivos(libros, null, null, 'taleb');
    expect(result).toHaveLength(2);
  });

  it('combina eje + búsqueda', () => {
    const result = filtrarLibrosActivos(libros, 'Economía y Mercados', null, 'cisne');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('L4');
  });

  it('búsqueda sin resultados devuelve vacío', () => {
    expect(filtrarLibrosActivos(libros, null, null, 'inexistente')).toHaveLength(0);
  });

  it('búsqueda por eje en texto', () => {
    const result = filtrarLibrosActivos(libros, null, null, 'economía');
    expect(result).toHaveLength(2);
  });

  it('eje + sub-eje combinados', () => {
    const result = filtrarLibrosActivos(libros, 'Economía y Mercados', 'Economía', '');
    expect(result).toHaveLength(2);
  });

  it('array vacío devuelve vacío', () => {
    expect(filtrarLibrosActivos([], 'Psicología', null, '')).toHaveLength(0);
  });
});
