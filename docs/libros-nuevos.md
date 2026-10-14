# Libros añadidos con el sistema «nuevo-libro»

Procedimiento: `.claude/skills/nuevo-libro/SKILL.md`. Piezas: `tools/libros/` (lint, SQL, huellas, barajado, prompts), tabla `reportes_contenido`, etiqueta «Nuevo».

| Fecha | Libro | Lecciones / preguntas | Confianza | Verificación |
|---|---|---|---|---|
| 2026-10-12 | Carol Dweck, *Mindset* (2006) | 7 / 21 | media | 0 ERROR, 5 DUDA aplicadas (atribuía al libro el «aún no» de 2014, experimento mal descrito, autores sin justificar); réplica de Li y Bates (2019) y su disputa añadidas |
| 2026-10-12 | Milton Friedman, *Capitalism and Freedom* (1962) | 8 / 16 | media | 7 DUDA aplicadas (principio ético de la distribución, licencias/registro, mecanismo estilo Olson, Schwartz 1963, límite de la financiación educativa); el hallazgo sobre `cita_memorable` no se aplicó: son ideas, no citas |
| 2026-10-14 | Chris Palmer, *Brain Energy* (2022) | 6 / 18 | media | 0 ERROR, 7 DUDA aplicadas: lección de dieta cetogénica desactualizada (se añade la evidencia reciente en términos cualitativos), apertura prudente atribuida al libro que era del paquete, falsabilidad como crítica, dos objeciones a la hipótesis mitocondrial, autores relacionados sin respaldo. Es una hipótesis, no un hecho establecido; las lecciones de salud avisan de que no sustituyen a un profesional |
| 2026-10-14 | Henry Hazlitt, *Economics in One Lesson* (1946) | 7 / 20 | alta | 0 ERROR, 10 DUDA aplicadas: evidencia del salario mínimo equilibrada (Card y Krueger frente a Neumark y Wascher), atribuciones sin respaldo retiradas (Sowell, obsolescencia, Taleb, Hirschman) |
| 2026-10-14 | Travis Christofferson, *Tripping Over the Truth* (2014) | 7 / 21 | media | 1 ERROR (presentaba el enfoque metabólico como alternativa al tratamiento oncológico) y 8 DUDA aplicadas: hallazgo posterior al libro retirado, tesis de Seyfried reatribuidas, objeciones añadidas |
| 2026-10-14 | Thomas Seyfried, *Cancer as a Metabolic Disease* (2012) | 7 / 21 | media | 1 ERROR (el marco «press-pulse» es de 2017, no del libro) y 4 DUDA aplicadas. Hipótesis minoritaria, evidencia sobre todo preclínica; las lecciones remiten al equipo oncológico |
| 2026-10-14 | Gary Taubes, *Why We Get Fat* (2010) | 7 / 21 | media | 1 ERROR (atribución cruzada a Attia) y 8 DUDA aplicadas: Hall 2015 y réplica de Ebbeling 2018, grasa saturada, igualación a un año. Las fechas nuevas se marcaron sin contraste web (proxy) |
| 2026-10-14 | Elisabeth Noelle-Neumann, *La espiral del silencio* (1980) | 6 / 16 | media | 1 ERROR (biografía: *Das Reich* 1941, polémica de 1991) y DUDA aplicadas; metaanálisis con r≈0,10 |
| 2026-10-14 | John Stuart Mill, *Sobre la libertad* (1859) | 7 / 21 | alta | 0 ERROR, 6 DUDA aplicadas (ejemplo del cerdo y los musulmanes, mormones, Hayek con matices, conexiones con Kahneman y Caplan) |
| 2026-10-14 | Paul Davies, *The Goldilocks Enigma* (2006) | 7 / 20 | media | 0 ERROR, 7 DUDA aplicadas (lotería, Hanson, bucle de Wheeler, vacío cuántico no atribuido). Identificación del libro asumida a partir de «ajuste fino» |

Las verificaciones hicieron comprobaciones web parciales y el resto de memoria; no sustituyen al botón «¿Algo no cuadra?».

**Visuales (2026-10-13):** añadidos 1 diagrama por lección (15) y 1 mapa por libro (2) a Dweck y Friedman, con la herramienta `tools/datos/agregar.mjs` (lint de `lib/lint-visual.js`). Los diagramas solo resumen la lección y conservan sus matices (p. ej. efectos pequeños en Dweck).

**Visuales (2026-10-14):** 1 diagrama por lección (48) y 1 mapa por libro (7) para los siete libros anteriores; los textos de mapa se acortaron a 56 caracteres por nodo y 100 en el cierre porque el lint no detecta el recorte.

**Nota:** *La señal y el ruido* (Nate Silver) ya estaba en la biblioteca como *The Signal and the Noise* (10 lecciones, 53 preguntas); no se duplicó.
