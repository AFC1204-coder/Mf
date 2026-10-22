# Cruces entre libros (sección Ensayos)

Un «cruce» es un ensayo que une lecciones de varios libros con esquemas, cápsulas de texto, lecciones de origen y preguntas.
Sustituye a los ensayos libres anteriores: todo lo que afirma tiene una lección de origen y distingue lo que dice el autor, lo que
señala la nota crítica de la lección y lo que es lectura cruzada nuestra.

## Tubería
1. **Descubrir candidatos** (`tools/cruces/prompts/prompt-descubrir.txt`): agentes buscan grupos de 4–6 lecciones de libros distintos que converjan, se tensen o se complementen.
2. **Generar** (`prompt-generar.txt`): un paquete JSON por cruce. Incluye la lista de errores frecuentes aprendidos en los pilotos.
3. **Lint** (`node tools/cruces/lint.js paquete.json [--barajar]`): forma, longitudes, esquemas válidos, preguntas con al menos 2 libros, la correcta no es la más larga en más de 2 de 5.
4. **Verificación independiente** (`prompt-verificar.txt`): otro agente contrasta cada afirmación con el texto real de las lecciones en la BD. Los pilotos necesitaron 2–3 rondas (verificar → corregir → reverificar): lo más habitual fue atribuir al autor lo que es nota crítica de la lección o una lectura nuestra.
5. **Cargar**: `node tools/cruces/a-sql.js --publico datos/cruces/*.json` genera el SQL para la tabla `articulos` (`lectura_cruzada` → `sintesis_original`). Es idempotente por título. Solo se carga con `--publico` lo ya verificado.

## Estado
- `datos/cruces/` guarda los 10 paquetes piloto verificados (00–09).
- La pantalla Ensayos solo muestra filas con `publico = true`. Los 11 ensayos antiguos (marzo de 2026) están con `publico = false`: no pasaron por esta verificación y alguno afirma que un autor «demuestra» cosas que sus lecciones no sostienen.

## Carga en la base: ids de libros

La columna `articulos.libros_referenciados` es `uuid[]` (ids de la tabla `libros`), no una lista de títulos. `tools/cruces/a-sql.js` exige un mapa `--libros=mapa.json` con `{ "título tal como figura en el paquete": "uuid" }`, y se detiene si falta alguno. El mapa sale de `select id, titulo from libros where titulo in (...)` (en algunos libros el título de la base lleva subtítulo: hay que casar por el título que usa el paquete y comprobar que cada uno devuelve una sola fila). Con la herramienta `execute_sql`, un `;` dentro de un texto cuelga la llamada: se sortea escribiendo cada `;` interno como `'||chr(59)||'` (mismo texto final).
