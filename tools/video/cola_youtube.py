"""Qué falta por subir a YouTube, sin renderizar nada: de los libros de `cola_youtube.txt`, las piezas elegidas sin enlace.

    python -m tools.video.cola_youtube --max 2     # los libros (y sus piezas) que cubren las próximas 2 subidas

El flujo de GitHub Actions usa esto para renderizar solo esos libros y subir las piezas de ahí.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import cli as C
from . import compartir as K
from . import publicados as P
from .corpus import load_book

RAIZ = Path(__file__).resolve().parent
COLA = RAIZ / "cola_youtube.txt"
CSV = RAIZ / "publicados.csv"


def libros_en_cola(ruta: Path = COLA) -> list[str]:
    if not ruta.is_file():
        return []
    return [l.strip() for l in ruta.read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#")]


def pendientes(max_piezas: int, consulta=load_book, cola: list[str] | None = None, filas: list[dict[str, str]] | None = None) -> list[tuple[str, list[str]]]:
    """[(título del libro, [claves de pieza pendientes])] hasta cubrir `max_piezas`. Pendiente = elegida y sin enlace en el registro."""
    ya = {(f["libro"], f["pieza"]) for f in (P.leer_csv(CSV) if filas is None else filas) if f["youtube"]}
    salida: list[tuple[str, list[str]]] = []
    falta = max_piezas
    for titulo in libros_en_cola() if cola is None else cola:
        if falta <= 0:
            break
        book = consulta(titulo)
        plan = K.plan_libro(book, tuple(C.SELECCION_TIPOS.split(",")))
        claves = [p.key for p in C.piezas_seleccionadas(book, plan.piezas) if (book.slug, p.key) not in ya]
        if claves:
            salida.append((book.titulo, claves[:falta]))
            falta -= len(claves[:falta])
    return salida


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.video.cola_youtube", description=__doc__.split("\n")[0])
    ap.add_argument("--max", type=int, default=2, help="Cuántas piezas como mucho (por defecto 2).")
    ap.add_argument("--solo-libros", action="store_true", help="Imprime solo el título de cada libro, una línea por libro.")
    args = ap.parse_args(argv)
    for titulo, claves in pendientes(args.max):
        print(titulo if args.solo_libros else f"{titulo}: {', '.join(claves)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
