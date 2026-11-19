# Ficha: cómo escribir el esquema de una lección

Cada lección de «Mente fría» lleva una figura (un esquema en JSON que la app dibuja como SVG). Estas 624 lecciones no la tienen.
Tu trabajo: una **figura principal por lección** que muestre en 10 segundos **cómo se organiza la idea central**.
La figura también sale en un vídeo vertical (móvil): textos cortos y claros.

## Reglas (de más a menos importante)

1. **Todo sale de la lección.** Usa solo lo que dicen `cuerpo`, `idea_clave`, `cita_memorable` (es una idea redactada por la app, NO una cita), `autocorreccion` (el matiz) y `aplicacion_practica`. `conexion_cruzada` es contexto: no dibujes de ahí.
   **No añadas hechos, cifras, nombres, fechas, estudios ni ejemplos que la lección no contenga.** Cifras y nombres propios: solo los literales del texto. Puedes condensar y reformular, nunca cambiar el sentido: no intensifiques ni generalices («siempre», «nunca», «todos», «demuestra»… solo si el texto lo dice así).
2. **La tesis es del autor, no un hecho.** Lo que la lección presenta como postura de un autor se escribe «según X» o «X sostiene…» (en un bloque o en el pie). Si el `autocorreccion` dice que algo está discutido, es una síntesis o una hipótesis, el **pie** lo reconoce en pocas palabras («Tesis del autor; …»). Nunca presentes una hipótesis o una interpretación como dato.
3. **No inventes estructura.** Elige la plantilla por lo que la lección dice de verdad:
   - `pasos`: la lección da un orden o un proceso (3–6 pasos).
   - `comparar`: la lección contrapone dos cosas (dos columnas con 2–5 elementos).
   - `mapa`: un concepto con varias facetas, sin orden (centro + 3–6 nodos).
   - `ciclo`: un proceso que vuelve al principio (3–6 nodos).
   - `piramide`: niveles con orden de la cima a la base (3–5).
   - `espectro`: un continuo entre dos polos con 3–5 casos colocados (pos 0–1 aproximada).
   - `matriz`: dos ejes cruzados en 2×2 (4 celdas) que la lección cruza explícitamente.
   - `cifras`: 1–6 cifras LITERALES del texto.   - `tiempo`: 2–7 fechas LITERALES del texto.
   - Si la lección contiene claramente un bucle causal con signos, un embudo, una escalera, una decisión en cadena, capas o un iceberg, puedes usar esa plantilla (sin `"adicional"`): léete antes `docs/esquemas-estructurales.md`. Las cuantitativas (`grafica`, `barras`, `formula`, `tabla`, `arbol`, `venn`, `recta`) solo si la lección da los números; léete `docs/graficos-matematicos.md`.
   - **Variedad:** hoy el 70 % de todas las figuras son `comparar` o `pasos`. Usa esas dos cuando sea lo que la lección hace, pero no encasilles: muchas lecciones son un concepto con facetas (`mapa`), una escala (`espectro`) o un ciclo.
4. **Mejor una figura sobria y fiel que una vistosa e inventada.** Si la lección es difusa, haz un `mapa` con el concepto central y sus facetas tal como el texto las nombra, o `pasos`/`comparar` solo con lo que el texto estructura. Toda lección debe quedar con figura.

## Formato (siempre `{"tipo":"diagrama","plantilla":…,"titulo":…,"pie":…,"datos":{…}}`)

- `titulo` (≤ 64 caracteres): nombra el concepto, no una frase llamativa. `pie` (≤ 130): UNA frase que dice qué mirar o la salvedad (tesis del autor, discutido, ilustrativo). Los dos son obligatorios.
- Texto de bloque (`t`) ≤ 40 caracteres, descripción (`d`) ≤ 90. Español de España con tildes y ñ.
- Tonos (opcional, por bloque): `a` dorado (neutro principal) · `ok` favorable/correcto · `mal` problema o riesgo · `info` azul informativo · `psi` mental · `mute` secundario. `ok`/`mal` solo si la lección valora así.

| plantilla | `datos` | límites |
|---|---|---|
| pasos | `{"pasos":[{"t":"…","d":"…","tono":"ok"}]}` | 3–6 pasos |
| comparar | `{"izq":{"t":"…","tono":"mal","items":["…","…"]},"der":{"t":"…","tono":"ok","items":["…","…"]}}` | `t` ≤ 30; 2–5 items por lado |
| mapa | `{"centro":"…","nodos":[{"t":"…","d":"…","tono":"info"}]}` | centro ≤ 30; 3–6 nodos |
| ciclo | `{"centro":"…","nodos":[{"t":"…"}]}` (el último vuelve al primero) | 3–6 nodos; centro ≤ 24 |
| piramide | `{"niveles":[{"t":"…","d":"…"}]}` (el primero es la cima, el último la base) | 3–5 niveles |
| espectro | `{"polos":["Uno","Otro"],"tonoA":"ok","tonoB":"mal","marcas":[{"pos":0.1,"t":"…","d":"…"}]}` | 2 polos; 3–5 marcas, `pos` 0–1 |
| matriz | `{"ejeX":{"nombre":"…","izq":"…","der":"…"},"ejeY":{"nombre":"…","arriba":"…","abajo":"…"},"celdas":[arriba-izq, arriba-der, abajo-izq, abajo-der con {"t","d","tono"}]}` | exactamente 4 celdas |
| cifras | `{"items":[{"n":"85 %","t":"qué mide, tal como lo dice la lección"}]}` | 1–6; `n` con dígitos |
| tiempo | `{"eventos":[{"f":"1974","t":"…"}]}` | 2–7; `f` con dígitos |

Ejemplos reales (de figuras ya verificadas):
```json
{"tipo":"diagrama","plantilla":"comparar","titulo":"La fe según Lewis","pie":"No es creer sin evidencia.","datos":{"izq":{"t":"Idea común","tono":"mute","items":["Creer sin evidencia","Idea que sorprende a creyentes y escépticos"]},"der":{"t":"Fe como virtud epistémica","tono":"ok","items":["Mantener lo que la razón aceptó","Aunque las emociones presionen en contra"]}}}
{"tipo":"diagrama","plantilla":"mapa","titulo":"Sectores en crecimiento de Kostolany","pie":"Donde se hacen las grandes fortunas especulativas.","datos":{"centro":"Sectores en crecimiento","nodos":[{"t":"Años 50","d":"La televisión transforma el consumo"},{"t":"Años 80","d":"La informática personal se hace ubicua"},{"t":"Años 90","d":"Internet"}]}}
{"tipo":"diagrama","plantilla":"piramide","titulo":"Observar, hipotetizar, conjeturar","pie":"Rotular así es lectura nuestra. Barrett, Panksepp y LeDoux discrepan sobre emociones discretas y sentimientos animales.","datos":{"niveles":[{"t":"Conjetura sobre la experiencia","d":"Sentimiento: estado subjetivo, sin acceso directo","tono":"mal"},{"t":"Hipótesis sobre el estado emocional","d":"Emoción detectable desde fuera","tono":"a"},{"t":"Descripción de conducta","d":"Postura, voz, expresión facial, pulso, hormonas","tono":"ok"}]}}
```

## Cómo trabajar y qué entregar
- Lee tu fichero de entrada (lista de lecciones con `id`, `libro`, `autor`, `titulo`, `cuerpo`, …). Lee **cada lección entera** antes de dibujarla.
- Escribe el resultado como JSON `{ "<id de la lección>": [ <figura> ] }` en el fichero de salida que se te indique. Una figura por lección, todas las lecciones de tu entrada.
- Trabaja por tandas de ~10 lecciones y guarda el fichero después de cada una.
- Comprueba con el linter del proyecto (NO escribe nada, solo comprueba): `cd /home/user/Mf && node tools/datos/agregar.mjs diagramas <salida.json> --solo-lint`. Repite hasta «rechazadas: 0».
- Comprueba también el apoyo en el texto (cifras, nombres y palabras que no estén en la lección): `node tools/datos/apoyo.mjs <salida.json> <entrada.json>`. Corrige cada ERROR (quita o reformula lo que la lección no dice); los AVISOS, revísalos y arregla los que sean de verdad.
- **No modifiques el repositorio** (ni `datos/`, ni `lib/`): solo tus ficheros de salida.
