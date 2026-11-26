"""Sube a YouTube las piezas ya renderizadas que aún no tienen enlace y lo apunta en `publicados.csv`.

    python -m tools.video.subir_youtube --simular                    # qué subiría, sin tocar nada
    python -m tools.video.subir_youtube --libro decisive --max 4     # sube hasta 4 piezas de ese libro

Credenciales (del dueño del canal; nunca en el repositorio): `YT_CLIENT_ID`, `YT_CLIENT_SECRET` y `YT_REFRESH_TOKEN`,
con permiso `youtube.upload`. En GitHub Actions van como secretos del repositorio.

Por defecto los vídeos quedan **privados**: se revisan en YouTube Studio y se publican allí, o se pide otra cosa con
`--privacidad`. El título y la descripción son los de `publicacion.json` de cada pieza (texto literal del corpus).
Cada subida se apunta al momento, así que un corte a mitad no repite las ya hechas. Después:
`python -m tools.video.cli publicados` lleva los enlaces al índice que lee la web.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import requests

from . import publicados as P

RAIZ = Path(__file__).resolve().parent
OUTPUT = RAIZ / "output"
CSV = RAIZ / "publicados.csv"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SUBIDA_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
CATEGORIA_EDUCACION = "27"
CORTO_MAX_S = 180  # hasta aquí YouTube lo trata como Short (vertical); más largo, es un vídeo normal
TITULO_MAX = 100  # límite de YouTube
PRIVACIDADES = ("private", "unlisted", "public")


def metadatos(publicacion: dict[str, Any], duracion_s: float, privacidad: str) -> dict[str, Any]:
    """El cuerpo de la subida a partir de `publicacion.json`. Solo recoloca lo que ya está escrito."""
    yt = publicacion.get("youtube_shorts") or publicacion.get("youtube") or {}
    titulo = str(yt.get("titulo") or "").strip()
    descripcion = str(yt.get("descripcion") or "").strip()
    if duracion_s > CORTO_MAX_S:  # no es un Short: la marca sobra
        titulo = titulo.replace("#Shorts", "").strip()
    if not titulo:
        raise ValueError("la pieza no tiene título de publicación")
    etiquetas = [t.lstrip("#") for t in descripcion.split() if t.startswith("#") and len(t) > 1]
    return {
        "snippet": {"title": titulo[:TITULO_MAX], "description": descripcion, "tags": etiquetas, "categoryId": CATEGORIA_EDUCACION, "defaultLanguage": "es", "defaultAudioLanguage": "es"},
        "status": {"privacyStatus": privacidad, "selfDeclaredMadeForKids": False},
    }


def pendientes(filas: list[dict[str, str]], hechas: dict[tuple[str, str], dict[str, Any]], libro: str | None = None, tipos: set[str] | None = None) -> list[dict[str, str]]:
    """Filas del registro con vídeo renderizado y sin enlace, en el orden del registro."""
    return [f for f in filas if not f.get("youtube") and (f["libro"], f["pieza"]) in hechas and (not libro or libro in f["libro"]) and (not tipos or f["tipo"] in tipos)]


def token_de_acceso() -> str:
    faltan = [v for v in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN") if not os.getenv(v)]
    if faltan:
        raise SystemExit(f"Faltan credenciales: {', '.join(faltan)} (ver tools/video/LOTE.md, «Subir a YouTube»).")
    r = requests.post(TOKEN_URL, data={"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"], "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}, timeout=60)
    if not r.ok:
        raise SystemExit(f"YouTube no aceptó las credenciales ({r.status_code}): {r.text[:200]}")
    return str(r.json()["access_token"])


def subir(video: Path, cuerpo: dict[str, Any], token: str) -> str:
    """Subida reanudable en dos pasos. Devuelve el id del vídeo."""
    cab = {"Authorization": f"Bearer {token}"}
    r = requests.post(SUBIDA_URL, params={"uploadType": "resumable", "part": "snippet,status"}, headers={**cab, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(video.stat().st_size)}, data=json.dumps(cuerpo).encode("utf-8"), timeout=60)
    if not r.ok or "Location" not in r.headers:
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
    with video.open("rb") as fh:
        r = requests.put(r.headers["Location"], headers={**cab, "Content-Type": "video/mp4"}, data=fh, timeout=1800)
    if not r.ok:
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
    vid = str(r.json().get("id") or "")
    if not P.ID_YT.fullmatch(vid):
        raise RuntimeError(f"respuesta sin id de vídeo: {r.text[:200]}")
    return vid


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.video.subir_youtube", description=__doc__.split("\n")[0])
    ap.add_argument("--libro", help="Solo las piezas de este libro (parte de su carpeta, p. ej. «decisive»).")
    ap.add_argument("--tipos", help="Solo estos tipos de pieza, separados por comas (p. ej. presentacion,fondo).")
    ap.add_argument("--max", type=int, default=6, help="Cuántas subir como mucho en esta ejecución (por defecto 6).")
    ap.add_argument("--privacidad", choices=PRIVACIDADES, default="private", help="Cómo quedan en YouTube (por defecto, privados).")
    ap.add_argument("--aspecto", default="9:16")
    ap.add_argument("--simular", action="store_true", help="Lista lo que subiría, con su título, y no sube nada.")
    args = ap.parse_args(argv)
    carpeta = args.aspecto.replace(":", "x")
    hechas = P.piezas_renderizadas(OUTPUT, carpeta)
    filas, _ = P.sincronizar(P.leer_csv(CSV), hechas)
    cola = pendientes(filas, hechas, args.libro, set(args.tipos.split(",")) if args.tipos else None)[: max(0, args.max)]
    if not cola:
        print("Nada que subir: no hay piezas renderizadas sin enlace con ese filtro.")
        return 0
    token = "" if args.simular else token_de_acceso()
    fallos = 0
    for f in cola:
        base = OUTPUT / f["libro"] / "compartir" / carpeta / f["pieza"]
        try:
            cuerpo = metadatos(json.loads((base / "publicacion.json").read_text(encoding="utf-8")), hechas[(f["libro"], f["pieza"])]["duracion_s"], args.privacidad)
            if args.simular:
                print(f"  · {f['libro']}/{f['pieza']} → «{cuerpo['snippet']['title']}» ({args.privacidad})")
                continue
            f["youtube"] = subir(base / "video.mp4", cuerpo, token)
            P.escribir_csv(CSV, filas)  # cada subida se apunta al momento
            print(f"  ✓ {f['libro']}/{f['pieza']} → https://youtu.be/{f['youtube']}", flush=True)
        except Exception as exc:  # noqa: BLE001 (una pieza que falla no detiene la tanda)
            fallos += 1
            print(f"  ✗ {f['libro']}/{f['pieza']}: {exc}", flush=True)
    if not args.simular:
        print("Ahora: python -m tools.video.cli publicados")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
