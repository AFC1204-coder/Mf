import { describe, it, expect } from 'vitest';
import { fmt } from '../lib/core.js';

describe('fmt — parser Markdown → HTML', () => {

  /* ── Valores vacíos / nulos ── */
  it('devuelve string vacío para null, undefined, ""', () => {
    expect(fmt(null)).toBe('');
    expect(fmt(undefined)).toBe('');
    expect(fmt('')).toBe('');
  });

  /* ── Párrafos ── */
  it('envuelve texto plano en <p>', () => {
    expect(fmt('Hola mundo')).toBe('<p>Hola mundo</p>');
  });

  it('junta líneas consecutivas en un solo <p>', () => {
    expect(fmt('línea uno\nlínea dos')).toBe('<p>línea uno línea dos</p>');
  });

  it('separa párrafos con línea en blanco', () => {
    const result = fmt('párrafo uno\n\npárrafo dos');
    expect(result).toContain('<p>párrafo uno</p>');
    expect(result).toContain('<p>párrafo dos</p>');
  });

  /* ── Encabezados ── */
  it('convierte ## en <h2>', () => {
    expect(fmt('## Título')).toBe('<h2>Título</h2>');
  });

  it('convierte ### en <h3>', () => {
    expect(fmt('### Subtítulo')).toBe('<h3>Subtítulo</h3>');
  });

  it('convierte #### en <h4>', () => {
    expect(fmt('#### Detalle')).toBe('<h4>Detalle</h4>');
  });

  /* ── Inline formatting ── */
  it('convierte **bold** en <strong>', () => {
    expect(fmt('**negrita**')).toContain('<strong>negrita</strong>');
  });

  it('convierte *italic* en <em>', () => {
    expect(fmt('*cursiva*')).toContain('<em>cursiva</em>');
  });

  it('convierte `code` en <code>', () => {
    expect(fmt('`código`')).toContain('<code>código</code>');
  });

  /* ── Listas desordenadas ── */
  it('convierte - item en <ul><li>', () => {
    const result = fmt('- primero\n- segundo');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>primero</li>');
    expect(result).toContain('<li>segundo</li>');
    expect(result).toContain('</ul>');
  });

  it('soporta • como marcador de lista', () => {
    const result = fmt('• alfa\n• beta');
    expect(result).toContain('<li>alfa</li>');
    expect(result).toContain('<li>beta</li>');
  });

  /* ── Listas ordenadas ── */
  it('convierte 1. item en <ol><li>', () => {
    const result = fmt('1. primero\n2. segundo');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>primero</li>');
    expect(result).toContain('<li>segundo</li>');
    expect(result).toContain('</ol>');
  });

  /* ── Blockquote ── */
  it('convierte > texto en <blockquote>', () => {
    expect(fmt('> cita importante')).toBe('<blockquote>cita importante</blockquote>');
  });

  /* ── Línea horizontal ── */
  it('convierte --- en <hr>', () => {
    expect(fmt('---')).toBe('<hr>');
  });

  it('convierte *** en <hr>', () => {
    expect(fmt('***')).toBe('<hr>');
  });

  /* ── Tablas ── */
  it('convierte tabla markdown en <table>', () => {
    const md = '| Col A | Col B |\n|-------|-------|\n| 1     | 2     |\n| 3     | 4     |';
    const result = fmt(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Col A</th>');
    expect(result).toContain('<td>1</td>');
    expect(result).toContain('<td>3</td>');
    expect(result).toContain('</table>');
  });

  it('tabla con 1 sola fila de datos la renderiza correctamente', () => {
    const md = '| A | B |\n|---|---|\n| x | y |';
    const result = fmt(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<td>x</td>');
    expect(result).toContain('<td>y</td>');
  });

  /* ── Escape HTML (seguridad XSS) ── */
  it('escapa HTML para prevenir XSS', () => {
    const result = fmt('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapa & en texto', () => {
    const result = fmt('AT&T');
    expect(result).toContain('&amp;');
  });

  /* ── Combinaciones ── */
  it('mezcla encabezado + lista + párrafo', () => {
    const md = '## Intro\n\n- punto uno\n- punto dos\n\nTexto final.';
    const result = fmt(md);
    expect(result).toContain('<h2>Intro</h2>');
    expect(result).toContain('<li>punto uno</li>');
    expect(result).toContain('<p>Texto final.</p>');
  });

  it('inline formatting dentro de encabezado', () => {
    expect(fmt('## Título **importante**')).toContain('<strong>importante</strong>');
  });
});
