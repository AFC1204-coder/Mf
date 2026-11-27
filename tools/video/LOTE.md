# Renderizar un lote de libros en tu ordenador

Para producir en serie sin depender de una sesión en la nube. Todo es gratuito y no pide claves.

## Una vez: preparar

Hace falta **Python 3.10+**, **ffmpeg** (con ffprobe) y **Google Chrome** o Chromium. En macOS: `brew install ffmpeg`.

Desde la raíz del repositorio, en la rama `claude/video-compartible`:

```bash
python3 -m venv tools/video/.venv
```

```bash
tools/video/.venv/bin/pip install -r tools/video/requirements.txt
```

## Lanzar el lote

Un libro entero, con todas sus piezas y con la voz elegida:

```bash
tools/video/.venv/bin/python -m tools.video.cli libro "Decisive" --format compartir
```

Los diez libros del lote de prueba, uno detrás de otro:

```bash
for libro in "Decisive" "Four Thousand Weeks" "Hábitos Atómicos" "El hombre en busca de sentido" "The War of Art" "Dopamine Nation" "Range" "Verbal Judo" "Attached" "Games People Play"; do tools/video/.venv/bin/python -m tools.video.cli libro "$libro" --format compartir; done
```

O los siguientes libros de la biblioteca que aún no estén completos, sin nombrarlos:

```bash
tools/video/.venv/bin/python -m tools.video.cli biblioteca --format compartir --limit 10
```

## Qué esperar

- **Tiempo.** Cada pieza tarda más o menos lo que dura (algo más en un equipo lento). Un libro son unas 25 piezas y 40 minutos de vídeo: cuenta con una hora por libro.
- **Se puede cortar y retomar.** Si lo paras o se va la red, vuelve a lanzar la misma orden: las piezas ya hechas se saltan («sin cambios») y sigue por donde iba.
- **Un fallo no detiene el lote.** La pieza que falle queda anotada y las demás siguen. Al terminar, lanza la misma orden otra vez: solo reintenta las que faltan.
- **La voz necesita conexión.** Es un servicio gratuito en línea y a ratos no responde; el generador reintenta solo durante minuto y medio antes de dar la pieza por fallida.
- **Varios libros a la vez.** Se puede abrir una terminal por libro. Con más de dos a la vez en un portátil normal no se gana tiempo.

## Dónde queda todo

`tools/video/output/<libro>/compartir/9x16/`

- Una carpeta por pieza con `video.mp4`, `video.srt`, `miniatura.png`, `guion.md` y `publicacion.txt` (el texto para cada red).
- `manifiesto.md`: las piezas del libro, su duración, el orden de publicación sugerido y lo que no ha salido, con su motivo.

Con varios libros hechos, el calendario de publicación:

```bash
tools/video/.venv/bin/python -m tools.video.cli calendario --por-dia 2
```

## Variantes útiles

| Quiero… | Añade |
|---|---|
| Solo las piezas cortas y las de idea | `--piezas idea,pregunta,practica,caso,libro` |
| Solo la versión larga | `--piezas fondo` |
| Las piezas de un minuto, sin explicación | `--breve` |
| Cuadrado u horizontal | `--aspecto 1:1` o `--aspecto 16:9` |
| Ver el aspecto sin gastar voz (rápido) | `--engine mudo` |
| Otra voz | `--voice es-ES-AlvaroNeural` |
| Sin los efectos de sonido (van por defecto; sintetizados, sin archivos de terceros) | `--sin-sonidos` |
| Ver las imágenes propuestas aún sin aprobar (no publicar) | `--imagenes-propuestas` |
| Ver los iconos propuestos aún sin aprobar (no publicar) | `--iconos-propuestos` |
| Solo la lección 3 de un libro | `--only 3` |

## Publicar en la web

Los vídeos no van en el repositorio: se suben a YouTube y la web los incrusta. La web solo necesita saber qué pieza es qué vídeo.

1. Sube los vídeos a YouTube. El título y la descripción de cada uno están en su `publicacion.txt`.
2. Abre `tools/video/publicados.csv` (hay una fila por pieza generada) y pega en la columna `youtube` el enlace de cada vídeo subido. Vale cualquier enlace de YouTube o el identificador suelto. No toques las demás columnas.
3. Lanza:

```bash
tools/video/.venv/bin/python -m tools.video.cli publicados
```

4. Sube al repositorio los dos archivos que cambian: `tools/video/publicados.csv` y `datos/videos.json`.

Qué sale en la web:

- **En la lección:** «Ver en vídeo» (la pieza `idea`) y «Versión larga» (la `fondo`).
- **En la ficha del libro:** «El libro en vídeo» (la pieza `libro`) e «Idea a idea» (la `recorrido`).
- Las piezas de pregunta, práctica y caso se pueden registrar igual, pero la web no las muestra: son para redes.
- Una lección sin vídeo registrado no muestra nada.

Qué avisa la orden:

- **Enlace que no es de YouTube, o el mismo vídeo en dos filas:** no se publica.
- **Guion cambiado:** si regeneras una pieza y su guion ya no es el del vídeo subido, ese vídeo deja de salir en la web. Sube el nuevo y cambia el enlace de la fila.
- Si lanzas la orden en un equipo donde no están generados todos los libros, los vídeos ya publicados de los demás se conservan.

## Subir a YouTube

`python -m tools.video.subir_youtube` sube las piezas renderizadas que aún no tienen enlace (las largas, en su versión horizontal si existe) y apunta cada enlace en `publicados.csv`. Quedan **privadas** salvo que se pida otra cosa con `--privacidad`. `--simular` enseña qué subiría.

Hace falta, una sola vez, dar permiso de subida al canal (pasos en Google Cloud con la cuenta dueña del canal; los nombres de los menús pueden variar):

1. En `console.cloud.google.com`, crear un proyecto.
2. «APIs y servicios» → «Biblioteca» → **YouTube Data API v3** → «Habilitar».
3. «Pantalla de consentimiento de OAuth»: tipo **Externo**, nombre y correo; después, **publicar la app** («En producción»). En «pruebas» el permiso caduca a los 7 días.
4. «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth» → **Aplicación web**, con este URI de redireccionamiento autorizado: `https://developers.google.com/oauthplayground`. Guarda el ID de cliente y el secreto.
5. En `https://developers.google.com/oauthplayground`: rueda dentada → «Use your own OAuth credentials» → pega ID y secreto. En el paso 1 escribe el permiso `https://www.googleapis.com/auth/youtube.upload` → «Authorize APIs» → elige la cuenta del canal (si avisa de que la app no está verificada: «Configuración avanzada» → continuar) → «Exchange authorization code for tokens». Copia el **Refresh token**.
6. En GitHub, en el repositorio: «Settings» → «Secrets and variables» → «Actions» → tres secretos: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.

Esas tres claves no se escriben nunca en el repositorio ni en un chat.

### Que suba solo cada día (GitHub Actions)

El flujo `.github/workflows/youtube.yml` («Subir a YouTube») renderiza las siguientes piezas pendientes y las sube sin que tengas el ordenador encendido.

1. En el repositorio: Settings → Secrets and variables → Actions → New repository secret. Crea `YT_CLIENT_ID`, `YT_CLIENT_SECRET` y `YT_REFRESH_TOKEN` con los valores de Google (el Refresh token es el que sale en el OAuth Playground). Nunca los pegues en un chat ni en un archivo.
2. Lanza una vez a mano: Actions → «Subir a YouTube» → Run workflow, elegida la rama `claude/video-compartible`. Con «simular» marcado solo muestra lo que subiría.
3. Los libros que entran en la cola están en `tools/video/cola_youtube.txt`, en orden; añade uno cuando su selección de lecciones esté revisada.

Los vídeos quedan **privados**; los pasas a públicos en YouTube Studio. Cada ejecución sube como mucho las que pongas en «cuántas» (2 por defecto) y se para sola cuando Google dice que se acabó el cupo del día. El horario diario solo funciona cuando el archivo del flujo está en la rama principal; mientras no lo esté, se lanza a mano.
