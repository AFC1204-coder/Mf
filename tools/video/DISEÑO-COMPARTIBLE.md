# Piezas compartibles: diseño

Por qué existe `--format compartir`, qué decide y qué deja fuera. Uso y opciones: [`README.md`](README.md).

## El problema

Los formatos `clase` y `corto` cuentan un libro como una **serie**: presentación, una lección por episodio, repaso; cabecera de aplicación, índice de secciones, «Lección 3 de 8», «Venimos de la lección anterior…». Eso es fiel a la web y por eso mismo no viaja: quien se cruza con un episodio suelto en un feed ve otra pata de una página que no conoce.

El formato nuevo parte de la pregunta contraria: **¿qué entiende alguien que ve esto solo, sin sonido, tres segundos, sin saber qué es Mente Fría?** Y mantiene intacta la regla que más ha costado: la voz y la pantalla solo dicen texto del corpus.

## Qué es una unidad compartible

**Una idea de una lección, con su matiz y su crédito, en 30-60 s.** No un libro resumido, no una lección entera: una afirmación, de dónde sale y dónde se le discute. Es la unidad natural del corpus (cada lección ya tiene `idea_clave`, esquema y `autocorreccion`) y es lo que distingue a la biblioteca de un canal de frases: aquí la idea viene con su límite.

De ahí sale un catálogo de cinco piezas. Todas se montan solas con campos del corpus; cada una usa un campo que las otras no explotan y **abre de una manera distinta**, así que las piezas de una misma lección no se pisan.

| Pieza | Abre con (gancho) | Centro | Campos |
|---|---|---|---|
| **`idea`** — la principal | La idea misma, en frío | El esquema, pieza a pieza | `idea_clave` · `datos/diagramas.json` · `autocorreccion` |
| `pregunta` | Una pregunta de la lección | 3 s de pausa, respuesta y porqué | `preguntas` · `autocorreccion` |
| `practica` | Qué probar | La idea que hay detrás | `aplicacion_practica` · la idea · `autocorreccion` |
| `caso` | El caso concreto que la lección cuenta | La idea que hay detrás | cuerpo («Un ejemplo:», «Imagina que…») · la idea · `autocorreccion` |
| `libro` | El libro en una frase | Sus ideas centrales | `datos/mapas.json` |

Lo que se repite en todas (y da la identidad): **gancho → contenido → «Del libro X, de Y» → «El matiz» → cierre que retoma el gancho**. El estribillo es deliberado: quien ve dos piezas reconoce la tercera.

## El arco: contar la idea, no enumerar frases

Una pieza no es texto sobre fondo. La `idea` tiene cinco tiempos y cada uno hace un trabajo:

| Tiempo | Qué pasa | De dónde sale | Para qué |
|---|---|---|---|
| **Tensión** | La idea, en frío. Si la propia lección arranca con una pregunta breve, primero esa pregunta y la idea la resuelve | `idea_clave` · primera frase del cuerpo | Abrir un hueco en los dos primeros segundos |
| **Origen** | «Del libro X, de Y» | fórmula + títulos | Saber quién lo sostiene antes de seguir |
| **Desarrollo visible** | La estructura entera primero; después se recorre pieza a pieza con el patrón visual que le va | `datos/diagramas.json` | Que se vea *cómo* es la idea: qué se opone a qué, qué lleva a qué |
| **Giro** | «El matiz»: cambia el color, la letra y el tono | `autocorreccion` | Lo que la idea no dice: el límite |
| **Cierre** | «Quédate con esto»: el gancho otra vez, escrito, junto a la marca | el mismo tramo literal del principio | Un solo mensaje para llevarse; el arco se cierra donde se abrió |

En `pregunta` el arco es pregunta → espera → respuesta, y el cierre deja escrita **la respuesta**. En `practica`, qué hacer → por qué → límite. En `caso`, lo concreto antes que lo abstracto: el ejemplo → la idea que ilustra → límite, y lo que se lleva uno es la idea.

**El caso no se adivina.** Solo vale el que el corpus introduce de forma explícita («Un ejemplo:», «Por ejemplo», «Imagina que…», «En un experimento…»): la frase que lo abre y las que la siguen en su párrafo, enteras, hasta 45 palabras. Si la frase solo lo anuncia («Un ejemplo cotidiano ayuda a verlo.») y no cabe lo que sigue, no hay pieza; tampoco si la lección no tiene idea redactada que ilustrar. Los avisos del propio corpus («un ejemplo nuestro», «propio y no del libro») se dicen tal cual.

### El patrón visual sale de la forma de la idea

La figura verificada de cada lección ya dice qué tipo de idea es. La regla de selección (`PATRONES` en `compartir.py`) usa su plantilla; los textos son siempre los rótulos literales, en su orden.

| Plantilla de la figura | Patrón | Qué se ve | Por qué | En la biblioteca |
|---|---|---|---|---|
| `comparar` | **Contraste** | Dos paneles enfrentados. Primero los dos títulos (la oposición); después se abre un lado, luego el otro, y el ya visto se recoge en su título | La idea está en la diferencia: hay que ver los dos lados a la vez | 1.632 piezas `idea` (44 %) |
| `pasos`, `piramide`, `tiempo` | **Cadena** | Eslabones unidos por un hilo. Primero todos los títulos (el camino entero); después cada eslabón se abre en su turno, los pasados quedan y los que faltan esperan vacíos. En una línea de tiempo, cada eslabón es su fecha | La idea está en el orden: causa → efecto, antes → después | 1.022 (27 %) |
| `mapa` | **Radial** | El centro arriba (con su apostilla, si la tiene) y, colgando de él, lo que sale: se abre una rama cada vez | Un concepto y sus partes; no hay orden, así que no se numera | 649 (17 %) |
| `ciclo` | **Ciclo** | La cadena, con su centro y una flecha que devuelve del último eslabón al primero | Lo que importa es que vuelve a empezar | 154 (4 %) |
| `espectro` | **Espectro** | Una recta entre dos polos con cada posición marcada donde la figura la pone; la que toca se enciende y su tarjeta va debajo | La idea es un continuo, no dos cajas | 107 (3 %) |
| `cifras` | **Cifra** | El número, enorme, y debajo qué mide | El dato es el mensaje | 39 (1 %) |
| `matriz` | **Matriz** | Los cuatro cuadrantes con sus dos ejes; al recorrerla, cada cuadrante se sitúa con sus dos coordenadas y un mini-mapa | Dos criterios que se cruzan | 27 (0,7 %) |
| `escalera`, `capas`, `embudo` → cadena · `balanza` → contraste · `bucle` → ciclo · `jerarquia` → radial | (los de arriba) | Las mismas formas con otro nombre. Un `bucle` solo si todos sus pasos refuerzan (un «−» cambia el sentido y no se vería); una `jerarquia` solo si cabe sin dejar texto fuera | — | incluidas arriba (≈ 34) |
| Las demás (`iceberg`, `formula`, `red`, `flujo`, `grafica`, `arbol`, `curva`…) | — | Sin esquema: idea y matiz | Aún sin patrón propio; enteras serían ilegibles | 55 (1,5 %) |

Todos los patrones se dibujan en HTML/CSS con los datos de la figura (no pasan por `lib/diagram.js`): así el texto va grande **dentro** de la forma, junto a aquello de lo que habla. Además enseñan lo que la silueta de la primera versión dejaba fuera: el **centro** de mapas y ciclos (y su apostilla, a veces un «lectura nuestra»), los **polos** del espectro y los **extremos y nombres de los ejes** de la matriz.

**Y dentro de la frase.** Cuando la idea tiene la forma «no X, sino Y» (191 ideas, el 5 %), el texto cinético lo señala sin cambiar una palabra: al llegar el «sino», lo negado se apaga y se tacha, y lo afirmado se queda en color. Si la frase es breve va entera en una página para que el contraste se vea junto (64 piezas); «no solo… sino también» no niega nada y no se toca.

### Cuando la lección no da para un arco

No se fuerza. `pieza_idea` clasifica (`arco` en el manifiesto) y degrada con honestidad:

| Caso | Qué hace | En la biblioteca (3.719 lecciones) |
|---|---|---|
| Idea que se sostiene sola + figura recorrible + matiz | **Arco completo** | 3.481 (93,6 %) |
| Sin figura recorrible | Idea → origen → matiz → cierre (`sin_esquema`) | 55 (1,5 %) |
| Sin idea redactada y con un arranque que solo habla del libro («Newport dedica una sección…», «Una de las contribuciones del libro es…») | Abre el esquema, que sí dice algo, y cierra con su pie (`esquema_primero`). No hay pieza `practica`: no habría idea que poner detrás | 183 (4,9 %) |
| Ni idea ni figura | **No hay pieza**; queda anotado | 0 |

## En qué se apoya (y hasta dónde llega la evidencia)

Principios de la investigación sobre aprendizaje con multimedia y sobre atención que guían decisiones concretas. La mayoría vienen de estudios de laboratorio con lecciones de varios minutos y estudiantes; **nadie los ha probado en piezas de 45 s vistas en un feed**, así que aquí son razones de diseño, no garantías. No se ha medido nada con espectadores.

| Principio | Qué dice | Dónde está en la pieza | Límite |
|---|---|---|---|
| Coherencia (carga cognitiva) | Lo accesorio resta | Una cosa en pantalla; sin índice, contador, foto ni música | Efecto sólido en laboratorio; lo «interesante pero irrelevante» distrae más a novatos |
| Señalización | Dirigir la mirada ayuda | La ráfaga que suena y la pieza activa van en color; lo demás se atenúa | Efecto pequeño-moderado; mayor con material complejo |
| Segmentación | Mejor en trozos con respiro | Páginas de 14 palabras, una escena por pieza del esquema, pausa antes del matiz y de la respuesta | Estudiado con ritmo que controla el alumno; aquí el ritmo lo pone el vídeo |
| Contigüidad espacial y temporal | Palabra e imagen, juntas y a la vez | El texto de cada pieza va dentro de su panel y entra cuando la voz lo nombra (comprobado al fotograma) | — |
| Organizador previo / preentrenamiento | Ver la estructura antes de los detalles | Los títulos de todas las piezas antes de recorrerlas | Ayuda sobre todo a quien no conoce el tema |
| Codificación dual y **redundancia** | Voz + imagen se suman; voz + el mismo texto + imagen puede estorbar | El patrón visual lleva la estructura y la voz el contenido. **Aquí se decide en contra del principio de redundancia a propósito:** el texto dicho también se escribe, porque en redes se ve mucho sin sonido. Se mitiga con texto breve, sincronizado y sin otra imagen compitiendo en las escenas de frase | Es la decisión más discutible del formato. Con sonido, una versión con menos texto podría entenderse mejor; habría que medirlo |
| Práctica de recuperación / generación | Intentar responder antes de ver fija más | Pieza `pregunta`: 3 s de espera con cuenta atrás | Efecto robusto con preguntas sobre algo ya estudiado; antes de estudiarlo (como aquí) el efecto es menor y menos seguro |
| Espaciado | Volver a lo mismo más tarde | El orden del manifiesto: la `pregunta` y la `practica` de una lección salen después de su `idea`, con otras piezas en medio | Depende de que alguien siga la cuenta; para quien ve una sola pieza no existe |
| Ejemplo concreto | Lo concreto antes que lo abstracto | La pieza `caso` abre con el ejemplo que la lección cuenta y solo después da la idea. **No se inventan ejemplos** | Solo 482 lecciones (13 %) traen un caso reconocible; las piezas `idea` siguen siendo abstractas |
| Personalización | El tono conversacional ayuda | Apenas: las fórmulas son llanas («Quédate con esto», «Pruébalo») pero el texto del corpus es expositivo y no se reescribe | Efecto modesto; no compensa tocar el contenido |
| Hueco de información, novedad | La curiosidad nace de saber que falta algo | Afirmación o pregunta en el primer fotograma; rótulo «EL MATIZ» a solas un instante antes del giro | Bien descrito, difícil de predecir caso a caso; se evita el cebo: lo que se abre, se cierra |
| Variación frente a habituación | El cambio sostiene la atención | Cuatro registros visuales por pieza (frase, crédito, patrón, matiz), cortes cada ~1,3 s y barra de progreso | Sin datos propios |
| Un solo mensaje final | Lo último se recuerda mejor | «Quédate con esto» repite el gancho, literal | — |

Lo que **no** se ha hecho de la lista de técnicas posibles: sonidos de apoyo o fondo sonoro (habría que oírlos con la voz real para no estorbar), énfasis prosódico (depende del motor de voz) y metáforas visuales que no estén en el corpus (un objeto que se transforma, una escala): sin una figura verificada detrás serían contenido inventado.

## ¿Cuenta la historia? Rúbrica y lectura crítica

Rúbrica de una pieza `idea` (un punto por criterio):

1. **Se entiende sola**: el gancho no habla del libro ni de «la lección», y dice algo.
2. **Tiene tensión**: afirma, opone o pregunta en la primera frase.
3. **El desarrollo se ve**: hay patrón visual y corresponde a la forma de la idea.
4. **Tiene giro**: lleva el matiz.
5. **Cierra lo que abre**: lo último escrito es el gancho (o la respuesta).

Medido de forma automática en las 3.719 piezas `idea` de la biblioteca: criterio 1, 95 % (el 5 % restante abre con el esquema); criterio 3, 98,5 %; criterios 4 y 5, 100 % por construcción y por control (`lint_pieza`); **los cinco, 93,6 %** (arco completo). El criterio 2 no se puede medir con reglas fiables: se evaluó leyendo.

Lectura crítica de 14 guiones `idea` elegidos al azar, antes de introducir la detección de arranques huecos: 8 salían de `idea_clave` y los 8 funcionaban solos (afirmación clara, giro nítido en el matiz); de los 6 que salían del cuerpo, 3 funcionaban («Las emociones no son perturbaciones irracionales…») y **3 no decían nada** («Una de las contribuciones más prácticas del libro es…», «Newport articula su argumento central en dos dimensiones…», «Robbins dedica una sección significativa…»). Esos tres son el motivo de `ARRANQUE_META` y del arco `esquema_primero`; los tres quedan ahora detectados. Qué se recuerda tras leerlos: en 11 de 14, una frase y su «pero»; en los otros, el tema. Es una lectura de una sola persona sobre guiones, no una prueba con espectadores.

### Por qué la idea abre en frío

Se probó abrir con la pregunta de la lección (como hace `clase`). Dos problemas: la idea no siempre contesta esa pregunta —y una pregunta que el vídeo no responde es un cebo—, y la misma pregunta abriría también la pieza `pregunta`. Una afirmación fuerte ya es un gancho («Las malas decisiones suelen deberse a cuatro villanos…»), y encima deja el tema de la lección a la vista como rótulo. La pregunta se queda para su propia pieza, donde sí se responde.

### Por qué la pregunta no enseña las opciones

Las opciones de la biblioteca suman 65 palabras de mediana: no caben en una pieza corta. Y hay una razón más seria: tres de cada cuatro son **falsas**, y una captura de pantalla con una opción falsa bien rotulada es exactamente un concepto erróneo en circulación. La pieza enseña la pregunta, deja pensar y da solo la respuesta correcta (literal) y el arranque de su explicación.

## El guion: qué se elige y qué no se toca

Nada se redacta. El guion **selecciona y recorta por frases enteras**; lo demás son las once fórmulas de `FORMULAS` (`compartir.py`) y los rótulos de `ROTULOS`. El control (`lint_pieza`) comprueba tramo a tramo que lo que dice venir del corpus está literal en su campo y que lo que no viene del corpus es **exactamente** una de esas fórmulas con los datos del libro. Un cambio futuro no puede colar una frase nueva sin declararla.

| Qué | Regla |
|---|---|
| La idea | `idea_clave` → `cita_memorable` → arranque del cuerpo (frases enteras, hasta 36 palabras). Se salta lo que esté en inglés (el 2 % de las ideas redactadas) y, si hay alternativa, lo que hable de «la lección». |
| `cita_memorable` | Es una idea redactada por la app: se dice como idea, **nunca entre comillas ni atribuida**. Hay prueba automática. |
| El matiz | Primeras frases enteras de `autocorreccion` (hasta 38 palabras; 26 si la pieza ya es larga), **más cualquier frase de salvedad de seguridad** que quedara fuera («no sustituye a un profesional», «consulta con…»). En la muestra, 24 piezas `idea` la recuperan así. |
| La práctica | `aplicacion_practica` desde el principio (hasta 60 palabras) más sus salvedades. Si la primera frase pasa de 75 palabras, no hay pieza. |
| La pregunta | La más asequible de las que se entienden solas: se descartan las que dicen «según la lección», «en el capítulo 7», «el texto», y las de respuesta «todas las anteriores». |
| La explicación | Solo su tramo inicial, hasta la primera frase que hable de «las otras opciones» o de «la lección». |
| El esquema | El de `datos/diagramas.json`, sin tocar: título, cada pieza entera en su tarjeta y pie. La voz lee la pieza entera si el esquema es breve (hasta 36 palabras); si no, el título y su primer rótulo, o solo el título. La tarjeta se queda el tiempo que se tarda en leerla. |
| El libro | Se dice con su título corto (hasta los dos puntos o el paréntesis: «Steal Like an Artist»), que es un prefijo literal; el título completo va en el cierre y en el texto de publicación. |
| La atribución | Las frases del corpus conservan su «según X». La fórmula de crédito es neutra («Del libro X, de Y»): no afirma que el autor diga la frase tal cual. |

Lo que **no** hay: «lección N de M», «la anterior», «la siguiente», «en la app», enlaces. El cierre dice «Más ideas como esta, en Mente Fría.» y enseña la marca, el lema y el libro: nombre y dónde seguir, sin nada que caduque.

## El lenguaje visual

Se descarta el aspecto de página (cabecera con libro, índice de secciones, contador, tarjetas apiladas) y la barra de subtítulos.

- **Texto cinético en vez de subtítulos.** Lo que dice la voz entra en pantalla por ráfagas de 2-4 palabras, en páginas de 14 palabras como mucho; la ráfaga que suena va en el color del eje y las ya dichas quedan en blanco. Es a la vez el contenido y el subtítulo: nada se lee dos veces y la pieza funciona sin sonido. Un corte cada ~1,3 s.
- **Una sola cosa en pantalla.** Arriba, la marca (§ MENTE FRÍA) y el tipo de pieza; abajo, el libro y el autor; en el centro, una frase, una tarjeta o un número. Nada más.
- **Letra para móvil.** Texto cinético de 84-124 px, tarjetas de 50-78 px, crédito de 38 px; lo más pequeño que hay que leer mide 30 px o más (37 px los rótulos). Si un fotograma no cabe, primero cede la silueta y luego la letra, con un suelo del 68 %.
- **Zona segura.** En 9:16 el contenido vive entre los 236 px de arriba y los 474 de abajo: lo que queda fuera es lo que tapan las interfaces de TikTok, Reels y Shorts.
- **El matiz se ve distinto.** Rótulo y filete rojos y letra de texto en lugar de titular: se reconoce como la voz que discute, antes de leerlo.
- **Identidad por libro.** El acento es el del eje (`Mapa.ACENTOS`) y el motivo del fondo (cuatro variantes) se deriva del libro: dos libros del mismo eje no se confunden y las piezas de uno se reconocen entre sí.
- **Movimiento.** Cortes secos entre ráfagas, fundido breve (0,16 s) entre escenas y una barra de progreso continua arriba, que es lo único que se mueve entre corte y corte.
- **Miniatura propia.** No es un fotograma del vídeo: tipo de pieza, arranque literal del gancho (18-20 palabras como mucho), tema, libro y marca, para verse pequeña.
- **Tres aspectos.** 9:16 es el principal; 1:1 y 16:9 se derivan de la misma maquetación (en 16:9 la silueta y su tarjeta van lado a lado).

### El esquema, en corto

Lección aprendida en el formato `clase`: una figura completa a 1080 px de ancho tiene letra de ~16 px. Aquí la figura no se enseña dibujada entera: se **reconstruye con sus mismos datos** en el patrón que le corresponde (ver «El patrón visual sale de la forma de la idea»), con el texto en grande dentro de la forma, y se recorre pieza a pieza. Del formato `clase` se descartan la recuperación con cuenta atrás, la leyenda y la escalera. Las figuras que aún no tienen patrón no se enseñan: enteras serían ilegibles y recortarlas sería modificarlas.

## Coherencia de la serie

- **Sin ganchos repetidos.** `plan_libro` descarta la pieza que abra igual que otra del mismo libro y lo anota.
- **Sin contradicciones por construcción.** La idea y el matiz de una lección son siempre los mismos tramos literales en sus tres piezas.
- **Orden de publicación** (`manifiesto.json`): el libro primero; después dos ideas y una pieza de otro tipo de una lección ya presentada, alternando pregunta y práctica. Dos piezas de la misma lección no salen seguidas y ninguna sale antes que su idea.
- **Nada desaparece en silencio.** Cada pieza que no sale figura en el manifiesto con su motivo.

## Publicación

- **Texto por red.** `publicacion.txt` (y `publicacion.json`) lleva, además del título, la descripción y las etiquetas, la versión de cada red con su longitud: YouTube Shorts (título ≤ 100 con `#Shorts`), TikTok (≤ 150), Instagram Reels, LinkedIn, X (≤ 280) y WhatsApp. Es el mismo material recortado por palabras enteras; donde hay poco sitio, el libro va con su título corto. Sin enlaces.
- **Dónde seguir.** `--seguir "Sigue a @cuenta"` cambia el rótulo del cierre (no se lee en voz alta).
- **Filtros.** `--max-seg 60` deja fuera las piezas más largas y `--excluir "trading,inversión"` las que nombren esos temas; las dos cosas quedan anotadas en el manifiesto con su motivo.
- **Calendario entre libros.** `cli calendario` reparte las piezas ya generadas de todos los libros: un libro de cada eje por vuelta, una pieza por turno, nunca dos seguidas del mismo libro, y dentro de cada libro el orden de su manifiesto. Con `--desde` y `--por-dia` pone fechas.

## Métricas

**Biblioteca entera: 519 libros públicos, 3.719 lecciones.** Guiones planificados y pasados por el control de calidad uno a uno. Duraciones **estimadas** a 2,4 palabras/s. (El diseño se ajustó sobre una muestra de 80 libros; estas cifras son de todos.)

| | Piezas | Duración: mín · p25 · mediana · p75 · p95 · máx | Por encima de 60 s | Avisos por duración |
|---|---|---|---|---|
| `idea` | 3.719 (100 % de las lecciones) | 26 · 48 · **55** · 60 · 68 · 88 s | 882 (24 %) | 39 (> 75 s) |
| `pregunta` | 2.624 (71 %) | 24 · 39 · **46** · 51 · 60 · 76 s | 145 (6 %) | 14 (> 70 s) |
| `practica` | 3.476 (93 %) | 27 · 47 · **52** · 56 · 62 · 87 s | 220 (6 %) | 15 (> 75 s) |
| `caso` | 482 (13 %) | 32 · 47 · **51** · 55 · 64 · 78 s | 50 (10 %) | 1 (> 70 s) |
| `libro` | 506 de 519 (97 %) | 31 · 39 · **43** · 50 · 54 · 60 s | 0 | 0 |

- **10.807 piezas**, 20 por libro de mediana (de 7 a 53). **0 con error** en el control de calidad, 0 excepciones, 0 ganchos repetidos dentro de un libro.
- Sin material: 1.095 lecciones sin pregunta que se entienda sola (29 %); 243 sin pieza `practica`; 13 libros sin mapa. Todas las lecciones tienen pieza `idea`.
- De dónde sale el gancho de la idea: `idea_clave` 58 % · arranque del cuerpo 25 % · idea redactada 13 % · título del esquema 5 %. 
- Cuando una pieza pasa de 60 s se aprieta sola, sin cortar frases: el matiz se queda en su primera frase, el esquema se lee menos en voz alta (sigue entero en pantalla) o la práctica se acorta por frases enteras. Con eso las `practica` de más de 60 s bajan de 633 a 220 y las `idea` de 968 a 826 (878 tras dar esquema a las que no lo tenían); lo que queda son ideas, tarjetas o matices largos de por sí.
- Avisos más frecuentes (piezas): texto del corpus que alude a «la lección» o a un capítulo, 405 (3,9 %); algún momento del esquema con más de 32 palabras a la vista, 310 (3,0 %); alguna frase de más de 60 palabras, 164 (1,6 %).
- Cómputo: ~30 s por pieza y unos 22-26 fotogramas, en esta máquina y sin voz. La biblioteca entera serían unas 85 horas de máquina; `biblioteca --format compartir --limit N` va por tandas y retoma.
- **Maquetación, medida en navegador** con todos los patrones: 9.000 fotogramas (4.000 en 9:16, 2.500 en 1:1 y 2.500 en 16:9, con hasta 90 piezas de cada patrón y las 27 matrices): **0 desbordes**; la letra tuvo que reducirse en 405 (4,5 %), como mucho al 76 %, y lo más pequeño que queda mide 27-28 px.
- **Sincronía, medida sobre un vídeo real** con el motor de pitidos: las 5 ráfagas de la escena comprobada cambian en el instante en que suena su primera palabra.
- **Tanda de estrés** con 150 libros que no estaban en la muestra de ajuste: 24 piezas renderizadas (6 de cada tipo, las más largas incluidas), **24 de 24 correctas** y con la duración prevista; 3.000 de sus fotogramas medidos en navegador, **0 desbordes**, letra mínima de 30 px, reducida en 76 (2,5 %, hasta el 87 %).

## Qué se descartó

- **Un vídeo por libro con todo dentro.** Es el formato `clase` con otra piel.
- **«Mito contra matiz».** Presentar la idea como mito para luego corregirla convierte la tesis de un autor en un error: justo lo que no se puede transmitir. El matiz se presenta como límite, no como desmentido.
- **Una pieza solo de matiz** y **una pieza solo de esquema.** Redundantes con `idea`, que ya lleva las dos cosas; la serie se repetiría.
- **La silueta con tarjeta.** Fue la primera versión: correcta pero uniforme (un contraste y una secuencia se veían igual) y, peor, no enseñaba el centro de los mapas ni los polos o los ejes. Hoy ningún patrón la usa; queda en el código como reserva.
- **Abrir con el contraste del esquema en vez de con la idea.** La idea es mejor gancho que el título de una figura; el contraste llega enseguida, después del crédito.
- **Gancho-pregunta en la pieza principal** (ver arriba).
- **Subtítulos quemados palabra a palabra.** Con el texto ya en pantalla, duplicaban.
- **Figura completa en pantalla, fotos, música.** Ilegible la primera; con derechos dudosos las otras. No hay fondo sonoro.
- **Meter el caso dentro de la pieza `idea`.** La alargaba (ya una de cada cuatro pasa de 60 s). Como pieza propia abre con lo concreto, que además es mejor gancho.
- **Etiquetas inventadas.** Las de publicación salen de la marca, del eje (dos fijas por eje, declaradas en `ETIQUETAS_EJE`), del autor y del dominio de la lección.

## Límites y lo que no se ha comprobado

- **La voz real.** Este trabajo se hizo sin acceso a Edge TTS. Comprobado: guiones, control, maquetación (en navegador, sobre miles de fotogramas) y montaje con el motor mudo y con un motor de pitidos con marcas por palabra (`tests/pitidos.py`). **No comprobado:** cómo suena, el ritmo real (las duraciones pueden variar un 10-15 %), la pronunciación de títulos y autores en inglés, y si las fórmulas suenan naturales con cada voz.
- **Las plataformas.** La zona segura sigue las guías habituales, pero no se ha subido nada: ni recortes, ni compresión, ni cómo trata cada red la miniatura.
- **El 25 % de ideas que salen del cuerpo** son menos rotundas que una `idea_clave` (las que solo hablan del libro se detectan y abren con el esquema; el resto, no todas brillan). La solución de fondo es redactar la idea en la biblioteca, no en el vídeo.
- **Aplicaciones prácticas de dominio** (un 11 % habla de *trading* o inversión): son literales del corpus y salen tal cual. Si no convienen para difusión general, `--piezas idea,pregunta,libro`.
- **Piezas de más de 60 s** (una de cada cinco `idea`): no se cortan frases para bajar de ahí. El manifiesto da la duración para elegir.
- **Sincronía sin marcas por palabra** (Kokoro, Gemini): las ráfagas se reparten de forma proporcional dentro de cada escena; con Edge son exactas.
