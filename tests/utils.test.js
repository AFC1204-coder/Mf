import { describe, it, expect } from 'vitest';
import { hl, normalizeEje, ejeColor, ejeClass, getEjePrincipal, getSubEje, nl2br, createLS, toggleFavLogic } from '../lib/core.js';

/* ═══════════════════════════════════════════
   hl — resaltado de búsqueda
═══════════════════════════════════════════ */
describe('hl — highlight de búsqueda', () => {

  it('resalta coincidencia simple', () => {
    expect(hl('Hola mundo', 'mundo')).toBe('Hola <mark class="hl">mundo</mark>');
  });

  it('resalta case-insensitive', () => {
    expect(hl('Kahneman escribió', 'kahneman')).toContain('<mark class="hl">Kahneman</mark>');
  });

  it('resalta múltiples ocurrencias', () => {
    const result = hl('la casa y la mesa', 'la');
    expect(result.match(/<mark/g)).toHaveLength(2);
  });

  it('devuelve texto sin cambios si no hay query', () => {
    expect(hl('texto normal', '')).toBe('texto normal');
    expect(hl('texto normal', null)).toBe('texto normal');
  });

  it('devuelve "" para texto vacío', () => {
    expect(hl('', 'algo')).toBe('');
    expect(hl(null, 'algo')).toBe('');
  });

  it('escapa caracteres regex especiales en query', () => {
    expect(hl('precio (USD)', '(USD)')).toContain('<mark class="hl">(USD)</mark>');
  });

  it('escapa HTML en el texto para prevenir XSS', () => {
    const result = hl('<script>alert("xss")</script>', 'alert');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('<mark class="hl">alert</mark>');
  });

  it('escapa & en el texto', () => {
    const result = hl('AT&T es grande', 'AT');
    expect(result).toContain('&amp;');
    expect(result).toContain('<mark class="hl">AT</mark>');
  });

  it('escapa > y < incluso sin coincidencia de query', () => {
    const result = hl('<img onerror=alert(1)>', 'onerror');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});

/* ═══════════════════════════════════════════
   normalizeEje — normalización de ejes
═══════════════════════════════════════════ */
describe('normalizeEje', () => {

  it('normaliza "economico" → "Economía"', () => {
    expect(normalizeEje('economico')).toBe('Economía');
  });

  it('normaliza con tilde "económico" → "Economía"', () => {
    expect(normalizeEje('económico')).toBe('Economía');
  });

  it('normaliza "psicologia" → "Psicología"', () => {
    expect(normalizeEje('psicologia')).toBe('Psicología');
  });

  it('normaliza case-insensitive', () => {
    expect(normalizeEje('ECONOMÍA')).toBe('Economía');
    expect(normalizeEje('Filosofia')).toBe('Filosofía');
  });

  it('devuelve el original si no hay mapeo', () => {
    expect(normalizeEje('Desconocido')).toBe('Desconocido');
  });

  it('devuelve null/undefined sin error', () => {
    expect(normalizeEje(null)).toBe(null);
    expect(normalizeEje(undefined)).toBe(undefined);
  });

  it('normaliza "neurológico-biológico"', () => {
    expect(normalizeEje('neurológico-biológico')).toBe('Neurológico-Biológico');
  });
});

/* ═══════════════════════════════════════════
   ejeClass — clase CSS segura
═══════════════════════════════════════════ */
describe('ejeClass', () => {

  it('genera clase con caracteres seguros', () => {
    expect(ejeClass('Psicología y Conducta')).toBe('eje-Psicolog_a_y_Conducta');
  });

  it('maneja string vacío', () => {
    expect(ejeClass('')).toBe('eje-');
  });

  it('maneja null/undefined', () => {
    expect(ejeClass(null)).toBe('eje-');
    expect(ejeClass(undefined)).toBe('eje-');
  });
});

/* ═══════════════════════════════════════════
   getEjePrincipal / getSubEje
═══════════════════════════════════════════ */
describe('getEjePrincipal / getSubEje', () => {

  it('prioriza eje_principal sobre eje', () => {
    expect(getEjePrincipal({ eje_principal: 'A', eje: 'B' })).toBe('A');
  });

  it('fallback a eje si no hay eje_principal', () => {
    expect(getEjePrincipal({ eje: 'B' })).toBe('B');
  });

  it('devuelve "" si no hay nada', () => {
    expect(getEjePrincipal({})).toBe('');
  });

  it('getSubEje prioriza sub_eje', () => {
    expect(getSubEje({ sub_eje: 'Cognitiva', eje: 'Psicología' })).toBe('Cognitiva');
  });

  it('getSubEje fallback a eje', () => {
    expect(getSubEje({ eje: 'Psicología' })).toBe('Psicología');
  });
});

/* ═══════════════════════════════════════════
   nl2br
═══════════════════════════════════════════ */
describe('nl2br', () => {

  it('convierte \\n en <br>', () => {
    expect(nl2br('línea 1\nlínea 2')).toBe('línea 1<br>línea 2');
  });

  it('maneja null', () => {
    expect(nl2br(null)).toBe('');
  });

  it('sin saltos de línea devuelve igual', () => {
    expect(nl2br('texto plano')).toBe('texto plano');
  });
});

/* ═══════════════════════════════════════════
   createLS — wrapper de localStorage
═══════════════════════════════════════════ */
describe('createLS — localStorage wrapper', () => {

  const mockStorage = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      clear: () => { store = {}; },
    };
  })();

  it('set y get valores', () => {
    const ls = createLS(mockStorage);
    ls.set('clave', { a: 1 });
    expect(ls.get('clave', null)).toEqual({ a: 1 });
  });

  it('devuelve default si la clave no existe', () => {
    const ls = createLS(mockStorage);
    expect(ls.get('inexistente', 42)).toBe(42);
  });

  it('devuelve default si el JSON es inválido', () => {
    mockStorage.setItem('roto', '{invalid json');
    const ls = createLS(mockStorage);
    expect(ls.get('roto', 'fallback')).toBe('fallback');
  });

  it('guarda y recupera arrays', () => {
    const ls = createLS(mockStorage);
    ls.set('favs', ['a', 'b', 'c']);
    expect(ls.get('favs', [])).toEqual(['a', 'b', 'c']);
  });
});

/* ═══════════════════════════════════════════
   toggleFavLogic — lógica de favoritos
═══════════════════════════════════════════ */
describe('toggleFavLogic — toggle de favoritos', () => {

  const cache = { libro: ['L1', 'L3'], leccion: [], cita: ['Q1'] };

  it('quita favorito existente', () => {
    const { newCache, added } = toggleFavLogic(cache, 'libro', 'L1');
    expect(added).toBe(false);
    expect(newCache.libro).toEqual(['L3']);
  });

  it('agrega favorito nuevo', () => {
    const { newCache, added } = toggleFavLogic(cache, 'libro', 'L5');
    expect(added).toBe(true);
    expect(newCache.libro).toContain('L5');
  });

  it('no muta el cache original', () => {
    toggleFavLogic(cache, 'libro', 'L1');
    expect(cache.libro).toEqual(['L1', 'L3']);
  });

  it('toggle en tipo vacío agrega', () => {
    const { newCache, added } = toggleFavLogic(cache, 'leccion', 'LEC1');
    expect(added).toBe(true);
    expect(newCache.leccion).toEqual(['LEC1']);
  });
});

/* ═══════════════════════════════════════════
   ejeColor — color del eje con guard en sub
═══════════════════════════════════════════ */
describe('ejeColor', () => {

  const config = {
    'Psicología y Conducta': { color: '#9b59b6', sub: { 'Cognitiva': null, 'Social': null } },
    'Economía y Mercados': { color: '#c9a84c', sub: { 'Economía': null } },
    'Sin sub': { color: '#ff0000' },
  };

  it('devuelve color del eje principal', () => {
    expect(ejeColor('Psicología y Conducta', config)).toBe('#9b59b6');
  });

  it('devuelve color del sub-eje', () => {
    expect(ejeColor('Cognitiva', config)).toBe('#9b59b6');
  });

  it('devuelve color por defecto si no existe', () => {
    expect(ejeColor('Inexistente', config)).toBe('#5c5650');
  });

  it('devuelve color por defecto para null', () => {
    expect(ejeColor(null, config)).toBe('#5c5650');
  });

  it('no crash si cfg.sub no existe', () => {
    expect(ejeColor('Sin sub', config)).toBe('#ff0000');
  });

  it('no crash buscando sub en eje sin sub definido', () => {
    expect(ejeColor('Algo', config)).toBe('#5c5650');
  });
});
