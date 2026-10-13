# Libros añadidos con el sistema «nuevo-libro»

Procedimiento: `.claude/skills/nuevo-libro/SKILL.md`. Piezas: `tools/libros/` (lint, SQL, huellas, barajado, prompts), tabla `reportes_contenido`, etiqueta «Nuevo».

| Fecha | Libro | Lecciones / preguntas | Confianza | Verificación |
|---|---|---|---|---|
| 2026-10-12 | Carol Dweck, *Mindset* (2006) | 7 / 21 | media | 0 ERROR, 5 DUDA aplicadas (atribuía al libro el «aún no» de 2014, experimento mal descrito, autores sin justificar); réplica de Li y Bates (2019) y su disputa añadidas |
| 2026-10-12 | Milton Friedman, *Capitalism and Freedom* (1962) | 8 / 16 | media | 7 DUDA aplicadas (principio ético de la distribución, licencias/registro, mecanismo estilo Olson, Schwartz 1963, límite de la financiación educativa); el hallazgo sobre `cita_memorable` no se aplicó: son ideas, no citas |

Las verificaciones hicieron comprobaciones web parciales y el resto de memoria; no sustituyen al botón «¿Algo no cuadra?».

**Visuales (2026-10-13):** añadidos 1 diagrama por lección (15) y 1 mapa por libro (2) a Dweck y Friedman, con la herramienta `tools/datos/agregar.mjs` (lint de `lib/lint-visual.js`). Los diagramas solo resumen la lección y conservan sus matices (p. ej. efectos pequeños en Dweck).
