# Incorporación autónoma de libros: preceptos de calidad y de utilidad

Objetivo: que la biblioteca crezca sola sin que se cuelen conceptos erróneos ni libros que no sirvan. La prioridad del dueño es **no adquirir conceptos erróneos**; ante la duda, no se publica. Los preceptos de abajo no son consejos: los comprueba `tools/libros/puerta.js` (con pruebas en `tests/libro-puerta.test.js`) y, si falla uno, el libro no se publica solo.

## Piezas
| Pieza | Qué hace |
|---|---|
| Cola `libros_candidatos` (Supabase) | Libros por añadir, con motivo de utilidad, prioridad y estado (`pendiente` · `en_curso` · `publicado` · `en_revision` · `descartado`). La rutina elige de aquí y no improvisa. Cualquiera puede añadir candidatos pidiéndoselo a Claude. |
| `tools/libros/puerta.js` | La puerta: `publicar` · `revisar` · `rechazar` · `esperar`. También puntúa y elige el siguiente candidato. |
| `tools/libros/lint.js` | Forma del paquete (cifras y citas declaradas, preguntas, autores del corpus). |
| `tools/libros/prompts/` | Generador y verificador (agentes distintos). |
| `tools/libros/huellas.js` | Comprueba que lo cargado en la base de datos es idéntico a lo verificado. |
| Rutina semanal | Domingos por la mañana (hora de Madrid). Sigue `.claude/skills/nuevo-libro/SKILL.md`. |

## Preceptos de calidad (los aplica la puerta)
1. **Forma:** pasa el lint sin errores (mínimo 4 lecciones; cada cifra y cada cita literal declaradas y verificadas; preguntas bien formadas).
2. **No duplicar:** título y autor no coinciden con ningún libro de la biblioteca.
3. **Honestidad:** el paquete declara su confianza. `baja` no se publica sola.
4. **Verificación independiente** por un agente distinto del que escribió el libro, con búsqueda web. Si el verificador rechaza, se rechaza. Si hubo algún ERROR de contenido, hace falta **una segunda verificación sobre el texto corregido** y debe salir sin ERROR.
5. **Lo cargado es lo verificado:** antes de publicar, las huellas `md5` de lo cargado en la base de datos coinciden con el paquete (0 diferencias).
6. **Temas de riesgo no se publican solos:** consejo accionable de salud, de dinero o de sexualidad pasa a `en_revision` y espera el visto bueno del dueño. Los de baja base empírica (pseudociencia, tipologías) pueden entrar, pero siempre atribuidos («el modelo del libro») y con su crítica en cada lección.
7. **Sin tope de libros por semana** (decisión del dueño, 5 nov 2026): si hay libros que encajan, se añaden. Solo hay un **aviso de volumen**: a partir de 5 publicados en 7 días (contados en `libros_candidatos`) la rutina deja una notificación al dueño para que valore el consumo de cómputo, y sigue. Y **máximo 5 avisos «¿Algo no cuadra?» abiertos**: si hay más, se atienden antes que cualquier libro nuevo.

## Preceptos de utilidad (guían la elección y los comprueba la puerta)
1. **Cubre un hueco o conecta:** se prefieren sub-ejes poco poblados y libros que dialoguen con autores que ya están (la puntuación suma hasta 15 puntos por hueco).
2. **Cada lección sirve para actuar:** todas traen una aplicación práctica concreta (≥ 120 caracteres) y al menos la mitad conectan con otros autores de la biblioteca (≥ 200 caracteres).
3. **Cada lección trae su crítica:** la autocorrección nombra límites reales (replicación, sesgos, alcance), no vaguedades.
4. **Preferir lo que el dueño usa:** aprendizaje, hábitos, decisión, economía, historia de las ideas, biología y mente. Se evitan las obras de base mayormente anecdótica e invariablemente promocional.
5. **Visuales después:** tras publicar, un esquema por lección y un mapa por libro (herramienta `tools/datos/agregar.mjs`) y, si procede, retos de pensamiento (`docs/retos-pensamiento.md`). Esto lo hace una sesión con el dueño, no la rutina.

## Flujo (lo que hace la rutina, en orden)
1. Avisos abiertos > 5 → termina sin publicar. Si ya se publicaron 5 o más en 7 días, además deja una notificación al dueño (volumen alto) y sigue.
2. Elige candidato (`puerta.elegirCandidato`), lo marca `en_curso`.
3. Generador (agente) → barajar + lint.
4. Verificador independiente → corrector si hace falta → segunda verificación si hubo ERROR.
5. `puerta --fase cargar`: si no es `publicar`, el candidato pasa a `en_revision` (o `descartado` si `rechazar`) con el informe y termina.
6. Carga oculta (`publico=false`, `activa=false`) y huellas.
7. `puerta --fase publicar --huellas-ok`. **Modo actual (5 nov 2026): aprobación del dueño.** La rutina no publica: deja el libro oculto y cargado, marca el candidato `en_revision` con `veredicto_puerta='publicar'` y el informe, y deja una notificación («Libro listo para revisar»). El dueño lo mira y pide publicarlo (o Claude lo publica en una sesión con su visto bueno); entonces el candidato pasa a `publicado` con fecha, `libro_id` e informe. Cuando el dueño se fíe, se cambia este modo a publicación automática.
8. Registro: queda en `libros_candidatos.informe`; el dueño (o Claude en una sesión) lo vuelca después a `docs/libros-nuevos.md`. La rutina no necesita escribir en el repositorio.

## Qué no hace la rutina
Publicar libros de salud, finanzas o sexualidad; saltarse la segunda verificación; tocar libros ya publicados; cargar nada si las huellas no coinciden. Revertir un libro: `delete` en `preguntas`, `lecciones` y `libros` por `libro_id`, o ocultarlo con `publico=false`.

## Por qué existe este documento
La rutina semanal anterior (creada el 12 oct) no llegó a publicar ningún libro: el 1 nov calculó mal su tope (contó como «de esta semana» unos 45 libros de cargas masivas del 25–26 oct) y no hizo nada; además no podía abrir PRs porque `gh` no tenía sesión. Ahora no hay tope (solo un aviso de volumen sobre lo que publica la propia rutina), la cola evita improvisar candidatos y el registro vive en la base de datos.
