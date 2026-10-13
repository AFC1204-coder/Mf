import { describe, it, expect } from 'vitest';
import I from '../lib/invitado.js';

describe('Invitado · el dueño no se toca', () => {
  it('sin modo invitado todo pasa', () => {
    expect(I.decidir('notas?select=*', 'GET', false)).toBe('pasar');
    expect(I.decidir('progreso', 'POST', false)).toBe('pasar');
    expect(I.decidir('rpc/registrar_repaso', 'POST', false)).toBe('pasar');
  });
  it('no recibe ningún dato personal', () => {
    for (const t of I.TABLAS_PERSONALES) expect(I.decidir(t + '?select=*&usuario_id=eq.default', 'GET', true)).toBe('vacio');
    for (const f of I.RPC_LECTURA_PERSONAL) expect(I.decidir('rpc/' + f, 'POST', true)).toBe('vacio');
  });
  it('no escribe en ninguna tabla personal, con ningún método', () => {
    for (const t of I.TABLAS_PERSONALES) for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) expect(I.decidir(t, m, true)).toBe('descartar');
  });
  it('no puede cambiar datos compartidos ni lanzar funciones de escritura', () => {
    expect(I.decidir('libros?id=eq.1', 'PATCH', true)).toBe('descartar');
    expect(I.decidir('preguntas', 'POST', true)).toBe('descartar');
    expect(I.decidir('lecciones?id=eq.1', 'DELETE', true)).toBe('descartar');
    for (const f of ['registrar_repaso', 'activar_libro_repaso', 'repaso_desde_lecciones', 'set_portada', 'cualquier_otra']) expect(I.decidir('rpc/' + f, 'POST', true)).toBe('descartar');
  });
  it('sí lee el contenido y puede buscar', () => {
    for (const t of ['libros?select=*', 'lecciones?select=id', 'preguntas?select=*', 'articulos?select=*']) expect(I.decidir(t, 'GET', true)).toBe('pasar');
    expect(I.decidir('rpc/buscar_corpus', 'POST', true)).toBe('pasar');
  });
  it('sí puede avisar de un fallo, y solo eso', () => {
    expect(I.decidir('reportes_contenido', 'POST', true)).toBe('pasar');
    expect(I.decidir('reportes_contenido', 'DELETE', true)).toBe('descartar');
  });
  it('ignora mayúsculas, barras y parámetros', () => {
    expect(I.decidir('/Notas?x=1', 'get', true)).toBe('vacio'); // las mayúsculas no esquivan la regla
    expect(I.decidir('RPC/Registrar_Repaso', 'post', true)).toBe('descartar');
    expect(I.decidir('notas?x=1', 'post', true)).toBe('descartar');
    expect(I.decidir('/notas', undefined, true)).toBe('vacio');
  });
});
