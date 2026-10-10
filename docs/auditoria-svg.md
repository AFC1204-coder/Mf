# Auditoría de calidad de los SVG antiguos

10 oct 2026 · datos: Supabase `aduizdiiacrvpoavjmab` (solo lectura) · reutilizable: `supabase/auditoria_svg.sql`

## Resumen

**Los SVG antiguos no están a la altura y conviene rehacer casi todos.** No son un problema de
seguridad (ninguno lleva scripts, eventos ni imágenes externas), sino de legibilidad y acabado:
se hicieron con modelos antiguos y casi todos tienen el texto demasiado pequeño para un móvil.

| Qué | Cifra |
|---|---|
| Lecciones cuya **única** imagen es un SVG antiguo (`imagen_principal`) | **1.550** de 2.120 |
| Lecciones con el diagrama nuevo (motor `lib/diagram.js`) | 563 |
| Lecciones sin ninguna imagen | 7 |
| SVG antiguos analizados | 1.528 (más 22 que no se pueden leer, ver abajo) |
| …con texto **ilegible en móvil** (< 8 px efectivos) | **1.368 (≈ 90 %)** |
| …con **todo** su texto menor de 10 px | 1.528 (100 %) |
| Texto más pequeño de la imagen, mediana | **7 px** |
| Textos individuales < 8 px (muestra de 1.383) | 65 % |
| Con palabras **sin tilde** («Prediccion», «planificacion», «disenador») | ≥ 205 (≈ 13 %) |
| Casi vacíos (< 1,5 KB) | 87 |
| **Corruptos** (base64 que no decodifica como UTF-8) | **22** |
| Con lienzo distinto de 400 px de ancho (proporciones heterogéneas) | 57 (solo en base64) |

Cada lección tiene su propia imagen distinta (no hay duplicados), así que el problema no es la
reutilización sino la calidad.

## Cómo se ha medido

- **Legibilidad:** se asume un ancho de contenido de ~350 px en móvil. Un texto de `font-size` F en un
  lienzo de ancho W se ve a F·350/W px. Por debajo de 8 px no se lee; para texto de apoyo la
  referencia razonable es ≥ 11 px. En ordenador (columna más ancha) el texto se ve ~2× mayor, así
  que allí el problema es menos grave pero sigue siendo pequeño.
- **Tildes:** heurística sobre palabras terminadas en «-cion»/«-sion» sin acento. Es un indicador, no un
  corrector ortográfico: la cifra real de erratas es mayor.
- **Limitaciones:** no he mirado cada imagen una a una; las medidas son automáticas y se
  contrastaron con una muestra de 12 SVG leídos a mano (aleatorios, los más cortos, los más largos,
  base64 y el formato `utf8,`). No se detectan solapes de texto ni desbordes de cajas, que seguramente
  existen en los más densos (p. ej. el de los «10 mandamientos», con 20 líneas de texto a 7 px).

## Qué dicen las muestras

- Diseño correcto como idea (cajas, flechas, paleta oscura coherente con la app), pero **texto de 6–9 px**
  sobre un lienzo de 400×300.
- Los más densos meten una lista entera en una sola imagen (20 líneas, texto a 6–7 px): en móvil
  son manchas.
- Los más simples son decoración: un círculo, una línea de tendencia y tres frases.
- Faltas de tilde y de ñ («Prediccion Entrenable», «sin disenador», «Las instituciones evolucionan sin planificacion»).
- Un caso mezcla un ideograma (道) a 14 px con opacidad 0,3: ni se ve.

## Propuesta: rehacerlos con un modelo actual, pero como *especificación*, no como SVG libre

El motor `lib/diagram.js` ya dibuja 10 plantillas (pasos, matriz, ciclo, comparar, espectro,
pirámide, mapa, curva, cifras, tiempo) a partir de un JSON corto (`lecciones.imagenes_inline`).
Ese diseño ya resolvió los problemas de arriba por construcción:
tamaño de texto mínimo, ajuste de líneas, tema claro/oscuro, accesibilidad y consistencia.

Por eso, cuando mandes rehacerlos, lo recomendable es que el modelo **no dibuje el SVG**, sino que
escriba la especificación (qué plantilla y con qué textos) y que el motor lo dibuje. Ventajas:

1. **Legible siempre** (el motor impone tamaños y saltos de línea).
2. **Barato y rápido** (unas decenas de tokens por lección, no un SVG de 3 KB).
3. **Verificable**: se valida la especificación (longitudes, nº de elementos, plantilla existente) antes de guardarla.
4. **Editable** después sin volver a generar.
5. Los textos salen de la lección (idea clave, giro, aplicación): menos riesgo de inventar.

### Orden sugerido
1. **22 corruptos** y **87 casi vacíos**: se rehacen primero (hoy no aportan nada o no se ven).
2. **≥ 205 con faltas de tilde**: se ven mal y dañan el tono riguroso.
3. Las lecciones de las **rutas** (Pensar con claridad, Decidir con riesgo, Dinero y mercados, Emociones y atención, Economía básica…), porque es lo que lee quien sigue una ruta.
4. El resto, por libro.

La consulta de `supabase/auditoria_svg.sql` devuelve ya la lista con esa prioridad por lección.

### Criterios de aceptación de cada imagen nueva
- Una sola idea por imagen; máximo ~6 bloques de texto y ≤ 8 palabras por bloque.
- Texto efectivo ≥ 11 px a 350 px de ancho.
- Español correcto con tildes y ñ; cifras y nombres solo si están en la lección.
- Pie (`pie`) de una frase que diga qué hay que ver.
- Sin citas inventadas ni datos que la lección no contenga.

### Mientras tanto
Los SVG antiguos siguen mostrándose donde no hay diagrama nuevo. Si molesta, se puede ocultar el
SVG antiguo cuando su texto mínimo sea < 8 px; no lo he hecho para no dejar 1.550 lecciones sin
imagen. Dímelo si lo prefieres.
