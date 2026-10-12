---
name: nuevo-libro
description: Añade un libro nuevo al corpus de «Mente fría» (lecciones, preguntas, ideas) con el estilo de la biblioteca, verificado y publicado con la etiqueta «Nuevo». Úsalo cuando se pida ampliar la biblioteca o procesar avisos de «¿Algo no cuadra?».
---

# Añadir un libro nuevo a Mente fría

Proyecto Supabase `aduizdiiacrvpoavjmab` (herramienta `mcp__Supabase__execute_sql`). Todo se hace desde `/home/user/Mf`.
Prioridad del usuario: **no adquirir conceptos erróneos**. Un fallo estético importa poco; una atribución, cifra, cita o clave falsa, mucho.

## 0. Antes de empezar
- Revisa los avisos abiertos: `select * from reportes_contenido where estado='abierto' order by fecha;`. Atiéndelos primero (corrige el texto/clave en la BD y márcalos `corregido` o `descartado`).
- Tope: **1 libro por ejecución**, y como mucho 2 por semana. Si hay más de 5 avisos abiertos sin atender, no añadas libros: arregla primero.

## 1. Elegir candidato
- Libro conocido y que domines con detalle (si dudas de lo que dice, no lo elijas). No debe estar ya: `select 1 from libros where titulo ilike '%…%' or autor ilike '%…%'`.
- Que encaje con la biblioteca (ensayo/divulgación sobre economía, mente, conducta, biología, pensamiento, desarrollo personal) y cubra huecos: `select eje_principal, count(*) from libros group by 1` (los ejes menos poblados primero: Desarrollo Humano, Neurociencia y Biología).
- Evita obras con base mayormente anecdótica no verificable.

## 2. Generar (agente nuevo)
Un agente `general-purpose` con el prompt `tools/libros/prompts/generador.md` y: libro, eje, sub_eje **ya existente en el corpus**, ruta `/tmp/…/slug.json`. Debe terminar con `barajar.js` + `lint.js` en OK.

## 3. Verificar (OTRO agente, independiente)
Prompt `tools/libros/prompts/verificador.md` sobre el JSON. Con búsqueda web. Devuelve ERROR/DUDA/OK por afirmación.
- `rechazar` → no se publica; descarta el libro (anótalo en `docs/libros-nuevos.md`).
- `corregir` → agente corrector (aplica cada hallazgo: ERROR corregir/eliminar; DUDA suavizar, atribuir bien o eliminar; no añade cifras/citas nuevas sin fuente) y `lint` en OK. Si hubo ERROR de contenido (no solo DUDA), repite la verificación con un verificador nuevo.
- `publicar` → sigue.

## 4. Cargar en borrador y comprobar
1. `node tools/libros/a-sql.js slug.json alta > slug.alta.sql` (libro/lecciones/preguntas ocultos; ids deterministas: repetir no duplica).
2. Un agente carga el SQL **sin cambiar ni una palabra** con `execute_sql` (por lecciones).
3. **Comprueba tú la carga**: `node tools/libros/huellas.js slug.json comparar-sql` → ejecuta esa consulta; debe devolver 0 filas. Si hay diferencias, no publiques: recarga lo distinto.
4. Publica (solo si todo coincide):
   `update libros set publico=true, fecha_creacion=now() where id='<id>'; update lecciones set activa=true where libro_id='<id>'; update preguntas set activa=true where libro_id='<id>';`
   (`node tools/libros/a-sql.js slug.json publicar` lo genera.) La app muestra «Nuevo» 30 días.
5. Anota el libro, la confianza y los hallazgos del verificador en `docs/libros-nuevos.md`; commit y PR.

## Revertir
`delete from preguntas where libro_id='<id>'; delete from lecciones where libro_id='<id>'; delete from libros where id='<id>';` (o solo ocultar con `publico=false`/`activa=false`).

## Lecciones del piloto (Friedman y Dweck)
- El verificador independiente SÍ encuentra cosas (atribuciones al libro de ideas posteriores, experimentos mal descritos, «autores relacionados» sin justificar). Nunca saltarse ese paso.
- Los generadores escribieron «a nivel general» y sin cifras ni citas: es lo correcto; el lint obliga a declarar cada cifra y cita entrecomillada.
- `cita_memorable` es una IDEA redactada por la app (se muestra como «Idea»), no una cita: no entrecomillar ni atribuir.
- La carga la hace un agente transcribiendo: **siempre** comprobarla con huellas.
- `execute_sql` no admite varias sesiones: los `create temp table` no persisten entre llamadas; `delete`/`update` masivos pueden dar timeout (dividir).
- No tocar el diagrama ni el mapa del libro nuevo (viven en `datos/diagramas.json` y `datos/`); las lecciones funcionan sin ellos.
