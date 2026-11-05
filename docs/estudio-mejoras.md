# Estudio de mejoras para Mente fría (5 nov 2026)

Alcance: calidad del contenido, variedad y cantidad, organización y presentación, retención de la atención, retención del aprendizaje y difusión. Base: los datos reales de la base de datos (solo del dueño, así que son datos de un caso, no de una población), el código y la documentación del proyecto, y una búsqueda web puntual. Cada recomendación dice qué evidencia la sostiene y cuánta confianza tengo. **Nada de esto está hecho**: es una propuesta para ordenar y decidir.

## 1. Dónde estamos (datos del 5 nov 2026)

| Señal | Dato | Lectura |
|---|---|---|
| Biblioteca | 493 libros · 3.579 lecciones · 11.401 preguntas · 157 retos (17 libros) | El contenido ya excede con mucho lo que se consume. |
| Lectura | 72 lecciones leídas (2 %) de 38 libros | El cuello de botella es el consumo, no la cantidad. |
| Apertura de la app | 88 aperturas en 19 días (≈ 4–5 por día de uso) | El hábito de abrir la app **ya existe** (antes casi no la abría). |
| Mazo de fichas | 123 fichas vistas; solo ≈ 5 acabaron en «Leer» (≈ 10 lecturas en total en los últimos 3 días) | El mazo atrapa atención pero rara vez lleva a lectura completa. No es necesariamente malo (la ficha ya enseña), pero hoy no sabemos qué valor aporta. |
| Repaso espaciado | 293 tarjetas activas, 268 vencidas, 25 revisadas alguna vez | El 91 % está vencido: la «deuda» vuelve a aparecer a menor escala. |
| Funciones sin uso | notas 0 · subrayados 0 · respuestas a retos 0 (acaban de activarse) | Lo que exige escribir no se usa; lo que se consume con el pulgar sí. |
| Calidad | 1.555 lecciones (43 %) sin idea clave; 171 libros sin ninguna; 928 lecciones (26 %) sin pregunta; 182 libros (37 %) sin portada; 0 avisos «¿Algo no cuadra?» | La idea clave alimenta el mazo y «Para ti»: casi la mitad del corpus **no puede aparecer** ahí. Cero avisos no significa cero errores (ver §2). |

## 2. Calidad del contenido (lo más importante para el dueño: no adquirir conceptos erróneos)

**Hallazgo:** en una sola pasada de figuras (4 nov) aparecieron tres errores en lecciones ya publicadas (Kleiber +75 % en vez de ≈ +68 %, «catorce órdenes de magnitud», Asch 70 % frente a ≈ 75 %) y ninguno había llegado por el canal de avisos. Con 3.579 lecciones, el error probable no es raro y el canal pasivo no lo detecta.

1. **Auditoría sistemática de cifras** (prioridad máxima). Extraer de cada lección las afirmaciones con número, año o atribución y verificarlas por lotes con agentes independientes y búsqueda web, empezando por las 70 figuras con números y por los libros más leídos. Coste: alto, pero se puede escalonar y se autolimita por lotes. Beneficio: el que más pesa para tu prioridad.
2. **Transparencia en la lección:** una etiqueta visible «Verificada con búsqueda web (fecha) / Revisión pendiente», y una página «Correcciones recientes» en Tú con lo que se ha corregido y por qué (hoy se corrige sin dejar rastro visible). Genera confianza y hace que «¿Algo no cuadra?» se use.
3. **Hacer el aviso más natural:** botón de «Esto no cuadra» en cada párrafo con cifras, no solo al final de la lección.
4. **Controles automáticos nuevos:** un lint de coherencia numérica (p. ej. que una cifra de la figura coincida con la del texto) y la comprobación por autor de duplicados (hay libros en dos idiomas: «Fluir» y *Flow*).
5. **Honestidad sobre la base empírica:** ya se hace para libros pseudocientíficos; extenderlo con un indicador de «solidez de la evidencia» (alta / discutida / baja) por libro o por lección, redactado con prudencia.

## 3. Cantidad y variedad

**Principio: ya hay suficiente cantidad; falta profundidad, conexión y accesibilidad.** Añadir 500 libros más no cambia lo que se lee (2 %). Propuestas por orden de valor:

1. **Rellenar lo que falta de lo que ya existe** (más barato que libros nuevos y con efecto inmediato):
   - Idea clave para las 1.555 lecciones que no la tienen (extraída del propio texto, sin afirmaciones nuevas; se verifica por muestreo). Efecto: entran en el mazo, «Para ti» y la búsqueda.
   - Preguntas para las 928 lecciones sin ninguna.
   - Portadas para los 182 libros sin ella (hoy se ve un marcador de color).
2. **Hilos por tema** que crucen libros: «Sesgos de la intuición», «Incentivos», «Atención». Ya existe la tubería de cruces (`docs/cruces.md`) y los retos de «choque» entre autores. Es el formato más propio de esta biblioteca y el que ningún resumen de libros ofrece (ver §6).
3. **Retos de pensamiento**: la biblioteca tiene 157 en 17 libros. Extenderlos a más libros solo si los que ya existen se usan (hoy 0 respuestas, aún es pronto). **No ampliar antes de ver uso.**
4. **Libros nuevos con criterio de utilidad**: ya está montada la cola y la puerta de calidad (`docs/libros-preceptos.md`). Prioridad a huecos de uso real (aprendizaje, hábitos, decisión) y a libros que hagan de contrapunto a los existentes.
5. **Formatos más cortos**: «una idea en 60 segundos» (ya hay fichas), y versión de audio de la idea clave para trayectos (ya hay lectura en voz alta en la lección; no hay para fichas).

## 4. Organización y presentación

El uso real que describes es: **entrar por temas, buscar libros de lo que me interesa y leer**. La estructura actual (5 ejes × sub-ejes) es rígida, y acaba de arreglarse el exceso de filtros vacíos.

1. **Etiquetas de tema transversales** (por lección y por libro): «sesgos cognitivos», «hábitos», «incentivos», «historia de las ideas». Se pueden generar y verificar con el mismo método que la idea clave. Con ellas: páginas de tema, mejores recomendaciones y búsqueda semántica por «lo que quiero aprender».
2. **«Empieza por aquí» por tema:** 1–3 libros de entrada (los más accesibles) y un orden de lectura; reutiliza el sistema de rutas que ya existe.
3. **Búsqueda más tolerante:** sinónimos y títulos en ambos idiomas.
4. **Recomendaciones con señales reales** (lo leído, lo guardado, lo que se relee) y explicación visible del motivo (ya hecho en «Para ti»); añadir «Porque guardaste X».
5. **Inicio:** ya reducido a lo esencial. Probar un mes antes de más cambios.

## 5. Retención del aprendizaje

Evidencia (con matices), según una búsqueda web puntual: un metaanálisis de 29 estudios describe un beneficio claro de repartir la práctica de recuperación en el tiempo frente a hacerla seguida (g ≈ 0,74); trabajos sobre práctica de recuperación en clase y en laboratorio dan efectos medios (g ≈ 0,5) con mucha heterogeneidad; y en matemáticas el efecto de «examinarse frente a releer» **no es robusto** y el de espaciar es pequeño-medio. Es decir: espaciar y recuperar ayuda, pero no es magia ni vale igual para todo, y leer ideas no es preparar un examen de cálculo. Fuentes consultadas: [eprints.whiterose.ac.uk/229807](https://eprints.whiterose.ac.uk/id/eprint/229807) y [Int. J. STEM Education 2024](https://doaj.org/article/13125faeb142423695a0e121ef8777ef), además de blogs secundarios. **No he podido confirmar cuál de ellas respalda cada cifra** y los números salen de resúmenes de calidad desigual: no los usaría en la app sin comprobar los originales.

1. **Reprogramar la deuda de repaso sin culpa:** botón «Empezar de cero con lo vencido» que reparta las 268 tarjetas en 2–3 semanas. Es lo que más ayuda a volver a usar el repaso.
2. **Guardar el intento con su fecha** (hoy solo hay contadores) para dibujar la curva de olvido real de cada lección y reprogramar por lo que de verdad se escapa. Ya anotado en `docs/estudio-uso.md` como «posible después».
3. **Predecir antes de leer** (una línea) y **cerrar con una frase propia** con dictado: ambos son baratos y encajan con los retos. Con cautela: no exigir escribir mucho (notas y subrayados llevan en 0).
4. **Entrelazar libros distintos** en el repaso (mezclar ideas de libros relacionados) en lugar de repasar por libro.
5. **Medir** si esto funciona para ti: tasa de acierto por intervalo y retos respondidos por semana. Sin medición no hay forma honesta de saber qué sirve.

## 6. Retención de la atención y hábito

Lo que ya funciona: abrir la app. Lo que falta: pasar de «ver una ficha» a «quedarme con algo».

1. **Guardar una ficha para después** («Me quedo con esto»): un toque, sin escribir. Alimenta el repaso y las recomendaciones, y reduce el coste de actuar. Sustituye a las notas, que no se usan.
2. **Ancla de hábito** (de *Hábitos Atómicos*, con las cautelas de su autocorrección): «después de cenar, a las 22:00», con un aviso propio y el contenido de la idea del día. Ya está anotado como pendiente. Que el aviso lleve contenido, no culpa.
3. **Resumen semanal** de una pantalla: lo leído, las predicciones que vencen, algo que cambió de opinión. Cierra el ciclo de los retos.
4. **Constancia sobria:** ya se muestran siete puntos discretos. Evitar rachas que castiguen.
5. **Cuidar el cómputo:** la rutina de libros avisa del volumen; algo análogo para otros procesos automáticos.

## 7. Compartir

Hoy existe el enlace de invitado a un libro (`?carta=1`) y, desde esta semana, cuentas de otros miembros con su propio progreso (alta manual desde Supabase).

1. **Compartir una idea como imagen** (título, frase, libro, enlace): generada en el cliente, sin datos personales. Es el formato más compartible y refuerza el «me quedo con esto».
2. **Compartir una lección o un hilo por tema** con una vista previa legible (hoy los enlaces de GitHub Pages no tienen vista previa propia: requeriría páginas estáticas generadas por libro).
3. **Invitar desde la app** (solo el dueño): crear miembro con su correo, para que añadir a alguien deje de ser un proceso manual de varios pasos como el de esta semana.
4. **Lista de lectura compartida** (p. ej. «para mi madre»): una selección de lecciones adecuada a otra persona, sin tocar su progreso.
5. **Privacidad primero:** nunca compartir datos de uso ni progreso; las políticas por usuario ya lo garantizan en la base de datos.

## 8. Comparación con otras herramientas (con cautela)

Lo que encontré son comparativas de terceros y blogs de las propias empresas, no estudios; úsese solo como orientación. [Shortform](https://www.shortform.com/blog/shortform-vs-blinkist/) se posiciona en profundidad, conexiones entre libros y ejercicios de reflexión, y Blinkist en velocidad y volumen; Readwise pone el peso en volver a mostrar lo subrayado con repaso espaciado. [Un caso publicado por una empresa de marketing](https://phiture.com/success-stories/blinkist-inapp/) atribuye a los mensajes dentro de la app un aumento de libros añadidos, sin datos que permitan juzgar el tamaño. Lo diferencial de Mente fría, y lo que yo reforzaría: **conexión entre autores**, **crítica incluida en cada lección**, **verificación**, y retos para pensar, no solo resumir.

## 9. Propuesta de orden

**Ahora (dos semanas; barato y de alto valor):**
1. Idea clave para las 1.555 lecciones (efecto inmediato en mazo, «Para ti» y búsqueda).
2. Auditoría de cifras, empezando por figuras y por los libros más leídos.
3. «Me quedo con esto» + compartir idea como imagen.
4. Reprogramar la deuda de repaso.
5. Instrumentar el embudo ficha → guardar → leer → repasar.

**Después (un mes):** etiquetas de tema y páginas de tema; «Empieza por aquí»; ancla de hábito con aviso; resumen semanal; transparencia de verificación y «Correcciones recientes»; invitar desde la app.

**Más adelante, solo si los datos lo piden:** más retos, audio de fichas, páginas estáticas con vista previa, más libros.

## 10. Límites de este estudio
- Los datos de uso son de una persona; sirven para decidir, no para generalizar.
- La evidencia sobre repaso espaciado y práctica de recuperación es sólida en general pero heterogénea; no se ha medido su efecto en esta app.
- Las comparativas con otras herramientas vienen de fuentes de calidad desigual.
- No he probado la app en un móvil real durante este estudio.

## Piloto de ideas clave (5 nov 2026)
Se escribieron y aplicaron **50 ideas clave** (50 libros distintos) a lecciones que no la tenían; con huellas md5 sin diferencias entre lo verificado y lo guardado. Proceso: generador (agente) → control mecánico `tools/libros/idea-lint.js` (longitud, cifras y vocabulario presentes en la lección, sin comillas ni fórmulas vacías) → verificador independiente contra el texto de la lección (35 correctas, 15 corregidas, 0 descartadas) → corrección → aplicación.
- **Hallazgo:** el control mecánico por sí solo no basta (el 30 % necesitó corrección humana o de verificador): la crítica de la lección aparecía sin atribuir, se daba más certeza de la que da la lección, se fundían dos cosas distintas o quedaba jerga sin explicar.
- **Coste:** ≈ 360.000 tokens por 50 lecciones (≈ 7.000 por lección); las 1.555 restantes serían ≈ 11 millones. Decisión del dueño: parar aquí y no ampliar por ahora.
- Las ideas salen de ≈ 200 caracteres de media (máximo 220) porque llevan la tesis y su salvedad; para fichas del mazo quizá convenga ≤ 160 si se continúa.
