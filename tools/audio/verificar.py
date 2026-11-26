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


TRAMO_S, SOLAPE_S = 30, 3  # la segunda escucha va por tramos de 30 s que se pisan 3 s
INGLES = re.compile(r"\b(the|of|and|is|to|that|in|with|for|not|you|it|are|was|this|have|how|by)\b")
VOZ_MIN = 0.5  # parte del tramo que debe tener sonido para decir que ahí se habla


def leer_srt(texto: str) -> list[tuple[float, float, list[str]]]:
    """Bloques de subtítulos: (inicio, fin, palabras)."""

    def seg(t: str) -> float:
        h, m, s = t.replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)

    return [(seg(a), seg(b), palabras(c)) for a, b, c in re.findall(r"(\d\d:\d\d:\d\d,\d+) --> (\d\d:\d\d:\d\d,\d+)\n(.*?)(?:\n\n|\Z)", texto, re.S)]


def tramo_de(hueco: str, srt: list[tuple[float, float, list[str]]]) -> tuple[float, float] | None:
    """Dónde cae en el vídeo un tramo de texto: los subtítulos cuyas palabras están, casi todas y seguidas, en él."""
    dentro = [(a, b) for a, b, p in srt if p and (" ".join(p) in hueco or sum(1 for i in range(len(p) - 2) if " ".join(p[i : i + 3]) in hueco) >= max(1, (len(p) - 2) * 0.6))]
    return (min(a for a, _ in dentro), max(b for _, b in dentro)) if dentro else None


def con_voz(audio, tramo: tuple[float, float] | None) -> bool:
    """¿Suena algo durante al menos la mitad de ese tramo? (ventanas de 50 ms por encima de un umbral bajo)"""
    if tramo is None:
        return False
    import numpy as np

    trozo = audio[int(tramo[0] * MUESTREO) : int(tramo[1] * MUESTREO)]
    v = MUESTREO // 20
    if len(trozo) < v * 4:
        return False
    energia = np.sqrt((trozo[: len(trozo) // v * v].reshape(-1, v) ** 2).mean(axis=1))
    return float((energia > 0.01).mean()) >= VOZ_MIN


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

    def comprobar(nombre: str, medio, esperado: list[str], srt=None) -> None:
        nonlocal malas
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(medio), "-vn", "-f", "f32le", "-ac", "1", "-ar", str(MUESTREO), "-"], capture_output=True, check=True).stdout
        audio = np.frombuffer(pcm, dtype=np.float32)
        segmentos, info = modelo.transcribe(audio, language=None, beam_size=1)
        oido = palabras(" ".join(s.text for s in segmentos))
        r, huecos = parecido(esperado, oido), faltan(esperado, oido)
        avisos: list[str] = []
        if huecos and info.language == "es":
            # Segunda escucha, por tramos: de un tirón el reconocedor se salta a veces una frase entera (sobre todo
            # tras un silencio o con inglés mezclado) que sí está dicha.
            oido2: list[str] = []
            for ini in range(0, len(audio), MUESTREO * TRAMO_S):
                tramo, _ = modelo.transcribe(audio[ini : ini + MUESTREO * (TRAMO_S + SOLAPE_S)], language="es", beam_size=5)
                oido2 += palabras(" ".join(s.text for s in tramo))
            aun = set(faltan(esperado, oido2))
            huecos = [h for h in huecos if any(h in a or a in h for a in aun)]
            # Tercera: lo que sigue sin reconocerse y lleva inglés (un título, un nombre) no es un corte si en su
            # tramo del vídeo hay voz. Queda como aviso, para oírlo; con texto solo en español sigue siendo fallo.
            if srt is not None and huecos:
                # …y cada tramo que sigue sin oírse, escuchado él solo (un título en inglés justo antes despista al reconocedor).
                def se_oye(h: str) -> bool:
                    t = tramo_de(h, srt)
                    if t is None:
                        return False
                    solo, _ = modelo.transcribe(audio[int(max(0.0, t[0] - 0.3) * MUESTREO) : int((t[1] + 0.3) * MUESTREO)], language="es", beam_size=5)
                    return not faltan(palabras(h), palabras(" ".join(x.text for x in solo)))

                huecos = [h for h in huecos if not se_oye(h)]
            if srt is not None:
                dudosos = [h for h in huecos if INGLES.search(h) and con_voz(audio, tramo_de(h, srt))]
                avisos, huecos = dudosos, [h for h in huecos if h not in dudosos]
            if not huecos:
                r = max(r, UMBRAL)
        mal = info.language != "es" or r < UMBRAL or bool(huecos)
        malas += mal
        print(f"{'✗' if mal else '✓'} {nombre}  {info.language}  {r:.3f}  {len(esperado)}→{len(oido)} palabras", flush=True)
        for h in huecos:
            print(f"      no se oye: «{h[:160]}»", flush=True)
        for h in avisos:
            print(f"      aviso, hay voz pero no se reconoce (lleva inglés): «{h[:120]}»", flush=True)

    if args.piezas:
        import json
        from pathlib import Path

        for guion in sorted(Path(args.piezas).rglob("script.json")):
            video = guion.with_name("video.mp4")
            if video.is_file():
                escenas = json.loads(guion.read_text(encoding="utf-8")).get("scenes") or []
                subt = guion.with_name("video.srt")
                comprobar(f"{guion.parent.name[:48]:48}", video, palabras(" ".join(str(e.get("narration") or "") for e in escenas)), srt=leer_srt(subt.read_text(encoding="utf-8")) if subt.is_file() else None)
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
