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

Los MP3 **no viven en el repositorio**: están en un cubo público de Cloudflare R2 (`mentefria-audio`, plan gratuito: 10 GB y descargas sin coste) y `datos/audios.json` apunta allí con su campo `base`. La carpeta `audio/` es solo la salida local del generador y está fuera de git.

Después de generar libros nuevos, se suben con:

```bash
CLOUDFLARE_API_TOKEN=… python -m tools.audio.subir_r2 --cuenta <id de cuenta> --cubo mentefria-audio --base https://pub-30bd89532c4445dba84e3574b238f99e.r2.dev/
```

Sube solo lo que falta o ha cambiado y no toca el índice si algo falla. El token necesita permiso de R2 («Admin Read & Write»). La app solo acepta como `base` una ruta del propio sitio o una dirección `https://pub-….r2.dev/` (`lib/audio.js`); con un dominio propio habría que añadirlo ahí.

La biblioteca entera está grabada y subida: 3.719 lecciones de 519 libros, 156,7 horas y 3,39 GB (el plan gratuito da 10 GB). Grabarla llevó unas seis horas con diez libros a la vez. Cloudflare describe la dirección `r2.dev` como pensada para desarrollo y con límite de peticiones; si el tráfico crece, lo indicado es conectar al cubo un dominio propio.

Comprobado tras la subida: el índice cubre exactamente las lecciones del corpus, 25 audios al azar responden por la dirección pública con su tamaño y tipo, y uno descargado por la dirección pública es idéntico al local, llega como `audio/mpeg` y con la cabecera CORS que la app necesita.

Alternativas miradas (datos de la documentación oficial de cada servicio, noviembre de 2026; lo marcado «sin confirmar» no se pudo verificar):

| Opción | Gratis hasta | Encaja | Pegas |
|---|---|---|---|
| **Cloudflare R2** | 10 GB, descargas sin coste | Sí, entero y con margen | Hay que crear cuenta; puede pedir un medio de pago aunque no cobre (sin confirmar). La dirección pública `r2.dev` es «solo para desarrollo» y limita peticiones: lo serio es un dominio propio en Cloudflare. Se puede subir con un token de API, sin claves en el equipo. |
| **Backblaze B2** | 10 GB; descargas gratis hasta el triple de lo guardado al mes (unos 10 GB) | Sí | Hay que crear cuenta (sin tarjeta, sin confirmar). Por encima de ese tráfico cobra. |
| **Varios repositorios con GitHub Pages** | 1 GB por sitio, 100 GB de tráfico al mes (límites blandos) | Con cinco repositorios | Sin cuenta nueva ni tarjeta, pero es un apaño: cinco repositorios solo para audio y al borde de lo que GitHub considera uso razonable. |
| **Supabase (el proyecto de la app)** | 1 GB y 5 GB de tráfico | No | El plan gratuito se queda corto; el de pago son 25 $ al mes. |
| **GitHub Releases** | Sin límite total | No | Las descargas no llevan cabecera CORS: la app no puede leerlas. |

La app está preparada para cualquiera de ellas con un cambio pequeño: hoy `base` en `datos/audios.json` solo admite una ruta del propio sitio; para otro dominio hay que añadirlo a una lista de permitidos en `grabado` (`lib/audio.js`).

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

Con los vídeos (`--piezas tools/video/output/<libro>`), sobre los 279 de los diez libros: un corte real, en una locución que venía de la caché de voz y se había guardado antes de existir la barrera 1. Desde entonces la caché (`tools/video/tts/cache.py`) valida cada locución al leerla y vuelve a pedir la que esté cortada. El reconocedor da además falsos avisos en frases con títulos o nombres en inglés («Del libro The War of Art…»): se descartan transcribiendo solo ese tramo.

Con la biblioteca entera grabada, el reconocedor pasó por una muestra de 33 libros (255 lecciones): ningún corte. Dos avisos, ambos comprobados tramo a tramo y falsos (apellidos y una frase que el reconocedor transcribió a medias).

Desde entonces el verificador hace ese descarte solo: si la primera escucha deja un tramo sin oír, repite por tramos de 30 s; y con los vídeos, lo que siga sin reconocerse y lleve inglés (un título, un nombre) queda como **aviso** —no como fallo— si en su tramo del vídeo hay voz. Un tramo solo en español que no se reconoce sigue siendo fallo.
