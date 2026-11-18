# Vídeos didácticos (9:16) — Mente Fría

Convierte el corpus de la biblioteca en vídeo vertical (`1080×1920`) de forma automática: una lección, la **serie completa de un libro** (presentación + una lección por episodio + repaso) o la biblioteca entera, libro a libro.

Tres reglas lo gobiernan:

1. **La voz solo dice texto del corpus.** No hay modelo que redacte. El guion recorta la lección por frases enteras (idea, cuerpo, matiz, aplicación, pregunta) y la une con unas pocas fórmulas fijas («Lección 3 de 8», «Venimos de…»). Un control de calidad lo comprueba antes de renderizar: si un tramo no está literal en la biblioteca, el episodio no sale.
2. **Lo que se ve es contenido, no decoración.** El esquema es el de la lección, dibujado con el mismo motor de la app (`lib/diagram.js`); el mapa del libro sale de `datos/mapas.json`; la pregunta es una de las de la lección.
3. **El libro es una serie.** Todas las lecciones siguen la misma secuencia, visible en pantalla como índice, y comparten un hilo: la idea de cada lección en una frase abre su episodio, lo cierra, enlaza con el siguiente y vuelve en el repaso final, siempre con las mismas palabras.

---

## Qué genera

### Una lección (`--format clase`, 3-5 min)

| Paso | En pantalla | Voz | Para qué |
|---|---|---|---|
| Portada | Libro, autor, «Lección 3 de 8», puntos del recorrido | Título y lugar en el libro | Situar |
| Puente *(desde la 2.ª)* | La lección anterior y su idea | «Venimos de…» + esa idea | Activar lo ya visto |
| **Idea** | La idea en una frase, grande | La misma frase | Dar el destino antes del camino |
| **Desarrollo** | Frase ancla de cada bloque + términos que entran cuando se nombran | El cuerpo de la lección, entero | Explicar |
| **Esquema** | El esquema verificado de la lección | Su título y su pie, y un silencio para leerlo | Sintetizar en una figura |
| **Matiz** | Dónde se le discute a la idea | La autocorrección | No aprender la idea sin su límite |
| **Práctica** | Qué hacer con ella | La aplicación práctica | Transferir |
| **Repaso** | Pregunta con opciones → cuenta atrás en silencio → respuesta razonada | Pregunta, respuesta y explicación | Recuperar (lo que más fija) |
| Cierre | La idea otra vez + la siguiente lección | «Quédate con esto…» | Cerrar el círculo y enlazar |

El índice (Idea · Desarrollo · Esquema · Matiz · Práctica · Repaso) está siempre arriba con la sección en curso resaltada. Si una lección no tiene esquema o pregunta ligada, esa entrada no aparece.

`--format corto` (60-90 s, para redes): la idea, las frases que abren hasta tres bloques, el esquema, la primera frase del matiz y de la práctica, y la siguiente lección. Sin pregunta.

### Un libro

- `00-presentacion`: qué libro es (descripción), sus ideas centrales (el mapa, nodo a nodo) y el recorrido por lecciones.
- `01-…` a `NN-…`: una lección por episodio.
- `99-repaso`: la idea de cada lección (las mismas frases de la serie), el mapa completo y hasta tres preguntas.
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

No hace falta configurar nada más: el corpus se lee con la clave pública de la app y la voz por defecto cae a **Edge TTS** (gratis, sin clave). Para usar **Gemini TTS**, copia `tools/video/.env.example` a `tools/video/.env` y pon tu `GEMINI_API_KEY`.

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

| Opción | Qué hace |
|---|---|
| `--format clase\|corto` | Lección completa (por defecto) o pieza de 60-90 s. |
| `--engine auto\|gemini\|edge\|mudo` | Motor de voz. `auto`: Gemini y, si falla la cuota, Edge. `mudo`: sin voz, para previsualizar. |
| `--voice <nombre>` | `Aoede`, `Charon`, `Fenrir` (Gemini) · `es-ES-AlvaroNeural`, `es-ES-ElviraNeural`, `es-ES-XimenaNeural` (Edge). |
| `--script-only` | Solo `guion.md`, `script.json` y control de calidad. |
| `--only 0,3-5,99` *(libro)* | Solo esos episodios: 0 = presentación, 1…N = lecciones, 99 = repaso. |
| `--merge` *(libro, biblioteca)* | Une los episodios en `libro-completo.mp4` con capítulos. |
| `--eje`, `--limit`, `--list` *(biblioteca)* | Filtra por eje, limita libros por ejecución o solo lista lo pendiente. |
| `--no-quiz` | Lecciones sin la pregunta de repaso. |
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

---

## Cómo está hecho

| Módulo | Papel |
|---|---|
| `corpus.py` | Lee el libro con sus lecciones, preguntas, esquemas (`datos/diagramas.json`) y mapa (`datos/mapas.json`). |
| `text.py` | Frases (sin cortar en abreviaturas, iniciales, decimales ni comillas), texto para la voz, términos clave. |
| `scriptwriter.py` | La secuencia didáctica de cada episodio y la serie del libro. Las fórmulas fijas están en `PHRASES`. |
| `lint.py` | Control de calidad: fidelidad literal al corpus, preguntas válidas, esquemas dibujables, duración. |
| `frames.py` + `assets/` | Cada estado de cada escena en HTML, capturado con Chrome sin cabeza. |
| `renderer.py` | Línea de tiempo mandada por la voz, fundidos, subtítulos, capítulos y mezcla con ffmpeg. |
| `tts/` | Motores intercambiables (Gemini, Edge, mudo) y caché de locuciones. |
| `visuals.py` | Fondo fotográfico opcional (`--photos`). |

Pruebas (sin red, sin Chrome y sin voz):

```bash
tools/video/.venv/bin/python -m unittest discover -s tools/video/tests -t .
```

---

## Límites conocidos

- **Tiempo de cómputo.** Una lección de 5 min tarda del orden de 1-2 min en renderizarse; la biblioteca entera (más de 3.700 lecciones) son decenas de horas. `biblioteca` va por tandas (`--limit`) y retoma donde lo dejó.
- **Pregunta de repaso.** Solo se usa si la pregunta está ligada a la lección en la base de datos (`preguntas.leccion_id`). En los libros antiguos muchas preguntas van ligadas solo al libro: esas aparecen en el repaso final, no en cada lección.
- **Lecciones sin idea redactada** (~25 %). El hilo es entonces la primera frase del cuerpo y se rotula «El punto de partida», no «La idea».
- **Lecciones sin esquema** (~17 %). El vídeo sale sin figura y el control de calidad lo avisa.
- **Términos señalados.** Se detectan por reglas (comillas, nombres propios, rótulos del esquema); son literales del texto, pero alguno puede ser poco relevante.
- **Gemini no da marcas por palabra.** Con esa voz, los subtítulos y la entrada de los términos se reparten de forma proporcional dentro de cada escena; con Edge son exactos.
- **Voces mezcladas.** Con `--engine auto`, si la cuota de Gemini se agota a mitad de un libro el resto sale con Edge. La orden lo avisa; para una serie con una sola voz, fija `--engine` y `--voice`.
- **Pronunciación.** Los títulos y términos en inglés los lee una voz española.
