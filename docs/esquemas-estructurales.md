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

## Figuras ya puestas en lecciones (4 nov 2026)
Se buscaron candidatas con una búsqueda por palabras en toda la biblioteca y se leyó cada lección: **la gran mayoría se descartó**
(la estructura no estaba en el texto, la lección la desmentía —cerebro «triuno», etapas del duelo— o ya tenía una figura
equivalente). Las que quedaron pasaron por un verificador independiente, que corrigió 7 de 12 y quitó 2 (el «bucle de escasez»,
cuyas flechas la lección no establece como causas con signo, y un iceberg redundante con la figura que la lección ya tenía).
Quedan 10 figuras en 8 lecciones:
- **bucle** (6): el termostato y los bucles de equilibrio/refuerzo (*Thinking in Systems*), la espiral deuda-deflación de Fisher
  (*Great Mental Models*), los círculos vicioso y virtuoso (*Why Nations Fail*), la trampa de la adicción y la deriva a bajo
  rendimiento (*Thinking in Systems*).
- **escalera** (1): los cuatro niveles de ingresos de Rosling (*Factfulness*).
- **flujo** (1): los tres tests de la intuición (*Educating Intuition*).
- **iceberg** (1): el mapa de inmunidad al cambio (*Immunity to Change*).
- **embudo** (1): los criterios de Graham para el inversor defensivo (*The Intelligent Investor*).
- **capas**: ninguna, porque ninguna lección candidata describía capas contenidas unas en otras.

Lo que cada verificación cambió: el signo de cada flecha se justifica con una frase de la lección; el pie atribuye («según los
autores») y separa la «lectura nuestra» de la biblioteca; los umbrales del embudo se contrastaron uno a uno con el texto.

## Segunda tanda (4 nov 2026)
Se buscaron otras ~100 lecciones candidatas (y se leyeron todas las de *Thinking in Systems* y *The Fifth Discipline* en busca de
bucles). Se propusieron 12 figuras; un verificador independiente quitó 1 (redundante con la que la lección ya tenía) y corrigió 7
(sobre todo pies que atribuían como «de la lección» lo que era lectura de la biblioteca, nodos o rótulos imprecisos, y un embudo
cuya cifra 98 = 9 + 89 es cálculo nuestro y ahora se declara). Quedan **11 figuras** más:
- **bucle** (4): la erosión de objetivos (equilibrio) y el desplazamiento de la carga (refuerzo) de Senge; la burbuja de 2003-2007
  como bucle reflexivo (*La Alquimia de las Finanzas*); la coevolución herramientas-cognición (*Digital Behavior*, la más débil:
  el cierre del bucle es implícito).
- **escalera** (1): los seis peldaños de la escalera de inferencia (*The Fifth Discipline*).
- **flujo** (1): la regla de Taleb «no arriesgar lo que no puedes perder» (*Skin in the Game*).
- **iceberg** (3): sesgo de disponibilidad con el caso de la polio, patrones de control (*Evite Ser Utilizado*) y los cuatro marcos
  de pensamiento de los agresores (*In Sheep's Clothing*; lectura de la biblioteca).
- **embudo** (1): de 1.000 personas a quién está realmente enferma (*Reckoning with Risk*).
- **capas** (1): el Círculo Dorado de Sinek (tres anillos concéntricos).
Total con la primera tanda: 21 figuras en 18 lecciones. Siguen sin descubrirse capas «contenidas» en casi ninguna lección.

## Cinco plantillas más: relación y clasificación
Misma política que las anteriores: **se suman** a la figura que la lección ya tenga, todo sale de la lección y es mejor ninguna que una
decorativa. Plantillas: `fuerzas`, `red`, `reparto`, `jerarquia` y `posicion` (total: 28).

| La lección describe… | Plantilla | No la uses si… |
|---|---|---|
| lo que empuja hacia un cambio y lo que lo frena, alrededor de un estado actual | `fuerzas` | solo es una lista de pros y contras (usa `comparar`) |
| varias ideas y cómo se relacionan entre sí (A modera a B, B limita a C…) con la relación **dicha por la lección** | `red` | la relación no está enunciada, o es una secuencia (usa `pasos`) o un ciclo causal con signos (usa `bucle`) |
| cómo se reparte un todo en partes con cifras (50 / 40 / 10 %) | `reparto` | las cifras no están en la lección, o comparas cantidades que no son partes de un todo (usa `barras`) |
| una clasificación: una categoría general, sus tipos y ejemplos de cada uno | `jerarquia` | los «tipos» no son de la lección, o es una jerarquía de poder/orden (usa `piramide`) |
| elementos situados según dos dimensiones cualitativas (poco/mucho esfuerzo, poco/mucho efecto) | `posicion` | la colocación sería un invento: si el autor no sitúa los elementos, no la pongas |

**fuerzas** — `{"estado":{"t":"…","d":"…"},"impulsan":[{"t":"…"}],"frenan":[{"t":"…"}],"etiquetaImpulsan":"Empujan","etiquetaFrenan":"Frenan"}` (etiquetas ≤ 20) ·
1–4 por lado. Las flechas apuntan al estado central desde ambos lados.
**red** — `{"nodos":[{"t":"…"}],"relaciones":[{"de":0,"a":1,"t":"moldean"}]}` · 3–6 nodos (texto ≤ 32) y hasta 8 relaciones; `de` y `a` son índices de
`nodos`; la etiqueta es obligatoria y corta (≤ 14). **Ordena los nodos para que las relaciones principales unan vecinos**: se
colocan en círculo y las flechas entre nodos opuestos cruzan la figura. Ningún nodo puede quedar sin relación.
**reparto** — `{"unidad":"%","partes":[{"t":"…","v":50,"d":"…"}],"total":100}` · 2–6 partes con valores positivos; las anchuras son
proporcionales. Con `%` no pueden sumar más de 100; si suman menos, el resto se pinta aparte como «(calculado)» y **el pie debe
decir que es el complemento**.
**jerarquia** — `{"raiz":"…","ramas":[{"t":"…","hijos":[{"t":"…","d":"…"}]}]}` · 2–4 ramas, hasta 4 elementos por rama y 10 en total.
**posicion** — `{"ejeX":{"izq":"…","der":"…"},"ejeY":{"abajo":"…","arriba":"…"},"puntos":[{"t":"…","x":0.2,"y":0.7,"tono":"ok"}]}` · 2–7
puntos con x e y entre 0 y 1. Es una colocación cualitativa: **el pie debe decir que es aproximada o ilustrativa**.

### Primeras figuras con las cinco plantillas nuevas (4 nov 2026)
De ~100 lecciones candidatas, los agentes propusieron 13 figuras; un verificador independiente quitó 1 (la repartición 50/40/10 de
*The How of Happiness*, redundante con la figura de cifras que la lección ya tiene) y corrigió 10, sobre todo pies que decían «de la
lección» donde la agrupación era lectura nuestra, una descripción que afirmaba que el donante profesional «vende» sangre, y la
colocación de «tabaco y alcohol» en el plano de Slovic, que dos lecciones sitúan de forma incompatible (se quitaron). Quedan **12
figuras**:
- **jerarquia** (4): clases de emoción de Damasio, tipos de donante de Titmuss (agrupación nuestra), tres modelos de negocio de
  Christensen y los cuatro apeles de *Verbal Judo*.
- **fuerzas** (1): lo que empuja y frena el cambio de una convención (Lewis; clasificar en empuje/freno es lectura nuestra).
- **posicion** (1): el plano de dos dimensiones del riesgo percibido de Slovic (posición aproximada).
- **reparto** (2): tres grupos de sensibilidad en la muestra de Lionetti (31/40/29 %) y el reparto de tiempo 70/30 de *Make It Stick*
  (la lección no dice que sea el reparto óptimo).
- **red** (4): coordinación tácita (Schelling), cooperación (Axelrod), redes fractales (West), elaboración y generación (*Make It Stick*).
Mejoras de motor surgidas al revisarlas: la etiqueta de una relación de la red se coloca donde no tape nodos ni otras etiquetas (y
debajo si la flecha es corta), el eje de `posicion` no se rellena y el centro de `fuerzas` admite palabras más largas.
Total acumulado: 33 figuras en 30 lecciones.

## Tres plantillas más: círculos, carriles y balanza (total: 31)
| La lección describe… | Plantilla | No la uses si… |
|---|---|---|
| anillos concéntricos que el autor enuncia como tales (círculos de influencia, de confianza, el círculo dorado) | `circulos` | el anidamiento es una metáfora o no es del autor (usa `capas`, rectangulares, si basta) |
| dos líneas de hechos con **fechas** que corren en paralelo (dos tradiciones, dos países, dos bandos) | `carriles` | las fechas no están en la lección, o solo hay una línea (usa `tiempo`) |
| dos lados que se sopesan (costes y beneficios, a favor y en contra) y **la lección dice cuál pesa más** o que se equilibran | `balanza` | la inclinación la decidirías tú: si el autor no la da, usa `equilibrio`, o `comparar` |

**circulos** — `{"anillos":[{"t":"Exterior","d":"…"},{"t":"…"},{"t":"Centro"}]}` · 2–4 anillos, del exterior al centro (t ≤ 24, d ≤ 40).
**carriles** — `{"carriles":[{"t":"Economía","eventos":[{"f":"1776","t":"…","d":"…"}]},{"t":"Psicología","eventos":[…]}]}` · exactamente 2
carriles, 1–5 hechos cada uno (≤ 8 en total). Cada hecho lleva una **fecha con dígitos que sale de la lección**; se ordenan por la
primera cifra de la fecha y **el espaciado no está a escala** (di en el pie «sin escala» si importa).
**balanza** — `{"izq":{"t":"Beneficios","items":["…"]},"der":{"t":"Costes","items":["…"]},"inclina":"izq"}` · 1–4 elementos por lado;
`inclina` = `izq`, `der` o `equilibrio` (por defecto). Si se inclina, **el pie debe decir de quién es la conclusión** («Según la
lección…»): el lint lo exige.

### Cuarta tanda (4 nov 2026): 11 figuras más
Segunda pasada amplia (~60 lecciones leídas con las plantillas ya existentes) y búsqueda dirigida para círculos, carriles y balanza. De
12 propuestas, el verificador quitó 1 y corrigió 7 (pies, un nodo del bucle de las finanzas que la lección no sostenía, un rótulo
de las fuerzas institucionales, un título que presentaba como hecho lo que la lección da como hipótesis).
- **bucle** (3): espiral de la escuela del barrio (Hirschman), reflexividad ascendente (*La Alquimia de las Finanzas*), el ciclo económico de
  Marks (lectura de la biblioteca: el cierre es cualitativo).
- **escalera** (2): los niveles de la realidad de Polanyi (*The Tacit Dimension*; emergencia discutida) y las cuatro instrucciones del
  experimentador de Milgram, de menor a mayor presión.
- **jerarquia** (2): señales del protocolo de McGilchrist (cognitivas, emocionales, somáticas) y culturas de honor, dignidad y victimización.
- **reparto** (1): la curva de adopción de Rogers (2,5 / 13,5 / 34 / 34 / 16 %).
- **iceberg** (1): problemas perpetuos en la pareja (Gottman; ejemplo hipotético de la lección, no aplicable ante maltrato).
- **fuerzas** (1): por qué se mantiene un equilibrio institucional (Greif; el empuje es lectura de la biblioteca).
- **balanza** (1): la lista de Darwin sobre casarse (la lección dice que concluyó que le convenía; el peso de las razones no es medible).
Quitada: la diana de tres anillos de *Traction* (la lección ya tiene una pirámide con exactamente los mismos tres niveles).
**`circulos` y `carriles` aún no tienen ninguna lección**: las búsquedas no encontraron anillos concéntricos enunciados por el autor
ni dos líneas de hechos fechados en paralelo. Total acumulado: 44 figuras en 41 lecciones.

### Quinta tanda (4 nov 2026): 12 figuras más
Tercera pasada (lecciones no vistas antes). De 17 propuestas, el verificador descartó 5 (el bucle de Hoppe, cuyo cierre no dice la
lección; la escalera de Minervini, con solo un estadio descrito; y tres que repetían una figura ya existente) y corrigió 7 pies o rótulos.
- **bucle** (1): mercado de limones (*Micromotives and Macrobehavior*; posibilidad lógica, estudios empíricos divididos).
- **escalera** (4): el camino del aprendizaje (Greene), el ciclo del retador (Dalio; sesgo declarado), los seis estadios de Kurzweil y los
  tres grados del Estado natural (*Violence and Social Orders*; el pie niega el progreso inevitable).
- **flujo** (1): regla de los 5 segundos y clusters (Houston; indicio, no prueba de engaño).
- **embudo** (1): repetición espaciada (cifras de olvido de la lección; el resto es complemento calculado, declarado en el pie).
- **jerarquia** (3): tres juegos de estatus (Storr), racionalidad diseñada frente a ecológica (*Humanomics*) e ignorancia conocida frente a pura (Kirzner).
- **iceberg** (1): aranceles, lo visible y lo oculto.
- **carriles** (1): Darwin, Wallace y Mendel (la primera lección con carriles; solo 2+2 fechas).
Total acumulado: 56 figuras.

## Un solo estilo
Todas las plantillas nuevas reutilizan las clases de las de siempre (`dg-box`, `dg-t`, `dg-d`, `dg-rule`, `dg-dot`, `dg-bar`, `dg-arrow`, los
tonos `tn-*` y las variables CSS de color y tipografía), así que cambian solas con el tema oscuro, el claro y el modo Kindle. Se
comprobó poniendo cada nueva junto a su equivalente antigua en los tres modos y se igualaron los detalles que desentonaban: la
balanza usa los títulos de color, la regla y las viñetas de `comparar`; la raíz de `jerarquia` va centrada como los niveles de
`piramide`; las barras de `reparto` son tan finas como las de `barras`. Regla para futuras plantillas: nada de colores ni fuentes
propios, y mirar siempre la figura antigua más parecida antes de dar por buena una nueva.
