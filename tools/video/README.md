# Generador de vídeos cortos (9:16) — Mente Fría

Herramienta independiente en `tools/video/` para convertir cualquier lección de Supabase en un vídeo vertical corto (`1080×1920`, `60–90 s`) en español, con la estética tipográfica y cromática de Mente Fría, infografía/esquema integrado cuando existe y subtítulos sincronizados con la voz.

---

## Requisitos previos

- **Python 3.10+**
- **ffmpeg** y **ffprobe** en el `PATH` (`brew install ffmpeg` en macOS)
- *(Opcional)* **Google Chrome** para rasterizar infografías SVG inline (`data:image/svg+xml`).

---

## Instalación (una sola vez)

Desde la raíz del repositorio:

```bash
python3 -m venv tools/video/.venv
tools/video/.venv/bin/pip install -r tools/video/requirements.txt
cp tools/video/.env.example tools/video/.env
```

Edita `tools/video/.env` (está en `.gitignore` y nunca se sube al repositorio):

- `SUPABASE_URL` y `SUPABASE_ANON_KEY`: URL y clave pública de lectura de tu proyecto Supabase.
- `GEMINI_API_KEY`: *(opcional)* tu clave gratuita de Google AI Studio para usar **Gemini TTS** (`gemini-2.5-flash-preview-tts` o `gemini-2.5-pro-preview-tts`) y redacción del guion con Gemini.
- Si `GEMINI_API_KEY` está vacía o se agota la cuota, la herramienta cambia automáticamente a **Edge TTS** (100 % gratis y sin clave, con voces `es-ES-AlvaroNeural` / `es-ES-ElviraNeural`) y al generador de guiones local.

---

## Uso rápido

Puedes pasar el **título** (exacto o parcial) o el **UUID** de cualquier lección activa:

```bash
# 1) Probar 3 voces distintas en la Escena 1 antes de renderizar
tools/video/.venv/bin/python -m tools.video.cli "La felicidad no se persigue directamente" --sample-voices

# 2) Generar el vídeo completo eligiendo la voz
tools/video/.venv/bin/python -m tools.video.cli "La felicidad no se persigue directamente" --voice es-ES-AlvaroNeural

# 3) Por UUID de Supabase
tools/video/.venv/bin/python -m tools.video.cli 8eac2573-0126-4f7a-b531-b40567af424b
```

### Opciones útiles

| Opción | Descripción |
|---|---|
| `--sample-voices` | Genera 3 muestras `.mp3` de la Escena 1 en `output/<slug>/samples/` para comparar voces. |
| `--engine {auto,gemini,edge}` | Fuerza un motor concreto (`auto` intenta Gemini TTS y cae a Edge TTS si hay error de cuota). |
| `--gemini-model` | `gemini-2.5-flash-preview-tts` (por defecto) o `gemini-2.5-pro-preview-tts`. |
| `--voice <nombre>` | Ej. `Aoede`, `Charon`, `Fenrir` (Gemini) o `es-ES-AlvaroNeural`, `es-ES-ElviraNeural` (Edge). |
| `--script-only` | Solo genera `guion.md` y `script.json` sin locución ni vídeo. |
| `--no-gemini-script` | Genera el guion localmente sin llamar a Gemini. |
| `--out-dir <ruta>` | Carpeta de salida personalizada. |

---

## Salida generada

En `tools/video/output/<slug-de-la-leccion>/`:

- `video.mp4` — Vídeo vertical H.264/AAC `1080×1920`, `30 fps`, con subtítulos `.ass` quemados y sincronizados.
- `guion.md` — Guion estructurado en 5–7 escenas (gancho, 3–4 ideas clave y cierre práctico).
- `script.json` — Versión estructurada del guion.

---

## Arquitectura modular

- `supabase_client.py` — Lectura de `lecciones`, `libros` y `datos/diagramas.json`.
- `scriptwriter.py` — Guion de 5–7 escenas (60–90 s) + exportación a `.md`.
- `tts/` — Interfaz intercambiable (`TTSEngine`) con `gemini_tts.py`, `edge_tts_engine.py` y `AutoTTSEngine`.
- `infographic.py` — Conversión de SVG, imágenes o diagramas JSON a PNG.
- `renderer.py` — Tarjetas con la paleta y tipografía de `styles.css` (`#080808`, `#c9a84c`, `#ede8df`, `Playfair Display`, `Source Serif 4`, `Outfit`) + ensamblado con `ffmpeg`.
