import { describe, it, expect } from 'vitest';
import N from '../lib/novedad.js';

const ahora = Date.parse('2026-10-20T12:00:00Z');
describe('Novedad', () => {
  it('es nuevo durante 30 días', () => {
    expect(N.esNuevo('2026-10-15T00:00:00Z', ahora)).toBe(true);
    expect(N.esNuevo('2026-09-21T00:00:00Z', ahora)).toBe(true);
    expect(N.esNuevo('2026-09-01T00:00:00Z', ahora)).toBe(false);
  });
  it('los libros antiguos y las fechas rotas no son nuevos', () => {
    expect(N.esNuevo('2026-02-01T00:00:00Z', ahora)).toBe(false);
    expect(N.esNuevo(null, ahora)).toBe(false);
    expect(N.esNuevo('basura', ahora)).toBe(false);
  });
  it('una fecha futura no cuenta', () => {
    expect(N.esNuevo('2026-12-01T00:00:00Z', ahora)).toBe(false);
  });
});
