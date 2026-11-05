---
name: nuevo-libro
description: Añade un libro nuevo al corpus de «Mente fría» (lecciones, preguntas, ideas) con el estilo de la biblioteca, verificado y publicado con la etiqueta «Nuevo». Úsalo cuando se pida ampliar la biblioteca o procesar avisos de «¿Algo no cuadra?».
---

# Añadir un libro nuevo a Mente fría

Proyecto Supabase `aduizdiiacrvpoavjmab` (herramienta `mcp__Supabase__execute_sql`). Todo se hace desde `/home/user/Mf`.
Prioridad del usuario: **no adquirir conceptos erróneos**. Un fallo estético importa poco; una atribución, cifra, cita o clave falsa, mucho.

## 0. Antes de empezar
- Lee `docs/libros-preceptos.md`: son los preceptos de calidad y de utilidad, y **los comprueba `tools/libros/puerta.js`**; si la puerta no dice `publicar`, el libro no se publica solo.
- Revisa los avisos abiertos: `select * from reportes_contenido where estado='abierto' order by fecha;`. Atiéndelos primero (corrige el texto/clave en la BD y márcalos `corregido` o `descartado`).
- **Sin tope de libros por semana** (decisión del dueño). Solo un aviso de volumen: cuenta lo publicado en 7 días,
  `select count(*) from libros_candidatos where estado='publicado' and publicado_en > now() - interval '7 days';`
  y si son 5 o más, deja una notificación al dueño y sigue:
  `insert into notificaciones (usuario_id, tipo, titulo, mensaje, icono) values ('default','nuevo_contenido','Volumen de libros nuevos','Se han publicado N libros en 7 días. Revisa si quieres frenar la rutina para ahorrar cómputo.','📚');`
  Si hay más de 5 avisos «¿Algo no cuadra?» abiertos sin atender, no añadas libros: arregla primero. Pasa ambos números a la puerta (`--publicados-semana`, `--abiertos`).

> **Notificaciones:** la tabla `notificaciones` solo admite los tipos `logro`, `racha`, `repaso` y `nuevo_contenido`; usa `nuevo_contenido`.

## 1. Elegir candidato (de la cola, no improvisado)
- `select * from libros_candidatos where estado='pendiente';` y elige con `puerta.elegirCandidato(candidatos, corpus)` (`corpus` = `select titulo, autor, eje_principal, sub_eje from libros`): mayor prioridad, hueco poco poblado, sin duplicar, sin temas de riesgo. Márcalo `en_curso`.
- **Duplicados por idioma:** muchos libros están con título en español («Fluir», «Cómo Ganar Amigos…»). Antes de generar, busca también por **autor** (`select titulo from libros where autor ilike '%apellido%'`) y descarta si es el mismo libro.
- Si la cola está vacía, **no inventes**: termina informando. El dueño (o Claude en una sesión) añade candidatos con motivo de utilidad.
- No añadas por tu cuenta libros de salud, dinero o sexualidad: van a `en_revision`.
- Libro que domines con detalle; si dudas de lo que dice, descártalo (`estado='descartado'`, motivo en `informe`).

## 2. Generar (agente nuevo)
Un agente `general-purpose` con el prompt `tools/libros/prompts/generador.md` y: libro, eje, sub_eje **ya existente en el corpus**, ruta `/tmp/…/slug.json`. Debe terminar con `barajar.js` + `lint.js` en OK.

## 3. Verificar (OTRO agente, independiente)
Prompt `tools/libros/prompts/verificador.md` sobre el JSON. Con búsqueda web. Devuelve ERROR/DUDA/OK por afirmación.
- `rechazar` → no se publica; descarta el libro (anótalo en `docs/libros-nuevos.md`).
- `corregir` → agente corrector (aplica cada hallazgo: ERROR corregir/eliminar; DUDA suavizar, atribuir bien o eliminar; no añade cifras/citas nuevas sin fuente) y `lint` en OK. Si hubo ERROR de contenido (no solo DUDA), repite la verificación con un verificador nuevo.
- `publicar` → sigue.
- **Puerta (fase cargar):** `node tools/libros/puerta.js paquete.json --informes v1.json,v2.json --libros corpus.json --autores tools/libros/autores-corpus.json --fase cargar --publicados-semana N --abiertos M`. Solo si dice `publicar` se carga. Si dice `revisar` → `estado='en_revision'` con el informe; `rechazar` → `descartado`; `esperar` → vuelve a `pendiente`.

## 4. Cargar en borrador y comprobar
1. `node tools/libros/a-sql.js slug.json alta > slug.alta.sql` (libro/lecciones/preguntas ocultos; ids deterministas: repetir no duplica).
2. Un agente carga el SQL **sin cambiar ni una palabra** con `execute_sql` (por lecciones).
3. **Comprueba tú la carga**: `node tools/libros/huellas.js slug.json comparar-sql` → ejecuta esa consulta; debe devolver 0 filas. Si hay diferencias, no publiques: recarga lo distinto.
4. **Puerta (fase publicar)** con `--huellas-ok`: debe decir `publicar`.
   **Modo actual: aprobación del dueño** (decisión del 5 nov 2026, hasta nuevo aviso). La rutina automática **NO publica**: deja el libro cargado y oculto, con la puerta en `publicar`, marca el candidato `en_revision` con `veredicto_puerta='publicar'` y el informe, y deja una notificación al dueño («Libro listo para revisar: …»). El dueño lo revisa (o pide a Claude que lo publique en una sesión) y entonces se publica:
   `update libros set publico=true, fecha_creacion=now() where id='<id>'; update lecciones set activa=true where libro_id='<id>'; update preguntas set activa=true where libro_id='<id>';`
   (`node tools/libros/a-sql.js slug.json publicar` lo genera). La app muestra «Nuevo» 30 días. En una sesión con el dueño presente y su visto bueno explícito se puede publicar directamente.
5. Al publicar (tras la aprobación) marca el candidato: `update libros_candidatos set estado='publicado', libro_id='<id>', publicado_en=now(), veredicto_puerta='publicar', informe='<json con hallazgos y motivos>'::jsonb, actualizado=now() where id='<id candidato>';`. En una sesión con el dueño, anota además el libro, la confianza y los hallazgos en `docs/libros-nuevos.md` (commit y PR). **La rutina automática no depende de poder escribir en el repositorio**: su registro es la fila de `libros_candidatos`.

## Revertir
`delete from preguntas where libro_id='<id>'; delete from lecciones where libro_id='<id>'; delete from libros where id='<id>';` (o solo ocultar con `publico=false`/`activa=false`).

## Lecciones del piloto (Friedman y Dweck)
- El verificador independiente SÍ encuentra cosas (atribuciones al libro de ideas posteriores, experimentos mal descritos, «autores relacionados» sin justificar). Nunca saltarse ese paso.
- Los generadores escribieron «a nivel general» y sin cifras ni citas: es lo correcto; el lint obliga a declarar cada cifra y cita entrecomillada.
- `cita_memorable` es una IDEA redactada por la app (se muestra como «Idea»), no una cita: no entrecomillar ni atribuir.
- La carga la hace un agente transcribiendo: **siempre** comprobarla con huellas.
- `execute_sql` no admite varias sesiones: los `create temp table` no persisten entre llamadas; `delete`/`update` masivos pueden dar timeout (dividir).
- Tras publicar, añade los visuales: un diagrama por lección y un mapa por libro. Hay 17 plantillas (10 cualitativas y 7 de matemática sencilla: `grafica`, `barras`, `formula`, `tabla`, `arbol`, `venn`, `recta`). No encasilles todo en `comparar` y `pasos`: elige la que muestre la relación de la lección y, **solo si la lección contiene una relación cuantitativa** (una fórmula, una curva, probabilidades, pagos, una comparación numérica), añade una figura de matemática sencilla marcada `"adicional": true`. Lee antes `docs/graficos-matematicos.md`: los números salen siempre del texto de la lección, una curva sin datos reales lleva `sinEscala` y «Forma ilustrativa», y se comprueba con `node tools/datos/galeria.mjs`. Un agente los escribe a partir de la lección (sin hechos nuevos) en `/tmp/…/slug-diagramas.json` ({idLección:[spec]}) y `slug-mapa.json` ({idLibro:spec}); se fusionan con `node tools/datos/agregar.mjs diagramas|mapas fichero.json` (lint), se comprueban renderizados con la hoja de estilos de la app y se suben en el mismo PR (sube también la versión de caché de `sw.js`). Las lecciones funcionan sin ellos, pero el usuario los echa de menos.
