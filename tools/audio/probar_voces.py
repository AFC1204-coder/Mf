"""Prueba varias voces sobre un mismo fragmento real de una lección, para elegir de oído.

Uso (desde la raíz del repositorio, con el entorno de tools/video ya instalado):

    tools/video/.venv/bin/python -m tools.audio.probar_voces "La felicidad no se persigue directamente"

Lee un trozo del cuerpo + «El giro» (la autocorrección), como hará el audiolibro, y genera un MP3 por voz en
`tools/audio/output/muestras/<lección>/`. Las voces de Gemini solo se prueban si hay GEMINI_API_KEY en
`tools/video/.env`; las de Edge no necesitan clave.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import quote

from tools.audio.generar_audiolibro import AUDIO_DIR, _clean_for_tts, _load_env, _sb_get, _slugify
from tools.video.tts.edge_tts_engine import EdgeTTSEngine
from tools.video.tts.gemini_tts import GeminiTTSEngine

VOCES_EDGE = ["es-ES-AlvaroNeural", "es-ES-ElviraNeural", "es-ES-XimenaNeural"]
VOCES_GEMINI = ["Charon", "Aoede", "Fenrir", "Kore"]


def _hasta_frase(texto: str, max_chars: int) -> str:
    """Recorta en el final de una frase sin pasar de max_chars."""
    if len(texto) <= max_chars:
        return texto
    corte = texto[:max_chars]
    i = max(corte.rfind(". "), corte.rfind("? "), corte.rfind("! "))
    return corte[: i + 1] if i > 80 else corte


def texto_de_muestra(leccion: dict, chars_cuerpo: int = 650, chars_giro: int = 260) -> str:
    """Título + principio del cuerpo + «El giro» con el principio de la autocorrección."""
    partes = [f"{leccion['titulo']}."]
    cuerpo = _clean_for_tts(leccion.get("cuerpo") or "")
    if cuerpo:
        partes.append(_hasta_frase(cuerpo, chars_cuerpo))
    giro = _clean_for_tts(leccion.get("autocorreccion") or "")
    if giro:
        partes.append("El giro. " + _hasta_frase(giro, chars_giro))
    return " ".join(partes)


def _buscar_leccion(q: str) -> dict:
    campos = "id,titulo,cuerpo,autocorreccion"
    if re.match(r"^[0-9a-fA-F-]{36}$", q):
        r = _sb_get(f"lecciones?id=eq.{q}&select={campos}&limit=1")
    else:
        r = _sb_get(f"lecciones?titulo=ilike.{quote(f'*{q}*', safe='')}&activa=eq.true&select={campos}&limit=1")
    if not r:
        raise LookupError(f"Lección no encontrada: {q!r}")
    return r[0]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("leccion", help="Título (exacto o parcial) o UUID de una lección activa.")
    ap.add_argument("--solo", choices=["edge", "gemini"], help="Probar solo un motor.")
    args = ap.parse_args(argv)

    _load_env()
    lec = _buscar_leccion(args.leccion.strip())
    texto = texto_de_muestra(lec)
    out = AUDIO_DIR / "output" / "muestras" / _slugify(lec["titulo"])
    out.mkdir(parents=True, exist_ok=True)
    print(f"Lección: {lec['titulo']}\nTexto de muestra: {len(texto)} caracteres\nSalida: {out}\n")

    motores: list[tuple[str, object, list[str]]] = []
    if args.solo != "gemini":
        motores.append(("edge", EdgeTTSEngine(), VOCES_EDGE))
    if args.solo != "edge":
        g = GeminiTTSEngine()
        if g.api_key:
            motores.append(("gemini", g, VOCES_GEMINI))
        else:
            print("(Sin GEMINI_API_KEY en tools/video/.env: se omiten las voces de Gemini.)\n")

    hechas = 0
    for nombre, motor, voces in motores:
        for v in voces:
            destino = out / f"{nombre}_{v}.mp3"
            try:
                res = motor.synthesize(texto, destino, voice=v)
                print(f"✓ {nombre:6} {v:22} {res.duration_s:5.1f} s → {destino.name}")
                hechas += 1
            except Exception as exc:  # una voz que falle no debe parar las demás
                print(f"✗ {nombre:6} {v:22} {str(exc)[:140]}")
    print(f"\n{hechas} muestras en {out}. Escúchalas y elige: la voz elegida se pasa con --voice al generar el audiolibro.")
    return 0 if hechas else 1


if __name__ == "__main__":
    sys.exit(main())
