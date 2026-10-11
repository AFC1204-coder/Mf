/**
 * Corpus local: descarga ligera del contenido y copia en el dispositivo (IndexedDB) para que la app
 * arranque al instante y se actualice en segundo plano. Diseño: docs/rediseno-uso-diario.md §16.1
 *
 * Lo puro (columnas, paginación, fusión de imágenes, caducidad) se prueba en tests/corpus.test.js;
 * el almacén usa IndexedDB y, si no existe o falla, simplemente no guarda nada.
 *
 * UMD: window.Corpus en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Corpus = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Sube este número si cambia la forma de lo guardado: obliga a descargar de nuevo. */
  const VERSION = 1;

  /** Cada cuánto se vuelve a descargar el contenido (los datos del usuario se refrescan siempre). */
  const CADUCIDAD_MS = 6 * 3600 * 1000;

  /**
   * Columnas de `lecciones` que usa la app. Fuera: `busqueda` (índice de texto del servidor, ≈ 5,5 MB)
   * e `imagen_principal`, que se pide aparte solo cuando es una URL (los SVG antiguos, ≈ 3,8 MB,
   * están sustituidos por diagramas y se piden uno a uno si alguna lección no tuviera diagrama).
   */
  const COLUMNAS_LECCION = [
    'id', 'libro_id', 'titulo', 'orden', 'activa', 'fecha_creacion', 'cuerpo', 'idea_clave',
    'conexion_cruzada', 'autocorreccion', 'aplicacion_practica', 'dominio_aplicacion',
    'cita_memorable', 'autores_relacionados', 'detalles', 'imagenes_inline', 'imagen_caption'
  ].join(',');

  /** Total de filas a partir de la cabecera Content-Range de PostgREST («0-999/2120»). */
  function totalDeRango(cabecera) {
    const m = /\/(\d+)\s*$/.exec(String(cabecera || ''));
    return m ? Number(m[1]) : null;
  }

  /** Desplazamientos de las páginas que faltan tras la primera. */
  function desplazamientos(total, porPagina) {
    const out = [];
    for (let o = porPagina; o < total; o += porPagina) out.push(o);
    return out;
  }

  /**
   * Pone `imagen_principal` a las lecciones cuya imagen es una URL y marca `_svgPendiente` en las que
   * tienen un SVG antiguo (se pedirá solo si al abrirla no tiene ninguna otra figura).
   */
  function fusionarImagenes(lecs, conUrl, conSvg) {
    const porId = new Map((lecs || []).map(l => [l.id, l]));
    (conUrl || []).forEach(f => { const l = porId.get(f.id); if (l && f.imagen_principal) l.imagen_principal = f.imagen_principal; });
    (conSvg || []).forEach(f => { const l = porId.get(f.id); if (l && !l.imagen_principal) l._svgPendiente = true; });
    return lecs;
  }

  /** ¿Sirve lo guardado para arrancar? */
  function utilizable(c) {
    return !!(c && c.v === VERSION && Array.isArray(c.libros) && Array.isArray(c.lecs) && c.lecs.length);
  }

  /** ¿Toca volver a descargar el contenido? */
  function caducado(c, ahora) {
    return !utilizable(c) || !(c.ts > 0) || (ahora - c.ts) > CADUCIDAD_MS;
  }

  /** Huella barata para saber si los datos cambiaron y merece la pena repintar. */
  function huella(o) {
    const ult = a => (a && a.length ? JSON.stringify(a[a.length - 1]).length : 0);
    return [
      (o.libros || []).length, (o.lecs || []).length, (o.preg || []).length,
      (o.prog || []).length, ult(o.prog), (o.revisiones || []).length
    ].join('|');
  }

  /* ── Almacén en IndexedDB ── */
  const DB = 'mf-corpus', STORE = 'kv';
  let dbp = null;
  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') return rej(new Error('sin IndexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  async function leer(clave) {
    try {
      const db = await abrir();
      return await new Promise((res, rej) => {
        const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(clave);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
    } catch (e) { return null; }
  }
  async function guardar(clave, valor) {
    try {
      const db = await abrir();
      await new Promise((res, rej) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(valor, clave);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
      return true;
    } catch (e) { return false; }
  }

  return {
    VERSION, CADUCIDAD_MS, COLUMNAS_LECCION,
    totalDeRango, desplazamientos, fusionarImagenes, utilizable, caducado, huella,
    leer, guardar
  };
});
