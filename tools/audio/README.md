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
