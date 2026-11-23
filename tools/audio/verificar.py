"""Comprueba los audios grabados contra el texto: los transcribe y mide cuántas palabras del texto se oyen, en orden.

Es la comprobación de extremo a extremo (opcional: necesita `pip install faster-whisper`, que descarga un modelo de
unos 500 MB la primera vez). Encontró lo que ninguna otra veía: locuciones que el servicio de voz devolvía cortadas.

    python -m tools.audio.verificar "Decisive" "Range"
    python -m tools.audio.verificar --piezas tools/video/output/decisive      # los vídeos de un libro

Sale con error si alguna lección no se reconoce en español o si falta un tramo de seis palabras o más, o si el parecido baja de 0,90. Un valor entre
0,93 y 1 es normal: el reconocedor escribe a su manera nombres propios, cifras y palabras en inglés.
"""

from __future__ import annotations

import argparse
import difflib
import re
import subprocess
import sys
import unicodedata

from tools.audio import generar_audiolibro as G
from tools.video import corpus as C

UMBRAL = 0.90
MUESTREO = 16000


def palabras(texto: str) -> list[str]:
    t = unicodedata.normalize("NFKD", texto.lower())
    return re.findall(r"[a-z0-9ñ]+", "".join(c for c in t if not unicodedata.combining(c)))


def parecido(esperado: list[str], oido: list[str]) -> float:
    return difflib.SequenceMatcher(None, esperado, oido, autojunk=False).ratio()


def faltan(esperado: list[str], oido: list[str], minimo: int = 6) -> list[str]:
    """Los tramos del texto, de `minimo` palabras o más, que no aparecen en lo oído."""
    sm = difflib.SequenceMatcher(None, esperado, oido, autojunk=False)
    return [" ".join(esperado[a:b]) for op, a, b, c, d in sm.get_opcodes() if op in ("delete", "replace") and (b - a) - (d - c) >= minimo]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.audio.verificar", description=__doc__.split("\n")[0])
    ap.add_argument("libros", nargs="*")
    ap.add_argument("--piezas", help="En lugar de audiolibros: una carpeta con vídeos de tools/video (busca cada script.json con su video.mp4) y comprueba que la voz dice todo el guion.")
    ap.add_argument("--modelo", default="small", help="Modelo de Whisper o ruta a uno ya descargado (por defecto: small).")
    args = ap.parse_args(argv)
    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except ImportError:
        print("Falta el reconocedor: pip install faster-whisper", file=sys.stderr)
        return 2
    modelo = WhisperModel(args.modelo, device="cpu", compute_type="int8")
    malas = 0

    def comprobar(nombre: str, medio, esperado: list[str]) -> None:
        nonlocal malas
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(medio), "-vn", "-f", "f32le", "-ac", "1", "-ar", str(MUESTREO), "-"], capture_output=True, check=True).stdout
        segmentos, info = modelo.transcribe(np.frombuffer(pcm, dtype=np.float32), language=None, beam_size=1)
        oido = palabras(" ".join(s.text for s in segmentos))
        r, huecos = parecido(esperado, oido), faltan(esperado, oido)
        mal = info.language != "es" or r < UMBRAL or bool(huecos)
        malas += mal
        print(f"{'✗' if mal else '✓'} {nombre}  {info.language}  {r:.3f}  {len(esperado)}→{len(oido)} palabras", flush=True)
        for h in huecos:
            print(f"      no se oye: «{h[:160]}»", flush=True)

    if args.piezas:
        import json
        from pathlib import Path

        for guion in sorted(Path(args.piezas).rglob("script.json")):
            video = guion.with_name("video.mp4")
            if video.is_file():
                escenas = json.loads(guion.read_text(encoding="utf-8")).get("scenes") or []
                comprobar(f"{guion.parent.name[:48]:48}", video, palabras(" ".join(str(e.get("narration") or "") for e in escenas)))
    for q in args.libros:
        book = C.load_book(q)
        for n, lec in enumerate(book.lessons, start=1):
            mp3 = G.SALIDA / f"{lec.id}.mp3"
            if not mp3.is_file():
                continue
            esperado = palabras(" ".join(t for p in G.partes_de_leccion(n, lec.titulo, lec.cuerpo, lec.autocorreccion) for t in p))
            comprobar(f"{book.titulo[:28]:28} {n:02d}", mp3, esperado)
    print(f"\n{'Todo se oye entero.' if not malas else f'{malas} lecciones por revisar.'}", flush=True)
    return 1 if malas else 0


if __name__ == "__main__":
    sys.exit(main())
