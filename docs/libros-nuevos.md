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

## Segunda tanda (2026-10-14): 72 libros de las listas de lectura

Cada libro pasó por el flujo completo: generación con el prompt `generador.md`, lint (`tools/libros/lint.js`), verificación independiente con búsqueda web, corrección de todos los ERROR y DUDA, carga como borrador, `huellas.js comparar-sql` con 0 filas y publicación. Las verificaciones encontraron y corrigieron, entre otros, atribuciones cruzadas (ideas de un autor presentadas como de otro), errores de fecha y de término (p. ej. resiliencia y recuperación en Bonanno, TEAM y no TEACH en Doucleff, Lieberman confundido con otro autor de la base), reseñas citadas sin fuente y opciones de respuesta con dos lecturas defendibles. Las lecciones sobre salud, duelo o crianza avisan de que no sustituyen a un profesional.

Todos con confianza «media» salvo indicación; las verificaciones hicieron comprobaciones web parciales y el resto de memoria.

| Autor | Libro | Lecciones / preguntas |
|---|---|---|
| Linden | *The Compass of Pleasure* | 5 / 15 |
| Barrett | *Seven and a Half Lessons About the Brain* | 6 / 18 |
| Eyal | *Indistractable* | 6 / 18 |
| Grant | *Originals* | 6 / 18 |
| Eagleman | *Incognito* | 5 / 16 |
| Doidge | *The Brain That Changes Itself* | 6 / 18 |
| Elster | *Ulysses and the Sirens* | 5 / 11 |
| Eagleman | *The Brain* | 5 / 15 |
| Ratey | *Spark* | 5 / 20 |
| Patterson, Grenny, McMillan, Switzler | *Crucial Conversations* | 6 / 18 |
| Levine y Heller | *Attached* | 5 / 15 |
| Rosenberg | *Nonviolent Communication* | 6 / 13 |
| de Botton | *Status Anxiety* | 6 / 16 |
| Tavris y Aronson | *Mistakes Were Made (But Not by Me)* | 6 / 21 |
| Gottman y Silver | *The Seven Principles for Making Marriage Work* | 6 / 19 |
| Goleman | *Emotional Intelligence* | 7 / 21 |
| Siegel y Bryson | *The Whole-Brain Child* | 6 / 13 |
| Isaacson | *Benjamin Franklin* | 6 / 18 |
| Durant | *The Lessons of History* | 7 / 21 |
| Ware | *The Top Five Regrets of the Dying* | 6 / 18 |
| Waldinger y Schulz | *The Good Life* | 5 / 10 |
| Perkins | *Die With Zero* | 5 / 15 |
| Kethledge y Erwin | *Lead Yourself First* | 5 / 15 |
| Bakewell | *How to Live, or A Life of Montaigne* | 9 / 27 |
| Grant | *Think Again* | 7 / 21 |
| Burnett y Evans | *Designing Your Life* | 7 / 21 |
| Storr | *Solitude* | 5 / 15 |
| Graham | *Keep Your Identity Small* | 3 / 6 |
| Ibarra | *Working Identity* | 6 / 18 |
| Cain | *Quiet* | 6 / 18 |
| Hershfield | *Your Future Self* | 5 / 15 |
| Aristóteles | *Ética a Nicómaco* | 8 / 21 |
| Kishimi y Koga | *The Courage to Be Disliked* | 6 / 18 |
| Firestein | *Ignorance* | 5 / 15 |
| Kabat-Zinn | *Wherever You Go, There You Are* | 8 / 24 |
| Pink | *When* | 6 / 18 |
| Keltner | *Awe* | 5 / 15 |
| De Cruz | *Wonderstruck* | 3 / 9 |
| Schwartz | *The Paradox of Choice* | 6 / 18 |
| Pang | *Rest* | 5 / 15 |
| Huizinga | *Homo Ludens* | 5 / 15 |
| Sexto Empírico | *Esbozos pirrónicos* | 5 / 15 |
| Honoré | *In Praise of Slow* | 7 / 20 |
| Duke | *Quit* | 6 / 19 |
| Dalai Lama y Cutler | *The Art of Happiness* | 7 / 21 |
| Heath y Heath | *The Power of Moments* | 6 / 18 |
| Tanizaki | *In Praise of Shadows* | 5 / 15 |
| Busch | *The Serendipity Mindset* | 5 / 15 |
| Watts | *La sabiduría de la inseguridad* | 6 / 18 |
| Grant | *Give and Take* | 8 / 24 |
| Kalanithi | *When Breath Becomes Air* | 5 / 15 |
| Zomorodi | *Bored and Brilliant* | 5 / 15 |
| Morgan y Barden | *A Beautiful Constraint* | 5 / 17 |
| Kondo | *La magia del orden* | 6 / 18 |
| Skenazy | *Free-Range Kids* | 5 / 15 |
| Nestor | *Breath* | 6 / 18 |
| Didion | *The Year of Magical Thinking* | 5 / 15 |
| Caplan | *Selfish Reasons to Have More Kids* | 6 / 18 |
| Burgis | *Wanting* | 6 / 18 |
| Kübler-Ross y Kessler | *On Grief and Grieving* | 6 / 18 |
| Murphy | *You're Not Listening* | 6 / 18 |
| Palmer | *The Art of Asking* | 7 / 22 |
| Harris | *The Nurture Assumption* | 5 / 19 |
| Brown | *Play* | 6 / 18 |
| Gopnik | *The Gardener and the Carpenter* | 7 / 21 |
| Brooks | *From Strength to Strength* | 7 / 21 |
| Neff | *Self-Compassion* | 8 / 24 |
| Lahey | *The Gift of Failure* | 6 / 24 |
| Doucleff | *Hunt, Gather, Parent* | 6 / 18 |
| Gray | *Free to Learn* | 6 / 18 |
| Lukianoff y Haidt | *The Coddling of the American Mind* | 7 / 21 |
| Stixrud y Johnson | *The Self-Driven Child* | 5 / 15 |

**Visuales (2026-10-14, segunda tanda):** 422 diagramas (uno por lección) y 72 mapas (uno por libro) añadidos con `tools/datos/agregar.mjs`. Los pies llevan la cautela de la autocorrección de cada lección. Se revisaron los desbordes de texto y se sustituyeron tres palabras partidas por guion. El título del mapa de Neff se pone en español porque el lint de tildes confunde «Compassion» con una palabra sin tilde.

**Pendiente de criterio del usuario:** «El arte de decir no» (nº 23 de la lista de temas poco trabajados) no se añadió por no tener autor claro.

## Tercera tanda (2026-10-23): 7 libros de persuasión, influencia y comunicación

Incorporados los 7 libros pendientes de la lista solicitada (los 3 restantes de la lista original ya estaban en el corpus: *Pre-suasión*, *The Dictator's Handbook* y *How Minds Change*). Cada libro cuenta con su paquete JSON validado por `lint.js`, carga determinista en Supabase (`cargar.cjs alta` y comprobación con 0 diferencias antes de publicar), mapas conceptuales en `datos/mapas.json` y diagramas visuales por lección en `datos/diagramas.json`.

| Autor | Libro | Lecciones / preguntas |
|---|---|---|
| Jeffrey Pfeffer | *Power: Why Some People Have It—and Others Don't* (2010) | 4 / 10 |
| Claude C. Hopkins | *Scientific Advertising* (1923) | 4 / 9 |
| Jonah Berger | *The Catalyst: How to Change Anyone's Mind* (2020) | 5 / 15 |
| William R. Miller y Stephen Rollnick | *Motivational Interviewing: Helping People Change* (2012) | 6 / 16 |
| Peter Boghossian y James Lindsay | *How to Have Impossible Conversations* (2019) | 5 / 15 |
| Zoe Chance | *Influence Is Your Superpower* (2022) | 4 / 12 |
| Noah J. Goldstein, Steve J. Martin y Robert B. Cialdini | *Yes! 50 Scientifically Proven Ways to Be Persuasive* (2008) | 5 / 16 |

**Visuales (2026-10-23):** 33 diagramas visuales (uno por lección) y 7 mapas conceptuales (uno por libro) integrados en `datos/diagramas.json` y `datos/mapas.json` con `tools/datos/agregar.mjs` (0 errores de validación).
