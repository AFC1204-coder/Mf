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

## Comprobación

Cada tanda se puede comprobar con un reconocedor de voz (Whisper): transcribir el MP3 y medir cuántas palabras del texto se oyen, en orden. En los diez primeros libros, todas las lecciones salen reconocidas en español y con el texto completo (ver el PR).
