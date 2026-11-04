# Esquemas estructurales (seis plantillas más)

Además de las diez cualitativas y las siete de matemática sencilla (`docs/graficos-matematicos.md`), hay **seis plantillas
estructurales** para ideas que no son una secuencia ni una comparación: realimentación, pérdida por etapas, progresión,
decisión en cadena, anidamiento y lo visible frente a lo oculto. Como las cuantitativas, **se suman** (`"adicional": true`)
a la figura que la lección ya tenga y salen repartidas por el texto junto al párrafo que ilustran.

Código: `lib/diagram.js` · reglas: `lib/lint-visual.js` · pruebas: `tests/diagram.test.js`, `tests/lint-visual.test.js`.
Flujo de trabajo: `node tools/datos/agregar.mjs diagramas lote.json --anadir [--solo-lint]` y
`node tools/datos/galeria.mjs lote.json salida.png` para verlas con la hoja de estilos real.

## Cuándo usar cada una (y cuándo no)

| La lección describe… | Plantilla | No la uses si… |
|---|---|---|
| un ciclo causal donde A influye en B, B en C y C vuelve a A (círculo vicioso o virtuoso, termostato, adicción) | `bucle` | solo es una secuencia de pasos (usa `ciclo`) o la causalidad no está en la lección |
| una pérdida por etapas: de muchos a pocos | `embudo` | las cifras no bajan (usa `barras`) o no hay etapas de filtrado |
| niveles que se suben en orden (de menos a más) | `escalera` | las fases no son una progresión (p. ej. etapas del duelo, que la propia lección dice que no son lineales) |
| una regla de decisión con preguntas de sí o no y su consecuencia | `flujo` | es un consejo general sin la lógica «si… entonces…» |
| una estructura de capas contenidas unas en otras | `capas` | la lección **desmiente** esa estructura (p. ej. el cerebro «triuno») o es una jerarquía (usa `piramide`) |
| lo observable frente a causas o factores no observables | `iceberg` | solo es una lista de factores sin la contraposición visible/oculto |

Como siempre: **mejor ninguna figura que una decorativa o inventada**. Todo lo que dice la figura sale de la lección.

## Formatos

Todas son `{ "tipo": "diagrama", "plantilla": "…", "titulo": "…", "pie": "…", "adicional": true, "datos": { … } }`.
Tonos: `a` · `ok` · `mal` · `info` · `psi` · `mute`.

**bucle** — 3–5 nodos y **un signo por flecha** (nodo *i* → nodo *i+1*; el último vuelve al primero).
`+` = cambian en el mismo sentido (más A → más B); `−` = en sentido contrario (más A → menos B). La figura **calcula sola**
si es de refuerzo (nº par de `−`, «R · Refuerzo») o de equilibrio (impar, «B · Equilibrio»): no se escribe a mano, así no
puede contradecir a los signos. Cada signo debe poder justificarse con una frase de la lección.
```json
{ "nodos": [ { "t": "Más ansiedad" }, { "t": "Más evitación" }, { "t": "Menos práctica" }, { "t": "Menos confianza" } ],
  "signos": ["+", "+", "−", "−"], "nombre": "Evitar mantiene el miedo" }
```

**embudo** — 3–5 etapas, de la más ancha a la más estrecha. La **anchura no está a escala** (solo ilustra); si se ponen
cifras `v`, todas las etapas las llevan, deben **bajar** y salir de la lección.
```json
{ "unidad": "personas", "etapas": [ { "t": "Lo conocen", "v": "1.000" }, { "t": "Lo prueban", "v": "200", "d": "Opcional" }, { "t": "Lo mantienen", "v": "20" } ] }
```

**escalera** — 3–6 escalones; el 1 es el más bajo y se sube.
```json
{ "escalones": [ { "t": "Primero", "d": "Opcional" }, { "t": "Segundo" }, { "t": "Tercero" } ] }
```

**flujo** — 1–4 preguntas de sí o no (acaban en `?`). El «no» sale a un lado; el «sí» baja a la siguiente y, si todas son sí,
al `final`.
```json
{ "inicio": "Opcional", "decisiones": [ { "p": "¿Hay un dato nuevo?", "no": "Probablemente es presión social", "tonoNo": "mal" } ],
  "final": { "t": "Revisa tu postura", "d": "Opcional", "tono": "ok" } }
```

**capas** — 2–4 capas, de la más externa a la más interna.
```json
{ "capas": [ { "t": "Cultura", "d": "Lo que se da por hecho" }, { "t": "Normas" }, { "t": "Conducta" } ] }
```

**iceberg** — 1–3 elementos visibles y 2–5 ocultos; etiquetas opcionales (≤ 14 caracteres).
```json
{ "visibles": [ { "t": "Lo que se hace" } ], "ocultos": [ { "t": "Creencias" }, { "t": "Miedos y deseos" } ],
  "etiquetaVisible": "Se ve", "etiquetaOculto": "No se ve" }
```

## Límites del lint
Títulos de bloque ≤ 40 (en `bucle`, ≤ 28), descripciones ≤ 90, título de la figura ≤ 64, pie ≤ 130. En `flujo`: pregunta ≤ 70,
salida «no» ≤ 60. `embudo` rechaza cifras que crecen o que no llevan todas las etapas.
