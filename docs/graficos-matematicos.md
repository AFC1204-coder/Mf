# Gráficos y esquemas de matemática sencilla

Además de las diez plantillas cualitativas (`pasos`, `comparar`, `matriz`, `ciclo`, `espectro`, `piramide`, `mapa`, `curva`,
`cifras`, `tiempo`), hay siete **cuantitativas** para las lecciones donde la matemática ayuda a afianzar el concepto. No
sustituyen a las otras: **se suman** (`"adicional": true`) al diagrama que la lección ya tenga y salen repartidas por el texto,
junto al párrafo que ilustran.

Código: `lib/diagram.js` · reglas: `lib/lint-visual.js` · pruebas: `tests/diagram.test.js`, `tests/lint-visual.test.js`.

## Cuándo usar una (y cuándo no)

Solo si la lección **contiene** una relación que se entiende mejor viéndola:

| La lección habla de… | Plantilla |
|---|---|
| la forma de una relación: convexa, saturación, rendimientos decrecientes, ley de potencias, colas gruesas, curva de Preston | `grafica` |
| comparar cantidades concretas (porcentajes, frecuencias, tasas) | `barras` |
| una regla o fórmula con símbolos (Kelly, Hamilton, valor esperado, regla de Bayes) | `formula` |
| pagos de un juego, una tabla de 2×2 con casos (falsos positivos), frecuencias cruzadas | `tabla` |
| probabilidades encadenadas, casos y subcasos, decisión con resultados | `arbol` |
| lo que dos o tres ideas tienen en común y en lo que difieren | `venn` |
| una escala numérica con umbrales o valores señalados (probabilidades 0–1, porcentajes) | `recta` |

**No** uses una figura cuantitativa si la lección es cualitativa, si no hay ninguna relación numérica que mostrar o si el
número lo pondrías tú. Es mejor **ninguna** figura nueva que una decorativa o inventada.

## Reglas de exactitud (las que más importan)

1. **Los números salen de la lección.** Todo valor que se vea (cifras, porcentajes, ejes con escala, pagos, probabilidades)
   debe estar en el texto de la lección o ser un cálculo directo de números que están en ella (el complemento, un total, una
   proporción). No añadas ejemplos numéricos propios «para que quede bonito».
2. **Una curva sin datos reales es una forma, no un dato.** Si la lección describe solo la *forma* (convexa, se aplana,
   cola gruesa), pon `"sinEscala": true`: no se dibujan números en los ejes, y el `pie` debe decir que es ilustrativa
   («Forma ilustrativa…»; el lint lo exige).
3. **Una fórmula debe estar en la lección** (o ser su definición directa). Si la lección la enuncia en palabras, escríbela
   con símbolos solo si es exactamente lo que dice. Atribuye con cuidado: «según el autor», no «la verdad».
4. **Comprueba las cuentas** (con `node -e`): sumas, complementos, valores esperados, que las curvas pasen por los puntos
   que señalas. Un error de cálculo en una figura es peor que no tener figura.
5. `titulo` (≤ 64) y `pie` (≤ 130) obligatorios; el pie dice de dónde sale o qué es («Datos de la lección…», «Forma
   ilustrativa…»). Textos en español correcto, con tildes; decimales con **coma** en los textos y con **punto** en las
   expresiones `f`.

## Formatos

Todas son `{ "tipo": "diagrama", "plantilla": "…", "titulo": "…", "pie": "…", "adicional": true, "datos": { … } }`.
Tonos: `a` (dorado) · `ok` · `mal` · `info` · `psi` · `mute`.

**grafica** — plano cartesiano. `f` es una expresión de `x` (sin `eval`: solo números, `x`, `+ - * / ^`, paréntesis, `pi`, `e`
y `sqrt exp ln log10 log2 abs sin cos tan min max`; nada de `2x`, escribe `2*x`). O bien `puntos: [[x,y],…]`.
```json
{ "xmin": 0, "xmax": 4, "ymin": 0, "ymax": 16, "ejeX": "Tamaño", "ejeY": "Efecto",
  "series": [ { "f": "x^2", "t": "Convexa", "tono": "a", "x": 3.2, "lado": "arriba-izq" },
              { "f": "4*x", "t": "Lineal", "tono": "info", "discontinua": true } ],
  "puntos": [ { "x": 2, "y": 4, "t": "Mismo valor", "tono": "ok", "lado": "abajo-der" } ],
  "lineas": [ { "y": 1, "t": "Máximo", "tono": "mute" } ],      // o { "x": 2, "t": "…" }
  "zonas": [ { "x0": 0, "x1": 3, "t": "Rápido", "tono": "ok" } ],
  "sinEscala": false, "alto": 250 }
```
Hasta 3 series, 5 puntos, 3 líneas, 3 zonas. `ejeX` y `ejeY` obligatorios (qué se mide). La curva se recorta en los bordes.

**barras** — barras horizontales con su valor. `ref` marca una referencia (p. ej. el azar).
```json
{ "unidad": "%", "items": [ { "t": "Placebo", "v": 30 }, { "t": "Fármaco", "v": 52, "tono": "ok" } ],
  "ref": { "v": 30, "t": "Placebo", "tono": "mal" } }
```
2–8 barras; admite valores negativos.

**formula** — hasta 3 líneas grandes y la lista «donde» con el significado de cada símbolo. Aquí sí se permite `<` y `>`.
```json
{ "lineas": ["r · B > C"], "terminos": [ { "s": "r", "t": "parentesco entre quien ayuda y quien recibe" },
  { "s": "B", "t": "beneficio para quien recibe", "tono": "ok" } ], "nota": "Ayudar compensa si…" }
```

**tabla** — 2–4 columnas, 1–5 filas; `resaltar` marca celdas `[fila, columna]` (desde 0).
```json
{ "esquina": "Tú \\ El otro", "cols": ["Coopera", "Traiciona"],
  "filas": [ { "t": "Cooperas", "c": ["3 · 3", "0 · 5"] }, { "t": "Traicionas", "c": ["5 · 0", "1 · 1"] } ],
  "resaltar": [[1, 1]], "tono": "mal" }
```

**arbol** — raíz y 2–4 ramas; cada rama puede llevar hasta 3 subramas (8 hojas como máximo). `t` es la etiqueta de la
rama (la probabilidad), `n` el texto del nodo.
```json
{ "raiz": "1000 personas", "ramas": [
  { "t": "1 %", "n": "Enfermos (10)", "tono": "mal", "ramas": [ { "t": "90 %", "n": "Positivo (9)" }, { "t": "10 %", "n": "Negativo (1)" } ] },
  { "t": "99 %", "n": "Sanos (990)", "tono": "ok", "ramas": [ { "t": "10 %", "n": "Positivo (99)" }, { "t": "90 %", "n": "Negativo (891)" } ] } ] }
```

**venn** — dos o tres conjuntos; `centro` es lo común; `d` describe cada conjunto.
```json
{ "conjuntos": [ { "t": "Lo que sabes", "d": "Lo comprobado", "tono": "info" }, { "t": "Lo que crees", "d": "Lo que das por hecho", "tono": "a" } ], "centro": "Sesgo" }
```

**recta** — recta numérica con marcas e intervalos.
```json
{ "min": 0, "max": 1, "intervalos": [ { "x0": 0.05, "x1": 0.2, "t": "Raro", "tono": "mal" } ],
  "marcas": [ { "x": 0.5, "t": "Moneda", "tono": "a" }, { "x": 0.95, "t": "Casi seguro", "tono": "info" } ] }
```

## Herramientas

```bash
node tools/datos/agregar.mjs diagramas lote.json --solo-lint   # comprueba sin escribir
node tools/datos/galeria.mjs lote.json salida.png               # dibuja el lote con los estilos reales para revisarlo a ojo
node tools/datos/agregar.mjs diagramas lote.json --anadir       # suma las figuras a las que la lección ya tiene
```
El lote es `{ "idLección": [ figura, … ] }`. Con `--anadir` cada figura debe llevar `"adicional": true`.
Dónde se colocan en la lección: la primera tras el primer párrafo y las demás repartidas por el texto, siempre tras un
párrafo corrido (`Visuales.colocarFiguras`).
