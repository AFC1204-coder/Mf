# Vídeos didácticos (9:16) — Mente Fría

Convierte el corpus de la biblioteca en vídeo vertical (`1080×1920`) de forma automática: una lección, la **serie completa de un libro** (presentación + una lección por episodio + repaso) o la biblioteca entera, libro a libro.

Cuatro reglas lo gobiernan:

1. **La voz solo dice texto del corpus.** No hay modelo que redacte. El guion recorta la lección por frases enteras (idea, cuerpo, matiz, aplicación, pregunta) y la une con unas pocas fórmulas fijas («Lección 3 de 8», «Venimos de…»). Un control de calidad lo comprueba antes de renderizar: si un tramo no está literal en la biblioteca, el episodio no sale.
2. **Lo que se ve es contenido, no decoración.** El esquema es el de la lección, dibujado con el mismo motor de la app (`lib/diagram.js`); el mapa del libro sale de `datos/mapas.json`; la pregunta es una de las de la lección.
3. **El texto largo se oye, no se lee.** En pantalla solo queda una *frase ancla* (un trozo literal de 16-20 palabras como mucho), el esquema, el mapa o la pregunta. El control de calidad avisa si una escena pasa de 32 palabras a la vista y `guion.md` dice cuántas lleva el episodio.
4. **El libro es una serie.** Todas las lecciones siguen la misma secuencia, visible en pantalla como índice, y comparten un hilo: la idea de cada lección en una frase abre su episodio, lo cierra, enlaza con el siguiente y vuelve en el repaso final, siempre con las mismas palabras. Además, cada episodio **abre con una pregunta** de la propia lección, la contesta al final y **termina con la pregunta que abrirá el siguiente**.

---

## Qué genera

### Una lección (`--format clase`, 3-5 min)

| Paso | En pantalla | Voz | Para qué |
|---|---|---|---|
| **Gancho** *(si la lección tiene pregunta)* | La pregunta, grande, sin opciones | «Antes de empezar, una pregunta» + la pregunta | Abrir un hueco: intentar contestar antes de aprender fija más lo que viene |
| Portada | Libro, autor, «Lección 3 de 8», puntos del recorrido | Título y lugar en el libro | Situar |
| Puente *(desde la 2.ª)* | La lección anterior y su idea | «Venimos de…» + esa idea | Activar lo ya visto |
| **Idea** | La frase ancla de la idea, grande | La idea entera | Dar el destino antes del camino |
| **La lección en una imagen** *(si hay esquema)* | El esquema de la lección: silueta con piezas numeradas y la lista de sus títulos; cada pieza se ilumina al nombrarla | «La lección en una imagen: …» y los títulos de las piezas | **Organizador previo:** ver la estructura antes de los detalles |
| **Desarrollo** | El **mini-esquema** (la silueta, sin texto) y debajo, o la frase ancla, o —cuando la voz nombra una pieza— su **tarjeta grande** (título y descripción); la pieza activa se ilumina en la silueta | El cuerpo de la lección, entero | Ver **dónde estamos** en la estructura; menos texto, más forma |
| **Esquema** | **Recuperación:** el esquema se tapa, 5 s para recordar sus piezas con cuenta atrás, y se revela pieza a pieza con su tarjeta; al final, completo con su pie | «Antes de seguir, intenta recordar las piezas…», los rótulos de cada pieza y el pie | Practicar la recuperación sobre la propia estructura |
| **Matiz** | Dónde se le discute a la idea | La autocorrección | No aprender la idea sin su límite |
| **Práctica** | Qué hacer con ella | La aplicación práctica | Transferir |
| **Repaso** | La pregunta del principio, ahora con opciones (cada una se ilumina mientras se lee) → 5 s en silencio con cuenta atrás → respuesta | «Volvemos a la pregunta del principio», las opciones, la respuesta y su explicación | Recuperar (lo que más fija) y cerrar el gancho |
| Cierre | La idea otra vez + la siguiente lección | «Quédate con esto…», el título siguiente y **su pregunta** | Cerrar el círculo y dejar abierto el siguiente |

**El esquema es la columna vertebral.** Es el verificado de la lección (`datos/diagramas.json`), dibujado con el motor de la app (`lib/diagram.js`). Se guía en las plantillas con cajas (`pasos`, `comparar`, `mapa`, `ciclo`, `piramide`, `matriz`: el 97 % de las figuras, con entre 2 y 6 piezas); `espectro`, `cifras`, `tiempo` y las demás se enseñan enteras con su título y su pie, como antes. En el móvil el esquema completo queda con letra ilegible; por eso lo que se ve es la **silueta** (sin texto, con insignias numeradas) y el texto de cada pieza va aparte, en grande.

**Cuándo se ilumina una pieza** (`guia.py`): el bloque narrado se compara con los términos distintivos de cada pieza (los que no comparten con las demás); si una pieza aparece con suficiente peso y al menos dos términos suyos, se ilumina en la palabra donde empieza a hablarse de ella, y un bloque que enumera varias las ilumina una tras otra. **Ante la duda no se ilumina nada**: una pieza mal iluminada engaña y una sin iluminar solo informa menos. Hoy se ilumina alguna pieza en la mitad de los bloques de desarrollo; el resto lleva la silueta sin pieza activa y la frase ancla.

El índice (Idea · Desarrollo · Esquema · Matiz · Práctica · Repaso) está siempre arriba con la sección en curso resaltada. Si una lección no tiene esquema o pregunta ligada, esa entrada no aparece.

`--format corto` (60-100 s, para redes): abre con la pregunta, da la idea, las frases que abren hasta tres bloques (con el mini-esquema), el esquema con sus títulos y su pie, la primera frase del matiz y de la práctica, **la respuesta a la pregunta** y la siguiente lección.

### Piezas compartibles (`--format compartir`, de 1 a 4 min)

Los dos formatos de arriba son una serie: tienen sentido si ya estás en la biblioteca. Este es lo contrario: **piezas sueltas que se entienden sin haber visto nada más**, pensadas para Shorts, TikTok, Reels, LinkedIn, X o WhatsApp. Sin «lección 3 de 8», sin índice y sin «venimos de…». El porqué de cada decisión está en [`DISEÑO-COMPARTIBLE.md`](DISEÑO-COMPARTIBLE.md).

| Pieza | Qué cuenta | De qué campos sale | Cuántas |
|---|---|---|---|
| **`idea`** *(la principal, 1-2 min)* | La idea, en frío → de qué libro sale → **la explicación** (los primeros párrafos del cuerpo, enteros) → su esquema, pieza a pieza → el matiz → marca | `idea_clave` (o la idea redactada, o el arranque del cuerpo), el cuerpo, `datos/diagramas.json`, `autocorreccion` | Una por lección |
| **`fondo`** *(a fondo, 3-4 min)* | La lección entera, suelta: la idea → libro → **todo el cuerpo**, párrafo a párrafo → el esquema leído entero → el matiz completo → qué probar → marca | los mismos, más `aplicacion_practica` | Una por lección con cuerpo (el 99 %) |
| `pregunta` | Una pregunta → 3 s para pensar → la respuesta y su porqué → libro → el matiz → marca | `preguntas` (la opción correcta y el arranque de la explicación; **las opciones falsas no salen**) | Una por lección que tenga una pregunta que se entienda sola (el 71 %) |
| `practica` | Qué probar → la idea que hay detrás → libro → el matiz → marca | `aplicacion_practica`, la idea, `autocorreccion` | Una por lección |
| `caso` | El caso concreto que cuenta la lección → la idea que hay detrás → libro → el matiz → marca | el cuerpo, solo donde dice «Un ejemplo:», «Imagina que…», «En un experimento…»; la idea; `autocorreccion` | Una por lección que traiga un caso (el 13 %) |
| `libro` | El libro en una frase → sus ideas centrales → la frase que las une → marca | `datos/mapas.json` (cierre y nodos) | Una por libro con mapa |

Hay ejemplos renderizados (sin voz) y sus hojas de fotogramas en [`ejemplos-compartir/`](ejemplos-compartir/LEEME.md).

**Explicar bien va antes que los 60 segundos.** La pieza `idea` dura lo que su explicación pida (mediana, 1 min 35 s): una idea afirmada sin su porqué se recuerda peor y se malinterpreta mejor. La explicación no se redacta ni se elige frase a frase: es **el cuerpo de la lección desde el principio, por párrafos enteros** (hasta 150 palabras; en `fondo`, todo). Así ninguna frase se queda sin la salvedad que la sigue, y las marcas del propio texto («Fuera del libro:», «Lectura nuestra:») se dicen tal cual. Con `--breve` salen las piezas de antes, de 30-60 s: sin explicación y con el matiz en su primera frase.

**El esquema acompaña a la explicación.** Mientras la voz explica, los rótulos del esquema están a la vista y cada uno se enciende cuando la voz lo nombra; si los nombra todos, después no se recorren otra vez. Si el pie del esquema dice lo mismo que el matiz, solo se oye el matiz. Al cambiar de sección, el fotograma nuevo entra con un empuje lateral; el esquema se construye pieza a pieza, cada una dibujándose al entrar, y el texto entra con un barrido breve. El esquema acompañante toma la forma de su figura (contraste, cadena, ciclo, mapa, matriz, espectro) y cada sección lleva un icono de la biblioteca que dice qué tipo de momento es (nunca qué significa el contenido).

**Voz:** `--format compartir` usa por defecto `fr-FR-RemyMultilingualNeural` (Edge, gratuita) a ritmo y tono naturales, elegida de oído entre once. Se cambia con `--voice`, `--ritmo` y `--tono`.

Lo que tienen en común, y lo que las distingue del resto del generador:

- **Todo lo que se oye se ve**, en grande y a la vez que se dice: el texto entra por ráfagas de 2-4 palabras, en páginas de 14 palabras como mucho. No hay barra de subtítulos: la pantalla es el subtítulo y la pieza se sigue sin sonido. El `.srt` se entrega igualmente.
- **Toda pieza de una lección lleva su matiz y su crédito.** El libro y el autor están en el pie desde el primer fotograma y se dicen una vez; el matiz se dice siempre (y si la lección trae una salvedad de seguridad —«no sustituye a un profesional»— no se recorta nunca). Una pieza a la que le falte cualquiera de los dos no se renderiza.
- **La pieza tiene arco:** tensión (la idea en frío, o la pregunta que la lección se hace) → de dónde sale → desarrollo que se ve → giro (el matiz) → «Quédate con esto», que repite el gancho. Si la lección no da para tanto, la pieza se simplifica (sin esquema, o abriendo con el esquema) o no sale; `manifiesto.json` dice qué `arco` tiene cada una.
- **El esquema se ve con el patrón que le va**, siempre con sus rótulos literales: **contraste** de dos paneles (`comparar`), **cadena** de eslabones (`pasos`, `piramide`, `tiempo`, `escalera`…), **radial** con su centro (`mapa`), **ciclo** que vuelve al principio, **espectro** entre dos polos, **cifra** en grande, **matriz** de dos ejes o **iceberg**. Primero la estructura entera, después pieza a pieza y, al final, su pie. Y si la idea es un «no X, sino Y», lo afirmado queda en color.
- **El control de calidad mira también lo que solo se ve** (tarjetas, miniatura, textos de publicación), exige que cada recorte empiece donde empieza una frase y que la respuesta sea la correcta de su pregunta. Las preguntas en negativo («¿cuál es FALSA?») no se usan.
- **Las únicas frases que no son del corpus** son las once de `FORMULAS` en `compartir.py` («Del libro X, de Y.», «El matiz.», «La respuesta:», «En una imagen: …», «Más ideas como esta, en Mente Fría.»…). El control de calidad rechaza cualquier otra.
- **Cada libro se reconoce:** el acento es el de su eje y el motivo del fondo sale del libro; todas sus piezas repiten la misma estructura.
- **Dos piezas del mismo libro no abren igual**, y `manifiesto.json` propone un orden de publicación que alterna tipos y no junta dos piezas de la misma lección.

### Un libro

- `00-presentacion`: qué libro es (descripción), sus ideas centrales (el mapa, nodo a nodo) y el recorrido por lecciones.
- `01-…` a `NN-…`: una lección por episodio.
- `99-repaso`: la idea de cada lección (las mismas frases de la serie), el mapa completo y dos preguntas del libro.
- Con `--merge`, además `libro-completo.mp4` con un capítulo por episodio.

---

## Requisitos

- **Python 3.10+**, **ffmpeg** y **ffprobe** en el `PATH` (`brew install ffmpeg`).
- **Google Chrome** o Chromium (dibuja los fotogramas y los esquemas). Si no está en la ruta habitual, indica la suya con `CHROME_BIN`.
- *(Opcional)* **Node**: si está, el control de calidad comprueba que el motor sabe dibujar cada esquema.

```bash
python3 -m venv tools/video/.venv
```

```bash
tools/video/.venv/bin/pip install -r tools/video/requirements.txt
```

No hace falta configurar nada más: el corpus se lee con la clave pública de la app y la voz por defecto es **Edge TTS** (gratis, sin clave). Todo lo predeterminado es gratuito.

### Voz: qué hay y cuánto cuesta

| Motor | Coste | Dónde corre | Marcas por palabra | Notas |
|---|---|---|---|---|
| `edge` *(por defecto)* | Gratis, sin clave | En línea (servicio de lectura de Microsoft Edge) | Sí: subtítulos exactos | `es-ES-AlvaroNeural`, `ElviraNeural`, `XimenaNeural`; y las multilingües (`en-US-BrianMultilingualNeural`, `AvaMultilingual`, `EmmaMultilingual`, `fr-FR-VivienneMultilingual`, `RemyMultilingual`), más naturales y que pronuncian bien los títulos en inglés, con acento no peninsular. |
| `kokoro` | Gratis (Apache 2.0) | **Local**, sin red tras la primera descarga | No: subtítulos proporcionales | `em_alex`, `em_santa`, `ef_dora`. `pip install -r tools/video/requirements-kokoro.txt`; el modelo (~90 MB + 28 MB de voces) se baja solo a `tools/video/.modelos/kokoro/`. `KOKORO_MODELO=completo` usa el modelo sin cuantizar (~310 MB). |
| `mudo` | Gratis | Local | — | Previsualización sin voz. |
| `gemini` / `auto` | **De pago** (clave `GEMINI_API_KEY` en `tools/video/.env`) | En línea | No | Solo si se piden con `--engine`. `auto` prueba Gemini y cae a Edge. |

Para elegir de oído: `leccion "<título>" --sample-voices --engine edge` (y `--engine kokoro`) deja una muestra por voz en `output/<libro>/muestras/<motor>/`.

---

## Uso

Desde la raíz del repositorio:

```bash
# Una lección (por título, exacto o parcial, o por id)
tools/video/.venv/bin/python -m tools.video.cli leccion "El No como Herramienta"
```

```bash
# El libro entero: presentación + lecciones + repaso, y el libro unido en un solo vídeo
tools/video/.venv/bin/python -m tools.video.cli libro "Never Split the Difference" --engine edge --voice es-ES-AlvaroNeural --merge
```

```bash
# Los 3 siguientes libros de la biblioteca que aún no tienen serie completa
tools/video/.venv/bin/python -m tools.video.cli biblioteca --limit 3 --engine edge
```

```bash
# Revisar los guiones antes de gastar voz: solo guion.md + control de calidad
tools/video/.venv/bin/python -m tools.video.cli libro "Fluir" --script-only
```

```bash
# Previsualizar el vídeo sin voz (rápido, sin red de voz): fotogramas, ritmo y subtítulos
tools/video/.venv/bin/python -m tools.video.cli leccion "El No como Herramienta" --engine mudo
```

```bash
# Piezas compartibles de un libro (todas), sin voz, para revisar el aspecto
tools/video/.venv/bin/python -m tools.video.cli libro "Decisive" --format compartir --engine mudo
```

```bash
# Solo las piezas «idea» y «libro», cuadradas, con voz
tools/video/.venv/bin/python -m tools.video.cli libro "Decisive" --format compartir --piezas idea,libro --aspecto 1:1
```

```bash
# Calendario de publicación con lo ya generado de todos los libros, dos piezas al día
tools/video/.venv/bin/python -m tools.video.cli calendario --desde 2026-12-01 --por-dia 2
```

```bash
# Las piezas de una lección · las de los 5 libros siguientes sin terminar
tools/video/.venv/bin/python -m tools.video.cli leccion "Ampliar las opciones" --format compartir
tools/video/.venv/bin/python -m tools.video.cli biblioteca --format compartir --limit 5
```

| Opción | Qué hace |
|---|---|
| `--format clase\|corto\|compartir` | Lección completa (por defecto), resumen de 60-90 s dentro de la serie, o piezas sueltas para compartir. |
| `--piezas idea,pregunta,practica,caso,libro,fondo` *(compartir)* | Qué tipos de pieza generar. Por defecto, todos. |
| `--breve` *(compartir)* | Las piezas de 30-60 s: la idea sin la explicación del cuerpo y el matiz en su primera frase. |
| `--ritmo +0%` · `--tono +0Hz` *(edge)* | Velocidad y tono de la voz. Por defecto −8 % y −2 Hz en `clase` y `corto`; en `compartir`, `+0%` y `+0Hz` (la voz como es). También `EDGE_RATE` y `EDGE_PITCH`. |
| `--max-seg 60` *(compartir)* | No genera las piezas que duren (estimado) más de esos segundos. |
| `--excluir "trading,inversión"` *(compartir)* | No genera las piezas cuya locución nombre esos temas. |
| `--seguir "Sigue a @cuenta"` *(compartir)* | El rótulo del cierre: la cuenta o dónde seguir. No se lee en voz alta. |
| `--aspecto 9:16\|1:1\|16:9` *(compartir)* | Vertical (por defecto), cuadrado u horizontal. Cada aspecto va a su carpeta. |
| `--engine edge\|kokoro\|mudo\|gemini\|auto` | Motor de voz (ver la tabla de arriba). Sin la opción: `edge`, o lo que diga `TTS_ENGINE`. |
| `--voice <nombre>` | Una voz del motor elegido: `es-ES-AlvaroNeural`, `en-US-BrianMultilingualNeural`… (Edge) · `em_alex`, `ef_dora`… (Kokoro) · `Aoede`, `Charon`… (Gemini). |
| `--script-only` | Solo `guion.md`, `script.json` y control de calidad. |
| `--only 0,3-5,99` *(libro)* | Solo esos episodios: 0 = presentación, 1…N = lecciones, 99 = repaso. Con `compartir`: 0 = la pieza del libro, 1…N = las piezas de esa lección (el manifiesto solo se escribe con el libro entero). |
| `--merge` *(libro, biblioteca)* | Une los episodios en `libro-completo.mp4` con capítulos. |
| `--eje`, `--limit`, `--list` *(biblioteca)* | Filtra por eje, limita libros por ejecución o solo lista lo pendiente. |
| `--no-quiz` | Lecciones sin pregunta: ni gancho, ni repaso, ni pregunta del siguiente episodio. |
| `--photos` | Fondo fotográfico (Wikimedia Commons) en portadas y cierres. Ambiente, nunca contenido. |
| `--force` | Renderiza aunque nada haya cambiado. |
| `--sample-voices` *(leccion)* | Muestras de la idea con varias voces, para elegir. |

La orden antigua sigue valiendo: `cli "<título de lección>"` equivale a `leccion` y `cli "<libro>" --book` a `libro`.

### Es repetible

Cada episodio guarda una huella de su guion, voz y motor de fotogramas. Al repetir la orden, lo que no ha cambiado no se vuelve a renderizar (`↷ sin-cambios`); si se corrige una lección en la biblioteca, solo se rehacen los episodios a los que afecta (el suyo, el siguiente —que la cita en el puente— y el repaso). Las locuciones se guardan en `output/_cache/voz/`, así que la frase que se repite entre episodios se sintetiza una vez y suena igual en todos, y rehacer un episodio no vuelve a gastar voz (se puede borrar la carpeta cuando se quiera). Un episodio que falla no detiene la serie, ni un libro la biblioteca: el resumen final dice cuáles y por qué.

---

## Salida

`tools/video/output/<libro>/<formato>/`

```
serie.json            manifiesto: episodios, duración, estado, voces
lista.m3u             lista de reproducción en orden
libro-completo.mp4    (con --merge) + libro-completo.txt con los capítulos
00-presentacion/
03-el-no-como-herramienta/
    video.mp4         H.264/AAC, 30 fps, capítulos incrustados, subtítulos quemados (palabra activa resaltada)
    video.srt         subtítulos por frase, para subirlos aparte
    guion.md          qué se oye, qué se ve y de qué campo del corpus sale cada tramo
    script.json       el guion estructurado
    descripcion.txt   texto de publicación: título, lugar en la serie, idea y capítulos con su minuto
    miniatura.png     la portada del episodio
99-repaso/
```

Con `--format compartir`: `tools/video/output/<libro>/compartir/<aspecto>/`

```
manifiesto.json       todas las piezas en el orden de publicación sugerido: título, gancho, etiquetas,
                      duración, estado y rutas; y las que no han salido, con su motivo
manifiesto.md         lo mismo, para leer
libro/                la pieza del libro
idea-03-contrastar-los-supuestos-con-la-realidad/
    video.mp4         H.264/AAC, 30 fps, texto en el propio fotograma, barra de progreso
    video.srt         subtítulos por frase, para subirlos aparte
    miniatura.png     portada pensada para verse pequeña: el gancho, el libro y la marca
    publicacion.txt   título, descripción (idea, matiz y crédito), etiquetas y la versión de cada red
    publicacion.json  lo mismo por red (YouTube Shorts, TikTok, Reels, LinkedIn, X, WhatsApp), para automatizar
    guion.md          qué se oye, qué se ve y de qué campo sale cada tramo
    script.json       el guion estructurado
pregunta-03-…/  practica-03-…/
```

---

## Cómo está hecho

| Módulo | Papel |
|---|---|
| `corpus.py` | Lee el libro con sus lecciones, preguntas, esquemas (`datos/diagramas.json`) y mapa (`datos/mapas.json`). |
| `text.py` | Frases (sin cortar en abreviaturas, iniciales, decimales ni comillas), texto para la voz, términos clave. |
| `guia.py` | Las piezas de la figura de la lección y en qué palabra de la locución se nombra cada una. |
| `scriptwriter.py` | La secuencia didáctica de cada episodio y la serie del libro. Las fórmulas fijas están en `PHRASES`. |
| `lint.py` | Control de calidad: fidelidad literal al corpus, preguntas válidas, esquemas dibujables, duración. |
| `compartir.py` | Las piezas compartibles: qué texto se elige (siempre literal), páginas y ráfagas del texto cinético, plan y orden de publicación de un libro. Las fórmulas fijas están en `FORMULAS`. |
| `compartir_frames.py` + `assets/compartir.*` | Los fotogramas de las piezas: sin cabecera de aplicación, zona segura para la interfaz de las redes, tres aspectos. |
| `frames.py` + `assets/` | Cada estado de cada escena en HTML, capturado con Chrome sin cabeza. |
| `cdp.py` | La captura: un solo Chrome y todas las capturas por DevTools. Si falla, se vuelve a un Chrome por fotograma (`VF_CAPTURA=clasica` lo fuerza). |
| `renderer.py` | Línea de tiempo mandada por la voz, fundidos, subtítulos, capítulos y mezcla con ffmpeg. |
| `tts/` | Motores intercambiables (Edge, Kokoro, mudo, Gemini) y caché de locuciones. |
| `visuals.py` | Fondo fotográfico opcional (`--photos`). |

Pruebas (sin red, sin Chrome y sin voz):

```bash
tools/video/.venv/bin/python -m unittest discover -s tools/video/tests -t .
```

---

## Límites conocidos

- **Piezas compartibles: lo que no se ha podido comprobar.** Se han renderizado y medido con la voz real de Edge (duración, silencios, sincronía, volumen: ver `DISEÑO-COMPARTIBLE.md`), y la voz se eligió de oído sobre una muestra corta. Sigue sin juzgarse la naturalidad de las fórmulas y la pronunciación de títulos en inglés. Tampoco el comportamiento de cada plataforma (recortes, zona tapada por su interfaz, compresión). Hay ocho piezas con voz en `ejemplos-compartir/con-voz/`.
- **Piezas sin material.** En toda la biblioteca salen 10.803 piezas (3.719 `idea`, 2.620 `pregunta`, 3.476 `practica`, 482 `caso`, 506 `libro`). Tres de cada diez lecciones no tienen una pregunta que se entienda sin la lección delante («Según la lección…», «en el capítulo 7…»): no hay pieza `pregunta`. Los libros sin mapa (13 de 519) no tienen pieza `libro`. El 1,2 % de las figuras (fórmulas, redes, gráficas…) aún no tiene patrón: su pieza `idea` sale sin esquema. Todo queda anotado en `manifiesto.json`.
- **La idea, cuando la lección no la tiene redactada** (~23 %), es el arranque del cuerpo (frases enteras, hasta 36 palabras). Si ese arranque solo habla del libro («Newport dedica una sección…»), la pieza abre con el esquema; los demás casos salen tal cual y no todos son igual de rotundos.
- **Sin sonido de apoyo ni música**, y sin base medida con espectadores: los principios de aprendizaje y atención que guían el formato están en `DISEÑO-COMPARTIBLE.md` con sus límites.
- **Textos del corpus que hablan de «la lección»** («Esta lección no sustituye a un profesional»): se respetan literales y el control avisa. Si hay alternativa (otra pregunta, la idea redactada), se usa la que no lo dice.
- **Tiempo de cómputo.** Una lección de 5 min tarda del orden de 1-2 min en renderizarse; la biblioteca entera (más de 3.700 lecciones) son decenas de horas. `biblioteca` va por tandas (`--limit`) y retoma donde lo dejó.
- **Pregunta de repaso.** Solo se usa si la pregunta está ligada a la lección en la base de datos (`preguntas.leccion_id`). En los libros antiguos muchas preguntas van ligadas solo al libro: esas aparecen en el repaso final, no en cada lección.
- **Lecciones sin idea redactada** (~25 %). El hilo es entonces la primera frase del cuerpo y se rotula «El punto de partida», no «La idea».
- **Lecciones sin esquema** (~17 %). El vídeo sale sin figura y el control de calidad lo avisa.
- **Términos señalados.** Se detectan por reglas (comillas, nombres propios, rótulos del esquema); son literales del texto, pero alguno puede ser poco relevante.
- **Preguntas con opciones largas.** La escena de repaso sigue siendo la que más texto lleva: las opciones del corpus son frases enteras y hay que verlas para elegir.
- **El corto puede pasar de 90 s** cuando lleva pregunta y respuesta (hasta ~100 s); el control de calidad avisa a partir de 115 s.
- **Detrás de un proxy.** Edge TTS usa el proxy de `HTTPS_PROXY` (respetando `NO_PROXY`) y confía además en los certificados de `SSL_CERT_FILE` o `REQUESTS_CA_BUNDLE`; sin esas variables, sale directo como siempre. El host que hay que permitir es `speech.platform.bing.com`.
- **Ni Gemini ni Kokoro dan marcas por palabra.** Con esas voces, los subtítulos y la entrada de los términos se reparten de forma proporcional dentro de cada escena; con Edge son exactos.
- **Voces mezcladas.** Con `--engine auto`, si la cuota de Gemini se agota a mitad de un libro el resto sale con Edge. La orden lo avisa; para una serie con una sola voz, fija `--engine` y `--voice`.
- **Pronunciación.** Las voces `es-ES-*` y las de Kokoro leen los títulos y términos en inglés a la española; las multilingües de Edge los pronuncian bien a cambio de un acento menos peninsular.
