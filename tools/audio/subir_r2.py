"""Sube los audios grabados (`audio/*.mp3`) a un cubo público de Cloudflare R2 y apunta allí el índice de la web.

    CLOUDFLARE_API_TOKEN=… python -m tools.audio.subir_r2 --cuenta <id de cuenta> --cubo mentefria-audio --base https://pub-….r2.dev/

El token necesita el permiso «Workers R2 Storage: Edit». Solo sube lo que falta o ha cambiado (compara el tamaño con el
que hay en el cubo). Al terminar escribe `base` en `datos/audios.json`: desde ese momento la app pide los audios al
cubo y la carpeta `audio/` del repositorio deja de hacer falta.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import requests

from tools.audio import generar_audiolibro as G

API = "https://api.cloudflare.com/client/v4"


def _cabeceras() -> dict[str, str]:
    # En una sesión en la nube el token lo pone el proxy de red: basta un marcador.
    return {"Authorization": f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN') or 'proxy-injected'}"}


def en_cubo(cuenta: str, cubo: str) -> dict[str, int]:
    """Lo que ya hay en el cubo: nombre → tamaño."""
    hay: dict[str, int] = {}
    cursor = ""
    while True:
        r = requests.get(f"{API}/accounts/{cuenta}/r2/buckets/{cubo}/objects", headers=_cabeceras(), params={"per_page": 1000, **({"cursor": cursor} if cursor else {})}, timeout=60)
        r.raise_for_status()
        d = r.json()
        for o in d.get("result") or []:
            hay[str(o.get("key"))] = int(o.get("size") or 0)
        info = d.get("result_info") or {}
        cursor = str(info.get("cursor") or "")
        if not cursor or not info.get("is_truncated"):
            return hay


def subir(cuenta: str, cubo: str, nombre: str, datos: bytes, intentos: int = 4) -> None:
    for n in range(intentos):
        try:
            r = requests.put(f"{API}/accounts/{cuenta}/r2/buckets/{cubo}/objects/{nombre}", headers={**_cabeceras(), "Content-Type": "audio/mpeg"}, data=datos, timeout=120)
            if r.ok:
                return
            if r.status_code < 500 and r.status_code != 429:
                raise RuntimeError(f"{r.status_code}: {r.text[:200]}")
        except requests.RequestException:
            if n == intentos - 1:
                raise
        time.sleep(2 * (n + 1))
    raise RuntimeError(f"no se pudo subir {nombre}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.audio.subir_r2", description=__doc__.split("\n")[0])
    ap.add_argument("--cuenta", required=True, help="Id de la cuenta de Cloudflare.")
    ap.add_argument("--cubo", required=True)
    ap.add_argument("--base", required=True, help="Dirección pública del cubo, acabada en «/» (https://pub-….r2.dev/).")
    args = ap.parse_args(argv)
    indice = G.leer_indice()
    hay = en_cubo(args.cuenta, args.cubo)
    subidos = fallidos = 0
    for leccion_id in sorted(indice["lecciones"]):
        mp3 = G.SALIDA / f"{leccion_id}.mp3"
        if not mp3.is_file():
            if f"{leccion_id}.mp3" not in hay:
                print(f"  ✗ {leccion_id}: no está ni en audio/ ni en el cubo", flush=True)
                fallidos += 1
            continue
        if hay.get(mp3.name) == mp3.stat().st_size:
            continue
        try:
            subir(args.cuenta, args.cubo, mp3.name, mp3.read_bytes())
            subidos += 1
        except Exception as exc:  # noqa: BLE001 (un archivo que falla no detiene la subida)
            print(f"  ✗ {mp3.name}: {exc}", flush=True)
            fallidos += 1
    print(f"Subidos {subidos}, ya estaban {len(indice['lecciones']) - subidos - fallidos}, fallidos {fallidos}.", flush=True)
    if fallidos:
        print("El índice no se toca hasta que todo esté arriba: vuelve a lanzar la orden.", flush=True)
        return 1
    indice["base"] = args.base
    G.escribir_indice(indice)
    print(f"datos/audios.json apunta a {args.base}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
