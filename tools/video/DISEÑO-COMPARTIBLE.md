# Piezas compartibles: diseño

Por qué existe `--format compartir`, qué decide y qué deja fuera. Uso y opciones: [`README.md`](README.md).

## El problema

Los formatos `clase` y `corto` cuentan un libro como una **serie**: presentación, una lección por episodio, repaso; cabecera de aplicación, índice de secciones, «Lección 3 de 8», «Venimos de la lección anterior…». Eso es fiel a la web y por eso mismo no viaja: quien se cruza con un episodio suelto en un feed ve otra pata de una página que no conoce.

El formato nuevo parte de la pregunta contraria: **¿qué entiende alguien que ve esto solo, sin sonido, tres segundos, sin saber qué es Mente Fría?** Y mantiene intacta la regla que más ha costado: la voz y la pantalla solo dicen texto del corpus.

## Qué es una unidad compartible

**Una idea de una lección, con su explicación, su matiz y su crédito.** No un libro resumido: una afirmación, por qué se sostiene, de dónde sale y dónde se le discute. Dura lo que la explicación pida —lo normal, entre uno y dos minutos—, no lo que mande un tope (ver «La explicación»). Es la unidad natural del corpus (cada lección ya tiene `idea_clave`, esquema y `autocorreccion`) y es lo que distingue a la biblioteca de un canal de frases: aquí la idea viene con su límite.

De ahí sale un catálogo de seis piezas. Todas se montan solas con campos del corpus; cada una usa un campo que las otras no explotan y **abre de una manera distinta**, así que las piezas de una misma lección no se pisan.

| Pieza | Abre con (gancho) | Centro | Campos |
|---|---|---|---|
| **`idea`** — la principal | La idea misma, en frío | La explicación (primeros párrafos del cuerpo) y el esquema | `idea_clave` · cuerpo · `datos/diagramas.json` · `autocorreccion` |
| `fondo` — la lección entera | La idea misma | Todo el cuerpo, el esquema leído entero, el matiz completo y qué probar | los mismos · `aplicacion_practica` |
| `pregunta` | Una pregunta de la lección | 3 s de pausa, respuesta y porqué | `preguntas` · `autocorreccion` |
| `practica` | Qué probar | La idea que hay detrás | `aplicacion_practica` · la idea · `autocorreccion` |
| `caso` | El caso concreto que la lección cuenta | La idea que hay detrás | cuerpo («Un ejemplo:», «Imagina que…») · la idea · `autocorreccion` |
| `libro` | El libro en una frase | Sus ideas centrales | `datos/mapas.json` |

Lo que se repite en todas (y da la identidad): **gancho → contenido → «Del libro X, de Y» → «El matiz» → cierre que retoma el gancho**. El estribillo es deliberado: quien ve dos piezas reconoce la tercera.

## El arco: contar la idea, no enumerar frases

Una pieza no es texto sobre fondo. La `idea` tiene seis tiempos y cada uno hace un trabajo:

| Tiempo | Qué pasa | De dónde sale | Para qué |
|---|---|---|---|
| **Tensión** | La idea, en frío. Si la propia lección arranca con una pregunta breve, primero esa pregunta y la idea la resuelve | `idea_clave` · primera frase del cuerpo | Abrir un hueco en los dos primeros segundos |
| **Origen** | «Del libro X, de Y» | fórmula + títulos | Saber quién lo sostiene antes de seguir |
| **Explicación** | Los primeros párrafos del cuerpo, enteros y en su orden | cuerpo de la lección | El porqué: sin él la idea es un eslogan |
| **Desarrollo visible** | La estructura entera primero; después se recorre pieza a pieza con el patrón visual que le va | `datos/diagramas.json` | Que se vea *cómo* es la idea: qué se opone a qué, qué lleva a qué |
| **Giro** | «El matiz»: cambia el color, la letra y el tono | `autocorreccion` | Lo que la idea no dice: el límite |
| **Cierre** | «Quédate con esto»: el gancho otra vez, escrito **entero** (hasta 40 palabras), junto a la marca | el mismo tramo literal del principio | Un solo mensaje para llevarse; el arco se cierra donde se abrió. Entero porque cortarlo a media frase puede dejar fuera justo su salvedad |

En `pregunta` el arco es pregunta → espera → respuesta, y el cierre deja escritas **la pregunta y su respuesta, juntas** (la respuesta sola no dice de qué). En `practica`, qué hacer → por qué → límite. En `caso`, lo concreto antes que lo abstracto: el ejemplo → la idea que ilustra → límite, y lo que se lleva uno es la idea.

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
| `iceberg` | **Iceberg** | Lo que se ve arriba, una línea de flotación y, debajo, lo que lo sostiene; cada parte con su rótulo | Lo visible y lo que hay detrás | 13 (0,3 %) |
| Las demás (`formula`, `red`, `flujo`, `grafica`, `arbol`, `curva`…) y las que obligarían a dejar datos fuera (un embudo con cantidades, una balanza inclinada, un bucle con un paso que frena) | — | Sin esquema: idea y matiz | Aún sin patrón propio, o el patrón no enseñaría parte de lo que la figura dice | 43 (1,2 %) |

Todos los patrones se dibujan en HTML/CSS con los datos de la figura (no pasan por `lib/diagram.js`): así el texto va grande **dentro** de la forma, junto a aquello de lo que habla. Además enseñan lo que la silueta de la primera versión dejaba fuera: el **centro** de mapas y ciclos (y su apostilla, a veces un «lectura nuestra»), los **polos** del espectro y los **extremos y nombres de los ejes** de la matriz.

**Y dentro de la frase.** Cuando la idea tiene la forma «no X, sino Y» (un 5 % de las ideas), el texto cinético lo señala sin cambiar una palabra: lo afirmado, lo que sigue al «sino», se queda en color una vez dicho. **Lo negado no se marca.** La primera versión lo apagaba y lo tachaba, y la revisión independiente encontró que eso podía decir algo falso: en «no pierde fuerza por la edad, sino por el desuso» el «no» no niega que pierda fuerza, y saber qué niega exige analizar la frase. Si la frase es breve va entera en una página; «no solo… sino también» o «no simplemente… sino» no se tocan.

### Cuando la lección no da para un arco

No se fuerza. `pieza_idea` clasifica (`arco` en el manifiesto) y degrada con honestidad:

| Caso | Qué hace | En la biblioteca (3.719 lecciones) |
|---|---|---|
| Idea que se sostiene sola + figura recorrible + matiz | **Arco completo** | 3.493 (93,9 %) |
| Sin figura recorrible | Idea → origen → matiz → cierre (`sin_esquema`) | 43 (1,2 %) |
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

Medido de forma automática en las 3.719 piezas `idea` de la biblioteca: criterio 1, 95 % (el 5 % restante abre con el esquema); criterio 3, 98,8 %; criterios 4 y 5, 100 % por construcción y por control (`lint_pieza`); **los cinco, 93,9 %** (arco completo). El criterio 2 no se puede medir con reglas fiables: se evaluó leyendo.

Lectura crítica de 14 guiones `idea` elegidos al azar, antes de introducir la detección de arranques huecos: 8 salían de `idea_clave` y los 8 funcionaban solos (afirmación clara, giro nítido en el matiz); de los 6 que salían del cuerpo, 3 funcionaban («Las emociones no son perturbaciones irracionales…») y **3 no decían nada** («Una de las contribuciones más prácticas del libro es…», «Newport articula su argumento central en dos dimensiones…», «Robbins dedica una sección significativa…»). Esos tres son el motivo de `ARRANQUE_META` y del arco `esquema_primero`; los tres quedan ahora detectados. Qué se recuerda tras leerlos: en 11 de 14, una frase y su «pero»; en los otros, el tema. Es una lectura de una sola persona sobre guiones, no una prueba con espectadores.

### Por qué la idea abre en frío

Se probó abrir con la pregunta de la lección (como hace `clase`). Dos problemas: la idea no siempre contesta esa pregunta —y una pregunta que el vídeo no responde es un cebo—, y la misma pregunta abriría también la pieza `pregunta`. Una afirmación fuerte ya es un gancho («Las malas decisiones suelen deberse a cuatro villanos…»), y encima deja el tema de la lección a la vista como rótulo. La pregunta se queda para su propia pieza, donde sí se responde.

### Por qué la pregunta no enseña las opciones

Las opciones de la biblioteca suman 65 palabras de mediana: no caben en una pieza corta. Y hay una razón más seria: tres de cada cuatro son **falsas**, y una captura de pantalla con una opción falsa bien rotulada es exactamente un concepto erróneo en circulación. La pieza enseña la pregunta, deja pensar y da solo la respuesta correcta (literal) y el arranque de su explicación.

## La explicación: profundidad antes que brevedad

La primera versión del formato se quedaba en 30-60 s: idea, esquema y matiz. Vista con voz, **afirmaba sin explicar**: no usaba nada del cuerpo de la lección, que es donde está el porqué. La prioridad del proyecto es no transmitir conceptos erróneos, y una idea sin su argumento se malinterpreta con facilidad. Por eso ahora manda la explicación y no el minuto.

**Qué se dice.** El cuerpo de la lección, **desde su principio y por párrafos enteros**: el primero siempre y los siguientes mientras quepan en 150 palabras (`EXPLICA_PALABRAS`). En la pieza `fondo`, el cuerpo entero.

**Por qué párrafos enteros y no «las mejores frases».** Elegir frases sería más ágil y es justo lo que no se puede hacer bien sin entender el texto:

- Una frase sacada de en medio pierde lo que la sostiene («Por eso…», «Ese proceso…») o, peor, la salvedad que la sigue («Un estudio mostró… La interpretación se ha discutido»).
- El corpus marca de quién es cada cosa al empezar el párrafo («Fuera del libro:», «Lectura nuestra:», «Nota de la biblioteca:», «Un ejemplo nuestro:»). Leyendo el párrafo desde su inicio, la marca va siempre con lo que marca.
- Un arranque del cuerpo siempre se entiende: es como el autor de la lección decidió empezar.

**Dónde va.** Después del crédito y **antes del esquema**: el esquema deja de ser el desarrollo y pasa a ser el resumen a la vista de lo que se acaba de explicar. En pantalla es texto cinético como el resto, un párrafo por escena.

**Qué se controla** (`lint_pieza`): que la explicación siga el cuerpo párrafo a párrafo, sin saltos ni recortes; lo único que puede entrar suelto es una salvedad de seguridad de un párrafo que no cupo. Se detiene antes de un párrafo que solo se entiende dentro de la serie («como vimos», «la lección anterior») o que está en otro idioma. «La lección es que…» o «en el capítulo 3» no cortan: se entienden fuera (queda como aviso).

**Lo que cuesta.** La pieza `idea` pasa de ~55 s a ~1 min 35 s de mediana. Es más de lo que piden TikTok o Reels para retener, y a cambio dice algo. Para quien quiera la pieza de un minuto, `--breve` da la versión anterior (sin explicación, matiz en su primera frase), y `--max-seg` sigue filtrando por duración. Sin `--breve`, también el matiz va entero (hasta 70 palabras) y la pieza `pregunta` da más porqué de su respuesta (hasta 60 palabras).

**La pieza `fondo`** es la lección contada entera y suelta: idea → libro → todo el cuerpo → el esquema leído entero → el matiz completo → qué probar. De 3 a 4 minutos; va a YouTube como vídeo normal (no como Short) y a LinkedIn. No sale si el cuerpo no llega a 60 palabras. Abre igual que la pieza `idea` a propósito: es su versión larga.

## Menos texto solo: el esquema acompaña a la explicación

Segunda escucha del dueño del proyecto: la duración encaja y lo que se dice es coherente, pero el vídeo **depende demasiado del texto**, tiene pocos esquemas y transiciones, y **repite** (el matiz se oía dos veces). Tres cambios:

- **El esquema, junto a la explicación** (`acompanar`). Mientras la voz explica, los rótulos del esquema de la lección están a la vista encima del texto (al lado, en horizontal), apagados, y **cada uno se enciende cuando la voz lo nombra**. No se añade ni se cambia texto: los rótulos son los de `datos/diagramas.json` y lo único que se decide es cuándo se ilumina cada uno. «Nombrar» es literal y prudente (`donde_nombra`): las palabras con contenido del rótulo, en su orden y casi seguidas; no se interpreta. Solo acompaña si el esquema tiene de 2 a 7 piezas y sus rótulos suman 26 palabras o menos. En la biblioteca: 3.457 de las 3.719 piezas `idea` llevan el esquema al lado; en 2.152 se enciende al menos una pieza y en 638 todas.

  **Hasta dónde llega «nombrar».** La primera regla pedía las palabras del rótulo en su orden y casi seguidas (2.012 piezas con alguna encendida). Se amplió a otra forma de la misma palabra y otro orden («Control sobrestimado» en «sobrestimaban su control»), con tres frenos: el rótulo ha de tener dos o más palabras con contenido, no puede faltar ninguna y el tramo no cruza un punto, dos puntos, paréntesis ni raya. Revisadas a mano 100 coincidencias nuevas al azar: 1 dudosa. Dos variantes se probaron y se descartaron por lo que salió al revisarlas: aplicarla a rótulos de una palabra (6 errores en 100: «El plan» encendía «plano») y permitir que falte una palabra (encendía «X causa Y» con «Y causa X»). El objetivo era pasar de 2.800 y **no se alcanza**: en las 1.300 piezas restantes el cuerpo dice lo mismo con otras palabras («Basta la mayoría simple» / «cuando la mayoría simple es suficiente»), y casar eso ya es interpretar.
- **Sin repeticiones.** Si la explicación ya nombró todas las piezas con el esquema delante, después no se recorren una a una: queda la estructura entera como recapitulación (597 piezas). Y si el pie del esquema dice lo mismo que el matiz que viene a continuación (tres de cada cuatro palabras con contenido), el pie no se lee: se queda el matiz, que es obligatorio y va entero. La pieza `fondo` sí recorre siempre el esquema completo.
- **Movimiento.** Cada cambio lleva la transición que le corresponde, y ninguna toca el contenido:

  | Qué pasa | Transición | Por qué |
  |---|---|---|
  | Cambia la sección (idea → libro → explicación → esquema → matiz → cierre) | Empuje lateral, 0,36 s | Se nota que empieza otra cosa |
  | Se **añade** una pieza al esquema | Se dibuja de arriba abajo, 0,42 s | Aparece en un hueco vacío: nada se mezcla |
  | Entra una ráfaga de texto en la misma página | Barrido de izquierda a derecha, 0,13 s | Igual: se añade |
  | Se abre otra pieza de un esquema en lista | **Movimiento real**, 0,45 s: cada panel va de donde estaba a donde va, y el que se abre crece hacia abajo | Se ve qué pieza es cuál mientras cambia |
  | Se **sustituye** otra cosa (otra página de texto, una matriz, un espectro) | Fundido, 0,18-0,26 s | Un barrido mezclaría dos textos a medias |

  El esquema **se construye**: primero el título y después cada pieza entra en su sitio, una cada 0,55 s. Las que aún no han entrado guardan su hueco, así que nada salta. Vale para todos los patrones propios (contraste, cadena, ciclo, radial, iceberg, matriz, espectro y cifra). En la cadena, cada eslabón trae su tramo de hilo; en el ciclo, lo último que se dibuja es la flecha que vuelve al principio.

  El movimiento real sí necesita capturas: ocho fotogramas intermedios por cambio de pieza (`pieza_movimientos`). Cada uno es el estado de llegada con el de partida maquetado invisible al lado; el navegador mide dónde estaba cada panel y lo coloca a medio camino. El texto es siempre el del estado de llegada.

  Está hecho en el montaje (`_reveal_frames` en `renderer.py`): se compara el fotograma anterior con el nuevo y solo la zona que cambia se descubre con un borde suave. No hacen falta más capturas de navegador.
- **El esquema acompañante toma la forma de su figura.** Ya no es siempre una lista: un contraste son dos lados enfrentados con su marca en medio; una cadena, eslabones unidos; un ciclo, la cadena con su flecha de vuelta; un mapa, el centro y lo que cuelga de él; una matriz, su cuadrícula de 2 × 2; un espectro, sus dos polos sobre la recta.
- **Iconos, pero de formato.** Cada sección lleva un icono de los 18 de la biblioteca (`lib/mapa.js`): bombilla para la idea, lupa para la explicación, escudo para el matiz, diana para la práctica, libro para el crédito, reloj para la pausa; y uno por forma de figura (balanza para el contraste, camino para la cadena, ciclo, red, brújula, gráfico). Están declarados en `ICONOS` y **dicen qué tipo de momento es, nunca qué significa el contenido**: la biblioteca solo asigna iconos a los nodos de los mapas de libro, no a las lecciones ni a las piezas de sus esquemas, y ponerle un icono a un concepto sería interpretarlo.

- **Más fondo en la pieza `idea`.** Tercera escucha: aún le faltaba desarrollar la idea. Ahora, además de los primeros párrafos del cuerpo, añade **el párrafo que cuenta un caso** si la lección lo trae y empieza presentándose como tal («Por ejemplo», «Un ejemplo:», «Imagina», «En un experimento»): entero, aunque se salten los párrafos de en medio, porque un párrafo que se presenta así se entiende solo (412 piezas). Y cierra con **la práctica** (sus primeras frases, hasta 40 palabras, más sus salvedades): la pieza no acaba en la teoría (3.646 piezas). Mediana, 1 min 47 s.
- **Formas propias.** La pirámide se ensancha de la cima a la base y el embudo se estrecha, como en la figura de la app; la línea de tiempo es una raya con un punto por fecha. Antes las tres eran la misma cadena.
- **Las cifras del texto se ven como dato.** Un número que el texto da («el 37 %», «1960») sale con más peso y en el color de la sección. Es literal: solo cambia cómo se ve.
- **Iconos por concepto, con aprobación.** Qué icono va con qué pieza es una interpretación, así que no la decide el generador: se propone en `tools/video/iconos/<libro>.json` con `"aprobado": false` y **no sale en ningún vídeo** hasta que alguien lo revisa y lo pone a `true`. `--iconos-propuestos` los enseña para poder revisarlos. Hay propuesta para un libro piloto (*Decisive*, 25 piezas), sin aprobar.

Lo que esto **no** arregla: no hay imágenes ni ilustraciones (el corpus no las tiene y no se usan fotos de derechos dudosos); el movimiento real es solo para esquemas en lista (contraste, cadena, ciclo, mapa, iceberg); y cuando el cuerpo no nombra las piezas con sus mismas palabras (1.305 piezas), el esquema acompaña pero no se enciende.

## El guion: qué se elige y qué no se toca

Nada se redacta. El guion **selecciona y recorta por frases enteras**; lo demás son las once fórmulas de `FORMULAS` (`compartir.py`) y los rótulos de `ROTULOS`. El control (`lint_pieza`) comprueba tramo a tramo que lo que dice venir del corpus está literal en su campo y que lo que no viene del corpus es **exactamente** una de esas fórmulas con los datos del libro. Un cambio futuro no puede colar una frase nueva sin declararla.

| Qué | Regla |
|---|---|
| La idea | `idea_clave` → `cita_memorable` → arranque del cuerpo (frases enteras, hasta 36 palabras). Se salta lo que esté en inglés (el 2 % de las ideas redactadas) y, si hay alternativa, lo que hable de «la lección». |
| `cita_memorable` | Es una idea redactada por la app: se dice como idea, **nunca entre comillas ni atribuida**. Hay prueba automática. |
| La explicación del cuerpo | El cuerpo desde su principio, por párrafos enteros (hasta 150 palabras; entero en `fondo`). Ver «La explicación». |
| El matiz | Primeras frases enteras de `autocorreccion` (hasta 70 palabras, es decir, entero casi siempre; completo en `fondo`; con `--breve`, 38 o 26), **más cualquier frase de salvedad de seguridad** que quedara fuera («no sustituye a un profesional», «consulta con…»). En la muestra, 24 piezas `idea` la recuperan así. |
| La práctica | `aplicacion_practica` desde el principio (hasta 60 palabras) más sus salvedades. Si la primera frase pasa de 75 palabras, no hay pieza. |
| La pregunta | La más asequible de las que se entienden solas: se descartan las que dicen «según la lección», «en el capítulo 7», «el texto», las de respuesta «todas las anteriores» y, sobre todo, **las que preguntan en negativo o dependen de la lista** («¿cuál es FALSA?», «todas EXCEPTO…», «¿cuál de las siguientes…?»): su respuesta correcta es una afirmación falsa o no significa nada sin las opciones delante. |
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

**Biblioteca entera: 519 libros públicos, 3.719 lecciones.** Guiones planificados y pasados por el control de calidad uno a uno. Duraciones **estimadas** con el modelo ajustado a la voz real (`segundos_locucion`, escalado a la voz elegida).

| | Piezas | Duración: mín · p25 · mediana · p75 · p95 · máx | Por encima de 2 min |
|---|---|---|---|
| `idea` | 3.719 (100 % de las lecciones) | 40 · 84 · **94** · 104 · 123 · 176 s | 237 (6 %) |
| `fondo` | 3.698 (99 %) | 90 · 162 · **177** · 194 · 236 · 355 s | casi todas (1.651 pasan de 3 min) |
| `pregunta` | 2.620 (70 %) | 28 · 44 · **50** · 56 · 67 · 81 s | 0 |
| `practica` | 3.476 (93 %) | 30 · 49 · **54** · 59 · 66 · 90 s | 0 |
| `caso` | 482 (13 %) | 31 · 48 · **51** · 54 · 58 · 76 s | 0 |
| `libro` | 506 de 519 (97 %) | 32 · 39 · **41** · 48 · 52 · 59 s | 0 |

- **14.501 piezas**, 26 por libro de mediana (de 10 a 77). **2 con error** en el control de calidad (las piezas `idea` y `fondo` de una misma lección, cuyo arranque acaba en una cita entre comillas simples y el control no reconoce dónde termina la frase: se quedan sin renderizar, que es lo previsto), 0 excepciones, 0 ganchos repetidos dentro de un libro.
- Sin material: 1.099 lecciones sin pregunta que se entienda sola; 243 sin pieza `practica`; 21 sin pieza `fondo` (cuerpo demasiado breve); 13 libros sin mapa. Todas las lecciones tienen pieza `idea`.
- Con `--breve` (las piezas de antes): `idea` 26 · 49 · **55** · 60 · 68 · 88 s, y el resto unos 8-10 s más cortas que en la tabla.
- De dónde sale el gancho de la idea: `idea_clave` 58 % · arranque del cuerpo 25 % · idea redactada 13 % · título del esquema 5 %. 
- Con `--breve`, cuando una pieza pasa de 60 s se aprieta sola, sin cortar frases: el matiz se queda en su primera frase, el esquema se lee menos en voz alta (sigue entero en pantalla) o la práctica se acorta por frases enteras.
- Avisos más frecuentes (piezas): texto del corpus que alude a «la lección» o a un capítulo, 1.441 (10 %; son sobre todo párrafos del cuerpo que dicen «la lección es que…» o «esta lección propone…»); alguna frase de más de 60 palabras, 629; algún momento del esquema con más de 32 palabras a la vista, 541.
- Cómputo: ~30 s por pieza y unos 22-26 fotogramas, en esta máquina y sin voz. La biblioteca entera serían unas 85 horas de máquina; `biblioteca --format compartir --limit N` va por tandas y retoma.
- **Maquetación, medida en navegador** con todos los patrones, el código final y la comprobación endurecida (detecta lo que se sale por cualquier lado): 7.500 fotogramas de figuras y texto en los tres aspectos, las 27 matrices enteras (2.100 fotogramas) y 3.600 cierres y miniaturas: **0 desbordes**. La letra se reduce en un 2-4 % de los fotogramas (y en la mitad de los cierres en vertical, que ahora llevan la idea entera); lo más pequeño que queda mide 30 px en vertical y 25-28 px en 1:1 y 16:9.
- **Sincronía, medida sobre un vídeo real** con el motor de pitidos: las 5 ráfagas de la escena comprobada cambian en el instante en que suena su primera palabra.
- **Tanda de estrés** con 150 libros que no estaban en la muestra de ajuste: 24 piezas renderizadas (6 de cada tipo, las más largas incluidas), **24 de 24 correctas** y con la duración prevista; 3.000 de sus fotogramas medidos en navegador, **0 desbordes**, letra mínima de 30 px, reducida en 76 (2,5 %, hasta el 87 %).

## Con voz real

Con el entorno abierto a `speech.platform.bing.com` y el motor Edge pasando por el proxy (`tts/edge_tts_engine.py`), se renderizaron piezas con la voz gratuita por defecto (`es-ES-AlvaroNeural`, −8 %). Lo que se pudo **medir** y cambió el formato:

- **Aire muerto.** Edge deja ~0,95 s de silencio tras la última palabra de cada locución, que se sumaba a la pausa del guion: en una pieza de 12-15 escenas, 10-15 s de silencio. Ahora el montaje lo recorta a 0,12 s (`RenderStyle.trim_tail_s`, solo en este formato) y la pausa la manda el guion. Las piezas quedan un 10 % más cortas.
- **Tarjetas mudas.** Con esquemas largos la voz leía solo el título de cada pieza y dejaba la tarjeta 2-5 s en silencio para leerla. Ahora lee la tarjeta entera hasta 60 palabras de esquema y la pausa de lectura tiene un tope de 1,4 s. Ningún silencio pasa de 2 s salvo la pausa de 3 s para pensar en la pieza `pregunta`, que es deliberada.
- **Duración estimada.** Contar palabras a 2,4 por segundo se quedaba hasta un 40 % corto en piezas de frases breves. `segundos_locucion` se ajustó sobre 43 locuciones reales (letras, finales de frase y comas: 6,5 % de error medio) y ahora la estimación queda a −7…+4 % de la duración real en las piezas renderizadas.
- **Sincronía.** Las marcas por palabra de Edge cuadran con el texto en 42 de 43 locuciones (la otra une «5 ideas» en una marca y se interpola). En el vídeo, las 5 ráfagas comprobadas cambian en el instante en que suena su primera palabra.
- **Volumen.** −16,2 LUFS integrados, rango 5,5 LU: lo que piden las plataformas.

Lo que **no** se puede medir y queda para oír (`ejemplos-compartir/con-voz/`): si el ritmo se siente bien, la naturalidad de las fórmulas y la pronunciación de títulos y autores en inglés con una voz `es-ES`.

**Primera escucha del dueño del proyecto:** vale como prototipo, pero la voz suena algo robótica y el vídeo no profundiza. De lo segundo sale «La explicación». De lo primero:

- El ritmo (−8 %) y el tono (−2 Hz) rebajados que venían del formato `clase` aplanan la voz. Ahora son configurables (`--ritmo`, `--tono`, o `EDGE_RATE` y `EDGE_PITCH`) y entran en la caché y en la huella de cada pieza. El valor por defecto no se ha cambiado todavía: falta elegir de oído.
- Se generó la misma locución con once voces gratuitas de Edge para comparar: las tres `es-ES` a ritmo natural, cinco multilingües (Brian, Ava, Emma, Remy, Vivienne) y dos `es-MX`. `en-US-AndrewMultilingualNeural` no devolvió audio en dos intentos y se quitó de la lista de muestras.
- **Voz elegida:** la muestra 9, `fr-FR-RemyMultilingualNeural`, a su ritmo y tono naturales («suena más humana que el resto»). Es la voz por defecto de `--format compartir` (`VOZ_EDGE` en `compartir.py`); los formatos `clase` y `corto` no cambian. Las duraciones estimadas se escalan con `FACTOR_VOZ` (0,87): en las dos piezas renderizadas la estimación queda un 5 % corta (71 s frente a 75 s; 187 s frente a 197 s).
- La pieza `06` de `con-voz/` está hecha con esa voz.

## Lote de diez libros con voz real

Un lote completo, en 9:16 y con la voz por defecto, en un contenedor en la nube con tres libros a la vez.

| Libro | Piezas | Vídeo |
|---|---|---|
| Decisive | 28 | 44,2 min |
| Four Thousand Weeks | 23 | 33,9 min |
| Hábitos Atómicos | 29 | 54,4 min |
| El hombre en busca de sentido | 32 | 52,9 min |
| The War of Art | 40 | 64,1 min |
| Dopamine Nation | 22 | 46,1 min |
| Range | 34 | 65,3 min |
| Verbal Judo | 22 | 47,6 min |
| Attached | 21 | 34,1 min |
| Games People Play | 29 | 45,1 min |
| **Total** | **280** | **487,7 min (unas 8 h)** |

- **Tiempo.** Primera pasada: unas 6 h 10 min de reloj. Segunda pasada (recuperar fallos y rehacer cuatro libros con el código más reciente): 1 h 25 min más.
- **Fallos.** En la primera pasada, 4 piezas de 279, todas porque el servicio de voz no devolvió audio («NoAudioReceived»); ninguna por el generador ni por el lint. Tres ocurrieron con 4 reintentos; con 6 reintentos y esperas más largas falló una. La segunda pasada las recuperó todas: 280 de 280.
- **Versiones.** El código cambió durante el lote. Decisive, Four Thousand Weeks y Hábitos Atómicos se rehicieron enteros al final; los otros siete salieron con la versión vigente cuando arrancó cada uno, así que algunos no llevan el movimiento real entre piezas del esquema. Relanzar la orden los pone al día.
- **No revisado.** Nadie ha visto las 280 piezas. Se revisó una («Decisive», idea 2) en una hoja de fotogramas.

## Revisión independiente

Antes de dar el trabajo por terminado se pidió a otro agente, sin contexto previo, que buscara fallos reales en el código. Encontró nueve y los nueve están corregidos, cada uno con su prueba:

| Hallazgo | Qué se hizo |
|---|---|
| **Grave.** Una pregunta en negativo («¿cuál es FALSA?») dejaba la afirmación falsa escrita en el cierre como «Quédate con esto» | Esas preguntas ya no se eligen (y el control las rechaza); el cierre de una pregunta lleva siempre la pregunta junto a su respuesta |
| El cierre, la miniatura y los textos cortos cortaban la idea a media frase y podían perder su salvedad | Van enteros (40 y 30 palabras); si aun así hay que cortar, el control avisa |
| El control no miraba lo que solo se ve (tarjetas, marco de la figura, tema, crédito, miniatura, textos de publicación) | Ahora todo eso tiene que ser literal o un rótulo declarado; los prefijos de publicación están en `PREFIJOS_PUB` |
| «toda intuición falla» pasaba por literal de «No toda intuición falla» | Un recorte solo vale si empieza donde empieza una frase de la fuente |
| El control no comprobaba que la respuesta fuera la correcta de esa pregunta | Lo comprueba |
| El manifiesto daba por publicable una pieza en error si quedaba un vídeo antiguo | Ya no; y `biblioteca` solo salta un libro si su manifiesto cubre los tipos pedidos |
| Algunos patrones dejaban datos fuera (el detalle de un evento, las cantidades de un embudo, hacia dónde cae una balanza) | El detalle se enseña; las figuras que no se pueden enseñar enteras van sin esquema |
| `--excluir` solo miraba la locución | Mira también lo que se ve y los textos de publicación |
| El «no… sino» apagaba texto que no estaba negado; figuras con datos de forma rara reventaban el libro; `calendario` fallaba con manifiestos raros | Ver arriba (solo se señala lo afirmado); los datos raros dejan la pieza sin esquema; el calendario los salta |

De paso, al endurecer la comprobación de maquetación (ahora detecta también lo que se sale por arriba) apareció un fallo latente: en miniaturas y cierres la medida de «si cabe» quedaba anulada por el centrado. Corregido, y la matriz se rehízo como tabla horizontal. Quedan anotadas dos sospechas sin confirmar que no son de este formato: `text.clean` borra lo que hay entre «<» y «>» (afecta a 1 lección de 3.719) y la huella no cubre cambios de plantilla si no se sube `COMPARTIR_VERSION`.

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

- **La voz.** Elegida de oído por el dueño (ver «Con voz real»), sobre una muestra de 35 s. Es una voz multilingüe de base francesa: no está comprobado cómo suena en piezas de tres minutos ni con nombres propios difíciles.
- **Sigue siendo, sobre todo, texto.** El esquema acompaña, se construye y hay transiciones, pero no hay imágenes ni iconos por concepto. La animación es un descubrimiento progresivo, no movimiento real de los elementos. Y nada de esto se ha visto en una plataforma ni con espectadores.
- **La explicación no elige: empieza por el principio.** Lee los primeros párrafos del cuerpo, que no siempre son los que mejor explican la idea (a veces el argumento fuerte está en el tercero y la pieza `idea` no llega; la pieza `fondo` sí). Es el precio de no seleccionar frases sin entenderlas. Tampoco se ha medido con personas si se sigue bien un párrafo de 100 palabras en texto cinético.
- **Las plataformas.** La zona segura sigue las guías habituales, pero no se ha subido nada: ni recortes, ni compresión, ni cómo trata cada red la miniatura.
- **El 25 % de ideas que salen del cuerpo** son menos rotundas que una `idea_clave` (las que solo hablan del libro se detectan y abren con el esquema; el resto, no todas brillan). La solución de fondo es redactar la idea en la biblioteca, no en el vídeo.
- **Aplicaciones prácticas de dominio** (un 11 % habla de *trading* o inversión): son literales del corpus y salen tal cual. Si no convienen para difusión general, `--piezas idea,pregunta,libro`.
- **Duración frente a alcance.** La pieza `idea` dura ahora cerca de dos minutos y la `fondo` más de tres: caben en YouTube (Shorts admite hasta 3 min), LinkedIn y X, y en TikTok y Reels como vídeo largo, pero retendrán menos que una de 40 s. Es una decisión, no un descuido; `--breve` y `--max-seg` dan la versión corta.
- **Sincronía sin marcas por palabra** (Kokoro, Gemini): las ráfagas se reparten de forma proporcional dentro de cada escena; con Edge son exactas.
