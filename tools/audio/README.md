# Audiolibro — Mente Fría

Un MP3 por lección, con **la misma voz que los vídeos** (`fr-FR-RemyMultilingualNeural`, Edge TTS: gratis y sin clave), y el índice que usa la app para reproducirlos.

## Qué dice cada audio

Nada que no esté en la lección, y en este orden:

1. «Lección N: *título*.» — fórmula fija más el título.
2. El **cuerpo** de la lección, entero, párrafo a párrafo.
3. «El matiz.» y la **autocorrección** de la lección, si la tiene (igual que en los vídeos: la idea sin su límite exagera). Se quita con `--sin-matiz`.

El texto pasa solo por la limpieza para voz de los vídeos (`tools/video/text.py`, `for_speech`): quita marcas de formato y convierte flechas y rayas en pausas; no añade ni quita palabras con significado.

## Uso

```bash
# Uno o varios libros (título exacto o parcial, o id):
python -m tools.audio.generar_audiolibro "Decisive" "Hábitos Atómicos"

# Además, el libro entero en un solo MP3 (queda en tools/audio/output/, no se publica):
python -m tools.audio.generar_audiolibro "Decisive" --merge
```

No hace falta ningún `.env`: lee el corpus con la clave pública de la app, como `tools/video`.

Salida:

- `audio/<id de la lección>.mp3` — lo que reproduce la app. Mono, 48 kbps, con título, autor y libro en las etiquetas (unos 0,36 MB por minuto; una lección ronda 1 MB).
- `datos/audios.json` — el índice: por lección, duración (`s`), huella del texto (`h`), huella de la voz y el montaje (`r`) y tamaño (`b`).
- `tools/audio/output/<libro>/` — lista `audiolibro.m3u` y `manifest.json` (y el MP3 único con `--merge`). No se sube al repositorio.

Es repetible: una lección cuyo texto, voz y receta no han cambiado no se vuelve a generar. Una lección que falla no detiene el libro, y un libro que falla no detiene la tanda.

## Cómo llega a la página

La app (`app.js`, bloque TTS, y `lib/audio.js`) carga `datos/audios.json` con el resto del corpus. Al pulsar «Escuchar lección»:

1. Si la lección está en el índice **y la huella de su texto coincide**, suena el audio grabado (`audio/<id>.mp3`) y queda guardado en el dispositivo para la próxima vez. Bajo el botón se lee «Audio grabado · 3 min».
2. Si no, sigue como antes: voz generada al momento (Google Cloud) y, si falla, la voz del navegador.

El **modo audiolibro** (el botón del libro en el reproductor) encadena las lecciones del libro, y con audio grabado sigue con la pantalla apagada.

La huella es la garantía de que no se oye una cosa y se lee otra: si alguien corrige el texto de una lección, su audio grabado deja de usarse solo, sin tocar nada, hasta que se vuelva a ejecutar el generador para ese libro. La cuenta es la misma en `tools/audio/generar_audiolibro.py` (`huella_texto`) y en `lib/audio.js` (`huella`); hay un test a cada lado con el mismo valor fijado.

El *service worker* no guarda los MP3 en su caché (pesan); la app guarda aparte, en el dispositivo, los que se han escuchado.

## Cuánto ocupa y dónde vive

Los MP3 viven en el repositorio (carpeta `audio/`) y los sirve GitHub Pages, como el resto de la web. Eso vale para una tanda de libros, no para la biblioteca entera: las 3.719 lecciones serían unas 119 horas y unos 2,6 GB, más de lo que admite un sitio de GitHub Pages (1 GB). Para pasar de unas decenas de libros hay que llevar los MP3 a un almacenamiento aparte y cambiar `base` en `datos/audios.json` (la app solo acepta una ruta relativa del propio sitio; para otro dominio hay que ampliar `grabado` en `lib/audio.js`).

## Comprobación: que el audio diga todo el texto

El servicio de voz devuelve a veces una locución **cortada sin dar error**: el archivo llega, suena bien y le falta la última frase. En la primera grabación de los diez libros pasó en 2 de 74 lecciones (una frase del matiz y otra del cuerpo sin decir). Hay tres barreras:

1. **En el motor de voz** (`tools/video/tts/edge_tts_engine.py`, `incompleta`; vale también para los vídeos): una locución con marcas para menos palabras de las que tiene el texto, o cuyo audio acaba antes que su última palabra, se vuelve a pedir.
2. **En el montaje:** el MP3 final debe durar lo que suman sus locuciones y pausas (±1 s); si no, la lección falla y no entra en el índice.
3. **De extremo a extremo, con un reconocedor de voz** (opcional, `pip install faster-whisper`):

   ```bash
   python -m tools.audio.verificar "Decisive" "Range"
   ```

   Transcribe cada MP3 y lo compara con el texto. Falla si una lección no se reconoce en español, si falta un tramo de seis palabras o más, o si el parecido baja de 0,90.

Resultado tras regrabar con las barreras 1 y 2: las 74 lecciones reconocidas en español, ningún tramo sin decir, parecido entre 0,946 y 1 (lo que baja de 1 son apellidos, cifras y palabras en inglés que el reconocedor escribe a su manera).
