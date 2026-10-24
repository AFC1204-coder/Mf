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

## Tercera tanda (2026-10-22): 40 libros de la lista «libros_ideas_tanda2»

Cada libro pasó por el flujo completo: generación (`generador.md`), lint, verificación independiente con búsqueda web, corrección de todos los ERROR y DUDA, y, cuando hubo ERROR de contenido o reescritura grande, segunda (a veces tercera) verificación con un verificador nuevo. La carga la hizo un agente transcribiendo el SQL y **cada libro se comprobó con huellas** (md5 de los campos de lección y de pregunta frente al paquete verificado) antes de publicarse: 0 diferencias en los 40. Total: 40 libros, 321 lecciones, 1004 preguntas.

De la lista de 61 propuestos: 41 entraron en esta tanda (el 41.º, *Built from Broken*, se descartó: el agente no pudo leer el libro, el autor real es Scott Hogan (2021) y no Scott Meyers, y el paquete quedó con confianza baja y material de reseñas de terceros, demasiado arriesgado en un tema de salud); 16 quedan para una tanda B con cautelas fuertes (salud, dieta, negocios con base anecdótica); 4 se descartaron (*Deep Nutrition*, *Jaws*, *The Five Love Languages*, *Models*) y *Ego Is the Enemy* se omitió por redundante.

| Autor | Libro | Lecciones / preguntas | Confianza |
|---|---|---|---|
| Austin Kleon | *Steal Like an Artist* (2012) | 10 / 30 | media |
| Benedict Carey | *How We Learn* (2014) | 9 / 27 | media |
| Bill Bryson | *A Short History of Nearly Everything* (2003) | 10 / 30 | media |
| Cal Newport | *So Good They Can't Ignore You* (2012) | 8 / 24 | media |
| Carlo Rovelli | *Seven Brief Lessons on Physics* (2014) | 7 / 21 | media |
| Charles Duhigg | *Supercommunicators* (2024) | 7 / 21 | media |
| Chris Bailey | *Hyperfocus* (2018) | 6 / 18 | media |
| David Brooks | *The Road to Character* (2015) | 12 / 37 | media |
| Douglas Stone, Bruce Patton, Sheila Heen | *Difficult Conversations* (1999) | 7 / 21 | alta |
| Ed Catmull con Amy Wallace | *Creativity, Inc.* (2014) | 10 / 30 | media |
| Edward R. Tufte | *Visual Explanations* (1997) | 8 / 24 | media |
| Epicteto | *Discourses* (108) | 8 / 24 | media |
| Eric Ries | *The Lean Startup* (2011) | 7 / 27 | alta |
| Gabriel Weinberg y Justin Mares | *Traction* (2014) | 6 / 18 | media |
| Gabriel Weinberg y Lauren McCann | *Super Thinking* (2019) | 11 / 33 | media |
| Henry David Thoreau | *Walden* (1854) | 12 / 36 | alta |
| Howard Marks | *Mastering the Market Cycle* (2018) | 9 / 27 | media |
| Jay Heinrichs | *Thank You for Arguing* (2007) | 8 / 24 | media |
| JL Collins | *The Simple Path to Wealth* (2016) | 7 / 21 | media |
| John Maeda | *The Laws of Simplicity* (2006) | 9 / 27 | media |
| John Wooden y Steve Jamison | *Wooden* (1997) | 6 / 24 | media |
| Josh Waitzkin | *The Art of Learning* (2007) | 6 / 18 | media |
| Joshua Foer | *Moonwalking with Einstein* (2011) | 6 / 22 | media |
| Mark Rippetoe | *Starting Strength* (2011) | 6 / 18 | media |
| Matthew B. Crawford | *Shop Class as Soulcraft* (2009) | 8 / 24 | media |
| Nick Lane | *The Vital Question* (2015) | 8 / 28 | media |
| Peter M. Senge | *The Fifth Discipline* (1990) | 10 / 30 | media |
| Peter Thiel y Blake Masters | *Zero to One* (2014) | 8 / 24 | media |
| Platón | *La República* (-375) | 10 / 30 | alta |
| René Descartes | *Meditations on First Philosophy* (1641) | 8 / 24 | alta |
| Richard P. Rumelt | *Good Strategy Bad Strategy* (2011) | 8 / 27 | media |
| Rob Fitzpatrick | *The Mom Test* (2013) | 9 / 28 | media |
| Roger Fisher y William Ury (con Bruce Patton desde la 2.ª ed., 1991) | *Getting to Yes* (1981) | 8 / 24 | alta |
| Rollo May | *Man's Search for Himself* (1953) | 9 / 31 | media |
| Seth Godin | *The Practice* (2020) | 6 / 18 | media |
| Steven Pinker | *The Sense of Style* (2014) | 7 / 28 | media |
| Steven Pressfield | *The War of Art* (2002) | 8 / 24 | media |
| Vaclav Smil | *How the World Really Works* (2022) | 7 / 21 | media |
| William Zinsser | *On Writing Well* (1976) | 7 / 26 | media |
| William Zinsser | *Writing to Learn* (1988) | 5 / 15 | baja |

**Errores recurrentes que encontraron los verificadores** (conviene vigilarlos en próximas tandas):
- La `autocorreccion` de una lección es una nota crítica de la biblioteca, no una concesión del autor: hay que rotularla así (varias explicaciones decían «la autocorrección del libro»).
- `conexion_cruzada` y `aplicacion_practica` no son tesis del libro; las lecturas nuestras van rotuladas («lectura nuestra», «una aplicación nuestra»).
- Conexiones cruzadas con autores del corpus: comprobar que la tesis atribuida corresponde al libro concreto del corpus (p. ej. Wright: *Nonzero* no está en el corpus; Sinclair: teoría de la información del envejecimiento).
- Preguntas que se contestan por descarte (distractores absurdos, la correcta siempre la más larga) o sin referencias posicionales a las opciones (se rompen al barajar).
- Cada cifra o año del texto debe estar declarado en `cifras` con su fuente (el lint lo exige; lee «Trampa-22» como 22).
- Terminología y atribuciones finas en filosofía y ciencia: Disertaciones frente a Enquiridión (Epicteto), el «cogito» fuera de las Meditaciones, Aristóteles sobre Platón, Hadot sobre los tres campos.
- En libros de salud (*Starting Strength*): ni pautas médicas ni cargas; términos que el autor no usa («cadena cinética cerrada») no se le atribuyen.

**Notas de proceso:**
- `tools/libros/a-sql.js` tiene ahora el modo `corregir`: actualiza por id un libro ya cargado en borrador (el alta usa `on conflict do nothing` y no sobrescribe).
- Con la herramienta `execute_sql` se cuelga cualquier llamada con un `;` dentro de un texto; se sortea sustituyendo cada `;` interno por `'||chr(59)||'` (el contenido guardado es idéntico, comprobado con las huellas).
- *Writing to Learn* (Zinsser) lo marcó el generador con confianza «baja»; pasó dos verificaciones independientes, pero conviene revisarlo si llega algún aviso.
- *Walden* necesitó tres rondas de corrección; la última no se volvió a pasar por un verificador (eran correcciones de atribución con el texto exacto propuesto por el informe).
- *Starting Strength*, *The Fifth Discipline*, *How the World Really Works*, *La República*, *The Vital Question*, *Discourses* y *The War of Art* pasaron por dos verificaciones por haber tenido ERROR de contenido o reescrituras grandes.

**Visuales (2026-10-22):** 321 diagramas (uno por lección) y 40 mapas (uno por libro) añadidos con `tools/datos/agregar.mjs` (0 rechazados por el lint). Los pies llevan la cautela de la `autocorreccion` de cada lección y lo que la lección marca como lectura nuestra va rotulado como tal en el propio diagrama. Se revisó una muestra renderizada con la hoja de estilos de la app (25 diagramas y 6 mapas) y se suavizaron dos textos del mapa de *How the World Really Works* que presentaban como de Smil lo que es lectura nuestra. Versión de caché del service worker: v70.

**Pendiente:** la tanda B (16 libros con cautelas fuertes).

## Cuarta tanda, hecha en otra sesión (2026-10-23): 7 libros de persuasión, influencia y comunicación

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

## Quinta entrega (2026-10-24): *Top Dog* y *Dirty Genes*

Pedidos por el usuario. Pipeline completo: generador → lint → verificador independiente → corrector → segunda verificación con otro verificador → retoques → carga en borrador (`SIN_PUNTOCOMA=1 node tools/libros/a-sql.js … alta`, bloques de ≤12 KB) → comparación de huellas con 0 diferencias → publicación. Ambos con confianza **media**: ningún agente pudo abrir el texto de los libros (solo índices, reseñas, entrevistas y fuentes primarias de los estudios), y las lecciones lo dicen.

| Autor | Libro | Eje / sub_eje | Lecciones / preguntas |
|---|---|---|---|
| Bronson y Merryman | *Top Dog: The Science of Winning and Losing* (2013) | Psicología y Conducta / Social | 6 / 18 |
| Ben Lynch | *Dirty Genes* (2018) | Neurociencia y Biología / Biología y Longevidad | 6 / 18 |

**Hallazgos de los verificadores que cambiaron el contenido**
- *Dirty Genes*: un ERROR real. El borrador decía que los ensayos agrupados de vitaminas B no redujeron el ictus; la revisión Cochrane de 2017 halla una reducción pequeña (RR 0,90) y ninguna sobre infarto ni mortalidad. Además se reforzó el aviso sobre ácido fólico y embarazo (el CDC recomienda ácido fólico incluso con variantes de MTHFR) y se separó la deficiencia grave de MTHFR (rara, tratada por especialistas) de las variantes comunes. Sin dosis ni protocolos: la aplicación práctica es de pensamiento crítico.
- *Top Dog*: se eliminó un contraste paracaidistas/bailarines que las propias fuentes contradicen, se corrigió un apellido (Zweigenhaft), se dejó de llamar «independiente» a un estudio con Jamieson como coautor, y el ejemplo de Kumar queda rotulado como de la biblioteca (no consta que el libro lo cite). La lección de los hermanos (L6) es la más débil: su base es la sinopsis editorial y no se localizó el capítulo; la lección lo dice.
- Los dos: 11 de 18 preguntas de *Top Dog* tenían la correcta como opción más larga (el lint no lo detecta); se equilibraron.

**Visuales:** 12 diagramas (uno por lección) y 2 mapas (uno por libro); caché del service worker v73.

**Aviso de proceso:** la persuasión (7 libros) la incorporó otra sesión el 2026-10-23 con otra estructura y menos lecciones; mis paquetes verificados de esos 7 no se cargaron (los ids deterministas coinciden y `alta` no sobrescribe). Quedan pendientes de decisión del usuario.

## Auditoría de los 7 libros de persuasión publicados por otra sesión (2026-10-24)

Los 7 libros de la sección «Cuarta tanda, hecha en otra sesión» (*Power*, *Scientific Advertising*, *The Catalyst*, *Motivational Interviewing*, *How to Have Impossible Conversations*, *Influence Is Your Superpower*, *Yes!*) estaban ya publicados cuando se pidió esta auditoría. Se auditaron tal como estaban en la BD con un verificador independiente por libro (búsqueda web; ninguno pudo leer el texto de los libros), se redactaron las correcciones como ediciones por campo (nunca se reescribió un libro entero), se aplicaron con SQL literal y se comprobaron con huellas md5 (0 diferencias) y se repasaron con un segundo verificador distinto, seguido de una última tanda de retoques menores. Ningún libro se ocultó durante el proceso.

| Libro | Hallazgos de la 1.ª auditoría | Lo más relevante que se corrigió |
|---|---|---|
| *Power* | 0 ERROR, 10 DUDA | «se apoya sobre todo en casos» (el libro cita también investigación); mecanismos y acumulación del poder rotulados como lectura nuestra; distractores caricaturescos rehechos |
| *Scientific Advertising* | 5 ERROR, 13 DUDA | título «la especificidad supera **siempre**…»; «introdujo» las pruebas (Hopkins generalizó la práctica de la venta por correo); «precisión matemática/certeza»; conexiones erróneas con Cialdini y Kahneman; caso de la cerveza (Schlitz, *My Life in Advertising*) con fuente |
| *The Catalyst* | 0 ERROR, 9 DUDA | notas de la biblioteca sin rotular; tensión «fuentes independientes» (Centola) resuelta como lectura nuestra; dos preguntas respondibles sin la lección |
| *Motivational Interviewing* | 0 ERROR, 12 DUDA | título de L2 decía «compadecer» (*compassion* es «compasión»); absolutos; Cochrane CD008063 (93 estudios, 2023) y Lundahl 2010 (119 estudios) como notas de la biblioteca, certeza «de muy baja a moderada» |
| *How to Have Impossible Conversations* | 2 ERROR, 18 DUDA | conexión con Popper (contradice lo que Popper decía de las definiciones); frase sin fuente sobre la conducta de los autores; críticas de recepción reducidas a lo respaldado (Perry, The Critic, 2020) |
| *Influence Is Your Superpower* | 2 ERROR, 18 DUDA | **mecanismo invertido** en L3 y en una pregunta (quien pide subestima lo incómodo que le resulta al otro negarse; Flynn y Lake 2008, Bohns 2016, como nota de la biblioteca); permiso para negarse con evidencia modesta y discutida (Carpenter 2013; metaanálisis posterior de 2023) |
| *Yes!* | 4 ERROR, 17 DUDA | estudio de Strohmetz mal descrito (chocolate con la cuenta, no «cesta de caramelos a la vista»); miedo que «paraliza» (Witte y Allen 2000; Tannenbaum 2015 no halla circunstancias contraproducentes); descripción del libro con «cada uno apoyado en un experimento» |

**Patrones repetidos** (útiles para el generador): títulos y cuerpos con absolutos («siempre», «nunca»); conexiones cruzadas sin rotular o con tesis ajenas mal atribuidas; notas de la biblioteca presentadas como críticas del libro; distractores con absolutos que permiten acertar sin la lección; correcta más larga (el lint no lo detecta del todo). Los paquetes verificados que preparé antes de saber que ya estaban publicados (`/tmp/…/libros4/`) no se cargaron: los ids deterministas coinciden y `alta` no sobrescribe.

**Visuales:** los 33 diagramas y 7 mapas de esos libros (hechos por la otra sesión sobre el texto previo a la corrección) se revisaron contra el texto actual y se reescribieron todos: quitados absolutos y afirmaciones que la lección ya no hace, pies con la cautela de la autocorrección actual; caché v74.

## Sexta entrega (2026-10-24): primera tanda de las listas «libros vistos en X» y «recomendaciones de Mente fría»

Triage de 136 libros de las dos listas del usuario: 52 ya estaban en la biblioteca, ~19 se dejaron fuera por evidencia floja o hype (Scott Adams, *Start with No*, Nardone, *Stealing Fire*, *Opening Skinner's Box*, *Storyfulness*, *Hipercomplejidad*, *Beyond Self-Interest*, *The Introvert Advantage*, *The Education of a Speculator*…, aparcados a petición del usuario) y ~75 merecían entrar «progresivamente». Esta primera tanda son los 10 de mayor prioridad. Pipeline: generador (con `lecciones-aprendidas.md` de las auditorías) → verificador independiente → corrector → segunda verificación si hubo ERROR de contenido → retoques → carga en borrador (`SIN_PUNTOCOMA=1 … alta`, bloques de ≤12 KB) → huellas con 0 diferencias → publicación → visuales. Ningún generador pudo leer el texto de los libros (reseñas, índices, entrevistas y los estudios originales); la confianza es **media** en todos y las lecciones lo dicen.

| Autor | Libro | Eje / sub_eje | Lecc. / preg. |
|---|---|---|---|
| Thorndike | *The Outsiders* | Economía y Mercados / Economía | 6 / 24 |
| Stanley y Lehman | *Why Greatness Cannot Be Planned* | Pensamiento y Civilización / Epistemología | 6 / 18 |
| Roberts | *Wild Problems* | Pensamiento y Civilización / Filosofía | 5 / 15 |
| Mlodinow | *The Drunkard's Walk* | Pensamiento y Civilización / Epistemología | 7 / 21 |
| Festinger, Riecken y Schachter | *When Prophecy Fails* | Psicología y Conducta / Social | 6 / 18 |
| Schulz | *Being Wrong* | Psicología y Conducta / Cognitiva | 5 / 15 |
| Ridley | *The Rational Optimist* | Economía y Mercados / Economía | 7 / 21 |
| Poundstone | *Fortune's Formula* | Economía y Mercados / Economía | 5 / 15 |
| Chancellor | *Devil Take the Hindmost* | Economía y Mercados / Economía | 5 / 15 |
| Aron | *The Highly Sensitive Person* | Psicología y Conducta / Cognitiva | 5 / 15 |

**Hallazgos de los verificadores que cambiaron el contenido** (ERROR de contenido, con segunda verificación): *Devil Take the Hindmost* situaba la Ley de Burbujas (sanción real el 11 de junio de 1720) después del colapso; *The Outsiders* mezclaba usos y fuentes del capital (el esquema de Thorndike son cinco usos y tres fuentes; «vender la compañía» no figura) y una pregunta no tenía única correcta; *The Rational Optimist* decía que «las ideas tienen sexo» da nombre al libro y describía su postura climática como causa humana «parcial» (su autodefinición es «lukewarmer»: real, mayormente humano, improbablemente peligroso); *Being Wrong* atribuía a Talarico y Rubin (2003) un resultado que no midieron (centrales mejor que periféricos); *The Highly Sensitive Person* decía que el libro «insiste en los costes» y confundía los dos grupos de 1997 con los tres de Lionetti 2018; *When Prophecy Fails* omitía la objeción reciente de Kelly (2026, en línea 2025) y afirmaba que los observadores «evitaban dirigir el grupo»; *The Drunkard's Walk* decía que Miller y Sanjurjo (2018) hallaban un efecto «modesto» y rotulaba Sally Clark como ajeno al libro.

**Patrón repetido (otra vez):** en 8 de 10 borradores la opción correcta era la más larga en muchas preguntas (el lint no lo detecta del todo) y los distractores llevaban absolutos o se descartaban por sentido común; las notas de la biblioteca se presentaban a veces como críticas ya conocidas del libro.

**Visuales:** 57 diagramas (uno por lección) y 10 mapas; caché del service worker v75.

## Séptima entrega (2026-10-24): segunda tanda de las listas del usuario

| Autor | Libro | Eje / sub_eje | Lecc. / preg. |
|---|---|---|---|
| Housel | *Same as Ever* | Economía y Mercados / Economía | 5 / 15 |
| Klein | *Seeing What Others Don't* | Psicología y Conducta / Cognitiva | 5 / 15 |
| Mandelbrot y Hudson | *The (Mis)Behavior of Markets* | Economía y Mercados / Economía | 5 / 15 |
| Parrish | *Clear Thinking* | Pensamiento y Civilización / Epistemología | 6 / 18 |
| Kindleberger | *Manias, Panics, and Crashes* | Economía y Mercados / Economía | 6 / 18 |
| Perrow | *Normal Accidents* | Pensamiento y Civilización / Epistemología | 6 / 18 |
| Konnikova | *The Confidence Game* | Psicología y Conducta / Social | 5 / 15 |
| Guyenet | *The Hungry Brain* | Neurociencia y Biología / Neurociencia | 6 / 21 |
| Yong | *I Contain Multitudes* | Neurociencia y Biología / Biología y Longevidad | 7 / 14 |
| Goldacre | *Bad Science* | Pensamiento y Civilización / Epistemología | 6 / 18 |

**Hallazgos de los verificadores que cambiaron el contenido** (con segunda verificación cuando hubo ERROR de contenido): *The Confidence Game* atribuía a «reciprocidad» y a un estudio sin identificar lo que es el pie en la puerta (Freedman y Fraser 1966, compromiso y coherencia; el nombre salió mal escrito en la primera corrección) y daba los capítulos como «uno por etapa»; *I Contain Multitudes* atribuía a Turnbaugh 2006 el estudio de 12 obesos (es de Ley, Turnbaugh, Klein y Gordon) y afirmaba que el pulgón eliminó genes duplicados (el genoma muestra complementariedad con *Buchnera*); *The Hungry Brain* atribuía a *Publishers Weekly* «seis indicaciones» sin fuente y tenía vaga la crítica a Walker (Guzey 2019); *Normal Accidents* citaba una crítica a informes del sector eléctrico que ninguna fuente confirma; *Bad Science* daba dos importes incompatibles de las costas del caso Rath y un distractor que imputaba una falsificación a una persona real. *The (Mis)Behavior of Markets*: sin errores de hechos; se precisaron Hurst, GARCH, Lo (1991) y el matiz de media-varianza.

**Patrón repetido (otra vez):** en casi todos los borradores la opción correcta era la más larga y las explicaciones decían «las otras opciones»; hubo que igualar longitudes en todas las preguntas, no solo en las señaladas.

**Visuales:** 57 diagramas (uno por lección) y 10 mapas; caché del service worker v77.

## Octava entrega (2026-10-24): tercera tanda de las listas del usuario

| Autor | Libro | Eje / sub_eje | Lecc. / preg. |
|---|---|---|---|
| Nagoski y Nagoski | *Burnout* | Psicología y Conducta / Juego y bienestar | 5 / 15 |
| Lefèvre | *Reminiscences of a Stock Operator* | Economía y Mercados / Economía | 6 / 18 |
| Warburton | *A Little History of Philosophy* | Pensamiento y Civilización / Filosofía | 6 / 18 |
| Mukherjee | *The Emperor of All Maladies* | Neurociencia y Biología / Biología y Longevidad | 6 / 18 |
| Ramachandran y Blakeslee | *Phantoms in the Brain* | Neurociencia y Biología / Neurociencia | 6 / 18 |
| Binmore | *Game Theory: A Very Short Introduction* | Economía y Mercados / Economía | 8 / 24 |
| Fine | *Testosterone Rex* | Psicología y Conducta / Social | 5 / 15 |
| Heath y Heath | *Switch* | Desarrollo Humano / Mentalidad | 6 / 18 |
| Sandel | *Justice* | Pensamiento y Civilización / Filosofía | 7 / 21 |
| Carroll | *Endless Forms Most Beautiful* | Neurociencia y Biología / Biología y Longevidad | 6 / 18 |

**Hallazgos de los verificadores que cambiaron el contenido** (con segunda verificación cuando hubo ERROR de contenido): *The Emperor of All Maladies* atribuía a Fisher una comparación con la mastectomía radical (era la total; la radical de Halsted fue el ensayo de Veronesi) y sobrevendía RAS 1982 («una mutación puede bastar»); *Phantoms in the Brain* decía que el efecto del agua fría «se comunica en un solo paciente» (falso en general) y llamaba «posterior» a Chan 2007; *Switch* llamaba «independiente» a la revisión Cochrane de 2015 (incluye 13 de 72 estudios de Wansink), situaba mal el relato de los guantes y daba «dos comunidades» donde el estudio de 1998 solo confirma una; *Endless Forms* citaba un «comentario de Nature de 2006» que no se localiza, tomaba Shapiro 2004 como posterior al libro y atribuía a Ronshaugen, McGinnis y McGinnis lo que es de Galant y Carroll (onicóforo); *Justice* tenía una contradicción interna sobre las tres vías y atribuía a *Justice* lo que Sandel dice en *Liberalism and the Limits of Justice* (1982); *Testosterone Rex* atribuía las cifras de Hyde 2005 a un resumen y mezclaba quién sostiene el relato criticado; *Reminiscences* incluía el método de la muerte de Livermore (se quitó); *Game Theory* tenía una frase duplicada y sobrevendía el teorema popular y la aproximación de Rubinstein (Binmore, Rubinstein y Wolinsky 1986).

**Cautelas que se mantienen:** no se pudo leer el texto de ninguno de los libros (todo lo atribuido viene de reseñas, índices y resúmenes). En *Justice* los dos verificadores discreparon sobre si la pareja equidad/degradación es de *Justice* o de *What Money Can't Buy*; se dejó como «lectura nuestra». En *Switch* se quitó el «424» de los guantes porque no se pudo verificar. En *Testosterone Rex* las cifras de Hyde van como «aprox.» según fuentes secundarias.

**Patrón repetido (otra vez):** la opción correcta era la más larga y las explicaciones decían «las otras opciones» en casi todos los borradores.

**Visuales:** 63 diagramas (uno por lección) y 10 mapas; caché del service worker v79.
