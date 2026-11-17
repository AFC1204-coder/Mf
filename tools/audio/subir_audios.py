"""Sube a Supabase Storage (bucket público `audiolibros`) los MP3 generados: `<id-de-la-lección>.mp3`.

La app reproduce `audiolibros/<id>.mp3` antes de recurrir a la voz en directo.
Necesita SUPABASE_SERVICE_KEY en `tools/video/.env` (clave «service_role» del panel de Supabase → Project Settings → API).
¡Es una clave con acceso total: NO se sube a git, no se pega en chats y no se pone nunca en la app!

    tools/video/.venv312/bin/python -m tools.audio.subir_audios            # sube lo que falte
    tools/video/.venv312/bin/python -m tools.audio.subir_audios --force    # vuelve a subirlo todo
    tools/video/.venv312/bin/python -m tools.audio.subir_audios --dry-run  # solo cuenta
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests

from tools.audio.generar_audiolibro import AUDIO_DIR, _load_env

BUCKET = "audiolibros"
REGISTRO = AUDIO_DIR / "output" / "subidos.json"


def _archivos() -> list[Path]:
    return sorted((AUDIO_DIR / "output").glob("*/upload_ready/*.mp3"))


def _subir(url: str, clave: str, ruta: Path) -> None:
    r = requests.post(
        f"{url}/storage/v1/object/{BUCKET}/{ruta.name}",
        headers={"apikey": clave, "Authorization": f"Bearer {clave}", "Content-Type": "audio/mpeg", "x-upsert": "true", "cache-control": "max-age=3600"},
        data=ruta.read_bytes(),
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"{r.status_code}: {r.text[:200]}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="Sube también los que ya constan como subidos.")
    ap.add_argument("--dry-run", action="store_true", help="Solo cuenta lo pendiente y su tamaño.")
    args = ap.parse_args(argv)

    _load_env()
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    clave = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    registro: dict[str, int] = json.loads(REGISTRO.read_text()) if REGISTRO.exists() else {}

    todos = _archivos()
    pendientes = [f for f in todos if args.force or registro.get(f.name) != f.stat().st_size]
    mb = sum(f.stat().st_size for f in pendientes) / 1048576
    print(f"{len(todos)} MP3 generados · {len(pendientes)} por subir ({mb:.0f} MB)")
    if args.dry_run or not pendientes:
        return 0
    if not url or not clave:
        print("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en tools/video/.env")
        return 1

    fallos = 0
    for n, f in enumerate(pendientes, start=1):
        try:
            _subir(url, clave, f)
            registro[f.name] = f.stat().st_size
            REGISTRO.write_text(json.dumps(registro))
            if n % 25 == 0 or n == len(pendientes):
                print(f"  ✓ {n}/{len(pendientes)}")
        except Exception as exc:
            fallos += 1
            print(f"  ✗ {f.name}: {exc}")
            if fallos >= 5:
                print("Demasiados errores seguidos; paro. (¿clave incorrecta, bucket lleno o sin conexión?)")
                return 1
    print(f"Listo. Errores: {fallos}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
