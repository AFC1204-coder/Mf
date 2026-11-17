# Generador de audiolibros — Mente Fría

Convierte todas las lecciones activas de un libro de Supabase en MP3 hablados ligeros (`64 kbps` mono) con lista `.m3u` y `manifest.json`, reutilizando el entorno y los motores TTS de `tools/video/`.

## Uso

```bash
# Rápido y 100 % gratis (sin límite diario) con Edge TTS:
tools/video/.venv/bin/python -m tools.audio.generar_audiolibro "Fluir" --engine edge --voice es-ES-AlvaroNeural

# Uniendo también todas las lecciones en un único audiolibro_completo.mp3:
tools/video/.venv/bin/python -m tools.audio.generar_audiolibro "Fluir" --engine edge --voice es-ES-AlvaroNeural --merge

# Con Gemini TTS (Charon) y respaldo automático a Edge si salta la cuota:
tools/video/.venv/bin/python -m tools.audio.generar_audiolibro "Fluir" --engine auto --voice Charon
```

Salida en `tools/audio/output/<libro>/`:
- `01_<uuid>.mp3`, `02_<uuid>.mp3`, …
- `audiolibro.m3u` (lista de reproducción ordenada)
- `manifest.json` (duración, tamaño en bytes, motor y voz por lección)

## Qué se lee
Título, cuerpo y, al final, **«El giro»** (la autocorrección de la lección: críticas y límites). Es el mismo texto que lee la app en directo. Si ya tenías MP3 generados antes de este cambio, regenera con `--force` y vuelve a subirlos al bucket `audiolibros`.


## Elegir la voz de oído
```bash
# Genera un MP3 por voz sobre un trozo real de una lección (cuerpo + «El giro»):
tools/video/.venv/bin/python -m tools.audio.probar_voces "La felicidad no se persigue directamente"
# Solo las gratuitas de Edge (no necesitan clave):  añade  --solo edge
```
Deja las muestras en `tools/audio/output/muestras/<lección>/`. Las de Gemini (Charon, Aoede, Fenrir, Kore) solo salen si `tools/video/.env` tiene `GEMINI_API_KEY`.

## Kokoro (voz local gratuita, sin clave ni límite)
Voces en español: `em_santa`, `em_alex` (masculinas) y `ef_dora` (femenina). Licencia Apache 2.0.
```bash
brew install espeak-ng python@3.12          # Kokoro NO funciona con Python 3.13+ (solo 3.10–3.12)
/opt/homebrew/bin/python3.12 -m venv tools/video/.venv312
tools/video/.venv312/bin/pip install -r tools/video/requirements.txt -r tools/audio/requirements-kokoro.txt   # pesado: incluye PyTorch
tools/video/.venv312/bin/python -m tools.audio.probar_voces "La felicidad no se persigue directamente" --solo kokoro
# y para generar un libro con esa voz:
tools/video/.venv312/bin/python -m tools.audio.generar_audiolibro "Fluir" --engine kokoro --voice em_santa
```
La primera vez descarga el modelo (~330 MB). `--speed` no existe: la velocidad se ajusta con `KOKORO_SPEED` en `tools/video/.env` (por defecto 0,95).


## Flujo completo: voz em_santa en todas las lecciones
1. **Generar** (en el Mac; se puede interrumpir y reanudar, salta lo ya hecho):
   ```bash
   tools/video/.venv312/bin/python -m tools.audio.generar_audiolibro "Fluir" --engine kokoro --voice em_santa   # un libro de prueba
   tools/video/.venv312/bin/python -m tools.audio.generar_audiolibro --all --engine kokoro --voice em_santa     # todos los libros públicos
   ```
   Deja `output/<libro>/upload_ready/<id-de-la-lección>.mp3` (MP3 mono, 40 kbps por defecto; `--bitrate` lo cambia).
2. **Subir** al bucket público `audiolibros` (la app los reproduce antes que la voz en directo):
   ```bash
   tools/video/.venv312/bin/python -m tools.audio.subir_audios --dry-run   # cuántos y cuánto pesan
   tools/video/.venv312/bin/python -m tools.audio.subir_audios
   ```
   Necesita `SUPABASE_SERVICE_KEY` en `tools/video/.env` (Project Settings → API → «service_role»). Es una clave con acceso total: nunca a git, ni al chat, ni a la app.
3. **Espacio:** mira Supabase → Settings → Usage → Storage antes de subir todo; los planes gratuitos tienen un límite pequeño de almacenamiento.
4. Si regeneras MP3 de lecciones que ya se escucharon en un móvil, sube la versión de caché de audio en `app.js` (`-v6` → `-v7`) para que no reproduzca la copia antigua.
