#!/usr/bin/env bash
# Flujo completo en el Mac: entorno -> generar todos los libros con em_santa -> dry-run -> (confirmación) -> subir.
# Uso:   tools/audio/flujo_mac.sh                      # todos los libros públicos, pregunta antes de subir
#        tools/audio/flujo_mac.sh --sin-subir           # se detiene tras el dry-run
#        tools/audio/flujo_mac.sh --bitrate 32k         # MP3 más ligeros (por defecto 40k)
#        tools/audio/flujo_mac.sh --libros "Fluir" "Maestría"   # solo esos libros (título o UUID)
# Se pueden combinar. Un bitrate nuevo solo afecta a MP3 aún no generados (los existentes se saltan).
# Es reanudable: salta lo ya generado. Nunca imprime ni escribe SUPABASE_SERVICE_KEY.
set -euo pipefail

VOZ="em_santa"
SOLO_GENERAR=0
BITRATE="40k"
LIBROS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --sin-subir) SOLO_GENERAR=1; shift ;;
    --bitrate) BITRATE="${2:?falta el valor de --bitrate}"; shift 2 ;;
    --libros) shift; while [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; do LIBROS+=("$1"); shift; done ;;
    *) echo "Opción desconocida: $1"; exit 2 ;;
  esac
done

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
VENV="tools/video/.venv312"
PY="$VENV/bin/python"
ENV="tools/video/.env"

[ "$(uname -s)" = "Darwin" ] || echo "Aviso: pensado para macOS; en otro sistema instala espeak-ng y Python 3.12 a mano."

echo "== 1/5 Entorno =="
if command -v brew >/dev/null 2>&1; then
  brew list espeak-ng >/dev/null 2>&1 || brew install espeak-ng
  brew list python@3.12 >/dev/null 2>&1 || brew install python@3.12
  PY312="$(brew --prefix python@3.12)/bin/python3.12"
else
  PY312="$(command -v python3.12 || true)"
fi
[ -x "${PY312:-}" ] || { echo "No encuentro python3.12 (Kokoro no funciona con 3.13+)."; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { command -v brew >/dev/null 2>&1 && brew install ffmpeg || { echo "Falta ffmpeg."; exit 1; }; }
[ -d "$VENV" ] || "$PY312" -m venv "$VENV"
"$VENV/bin/pip" install -q -r tools/video/requirements.txt -r tools/audio/requirements-kokoro.txt

echo "== 2/5 Claves públicas en $ENV =="
touch "$ENV"
if ! grep -q '^SUPABASE_URL=' "$ENV"; then
  grep -o "const SB_URL = '[^']*'" app.js | sed "s/.*'\(.*\)'/SUPABASE_URL=\1/" >> "$ENV"
fi
if ! grep -q '^SUPABASE_ANON_KEY=' "$ENV"; then
  grep -o "const SB_KEY = '[^']*'" app.js | sed "s/.*'\(.*\)'/SUPABASE_ANON_KEY=\1/" >> "$ENV"
fi
grep -q '^SUPABASE_URL=.\+' "$ENV" && grep -q '^SUPABASE_ANON_KEY=.\+' "$ENV" \
  || { echo "No pude fijar SUPABASE_URL / SUPABASE_ANON_KEY."; exit 1; }

echo "== 3/5 Generar con $VOZ a $BITRATE (puede tardar; reanudable) =="
INICIO=$(date +%s)
# Si un libro falla no abortamos: se informa y se sigue; relanzar el script retoma lo pendiente.
if [ "${#LIBROS[@]}" -gt 0 ]; then
  for L in "${LIBROS[@]}"; do
    echo; echo "=== $L ==="
    "$PY" -m tools.audio.generar_audiolibro "$L" --engine kokoro --voice "$VOZ" --bitrate "$BITRATE" || \
      echo "Aviso: falló «$L» (revisa arriba)."
  done
else
  "$PY" -m tools.audio.generar_audiolibro --all --engine kokoro --voice "$VOZ" --bitrate "$BITRATE" || \
    echo "Aviso: la generación terminó con errores (revisa arriba). Puedes relanzar el script."
fi
echo "Generación: $(( ($(date +%s) - INICIO) / 60 )) min"

echo "== 4/5 Dry-run (no sube nada) =="
"$PY" -m tools.audio.subir_audios --dry-run

[ "$SOLO_GENERAR" = "1" ] && { echo "Parado antes de subir (--sin-subir)."; exit 0; }

echo "== 5/5 Subida a Supabase =="
if ! grep -q '^SUPABASE_SERVICE_KEY=.\+' "$ENV"; then
  echo "Falta SUPABASE_SERVICE_KEY en $ENV."
  echo "Añádela TÚ a mano (Supabase → Project Settings → API → service_role). Nunca a git ni al chat."
  echo "Luego ejecuta:  $PY -m tools.audio.subir_audios"
  exit 0
fi
echo "Antes de subir mira Supabase → Settings → Usage → Storage (los planes gratuitos tienen poco espacio)."
read -r -p "¿Subir ahora al bucket 'audiolibros'? [escribe SI para continuar] " R
[ "$R" = "SI" ] || { echo "No se sube nada."; exit 0; }
"$PY" -m tools.audio.subir_audios
echo "Hecho. Si regeneraste MP3 ya escuchados, sube la versión de caché de audio en app.js (-v6 -> -v7)."
