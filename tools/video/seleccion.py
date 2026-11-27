"""Qué lecciones de cada libro merecen vídeo: una propuesta razonada que el dueño puede corregir.

El corpus no dice qué lección es «más importante», así que la propuesta se apoya en dos cosas que sí están escritas:

1. **El mapa del libro** (`datos/mapas.json`): las ideas centrales que la propia página destaca. La lección que mejor
   corresponde a cada idea del mapa sube.
2. **El material de la lección**: cuántas piezas distintas puede dar (idea, pregunta, práctica, caso, a fondo) y si su
   esquema cabe entero en pantalla. Una lección sin idea que contar no entra.

No juzga el contenido ni lo toca: solo ordena. El resultado va a `tools/video/seleccion.csv`, con una columna
`decision` que manda sobre la propuesta («sí» o «no»; vacía = lo propuesto) y que se conserva al regenerar.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from . import compartir as K
from . import text as T
from .corpus import Book, Lesson

CSV = Path(__file__).resolve().parent / "seleccion.csv"
COLUMNAS = ["libro_id", "libro", "n", "leccion_id", "leccion", "puntos", "motivos", "propuesta", "decision", "nota"]  # `decision` y `nota` se escriben a mano y se conservan

PUNTOS_MAPA = 3  # una idea del mapa del libro corresponde a esta lección
SOLAPE_MIN = 2  # parecido mínimo para dar por buena esa correspondencia (una palabra del título vale 2; una de la idea, 1)
_VACIAS = set("para como pero sino este esta estos estas esto entre sobre desde hasta cuando donde porque tiene tienen hace hacen puede pueden cada todo toda todos todas otro otra otros otras mismo misma solo algo nada mucho poco bien mejor peor menos antes despues tras segun libro leccion idea ideas".split())


def cuantas(n_lecciones: int) -> int:
    """Lecciones con vídeo por libro: la mitad corta de un libro pequeño, y nunca más de cuatro."""
    return 2 if n_lecciones <= 4 else 3 if n_lecciones <= 9 else 4


def _raices(texto: str) -> set[str]:
    return {p[:6] for p in re.findall(r"[a-zñ]+", T.norm(texto)) if len(p) > 3 and p not in _VACIAS}


@dataclass
class Fila:
    n: int
    leccion: Lesson
    puntos: int = 0
    motivos: list[str] = field(default_factory=list)
    posible: bool = True
    propuesta: bool = False


def del_mapa(book: Book) -> dict[int, list[str]]:
    """Índice de lección → etiquetas del mapa que le corresponden (cada idea del mapa, a su lección más parecida)."""
    nodos = (book.mapa or {}).get("nodos") or []
    de: dict[int, list[str]] = {}
    titulos = [_raices(le.titulo) for le in book.lessons]
    ideas = [_raices(le.idea_clave) for le in book.lessons]
    for nodo in nodos:
        r = _raices(f"{nodo.get('etiqueta') or ''} {nodo.get('texto') or ''}")
        solapes = [2 * len(r & t) + len(r & (i - t)) for t, i in zip(titulos, ideas)]  # el título pesa el doble que la idea
        mejor = max(range(len(solapes)), key=lambda i: (solapes[i], -i), default=None)
        if mejor is not None and solapes[mejor] >= SOLAPE_MIN:
            de.setdefault(mejor, []).append(str(nodo.get("etiqueta") or "").strip())
    return de


def puntuar(book: Book) -> list[Fila]:
    mapa = del_mapa(book)
    filas: list[Fila] = []
    for i, lesson in enumerate(book.lessons):
        f = Fila(i + 1, lesson)
        idea = K.pieza_idea(book, i)
        fondo = K.pieza_fondo(book, i)
        f.posible = bool(idea or fondo)
        for etiqueta in mapa.get(i, []):
            f.puntos += PUNTOS_MAPA
            f.motivos.append(f"el mapa del libro destaca «{etiqueta}»")
        dan = [nombre for nombre, p in (("idea", idea), ("pregunta", K.pieza_pregunta(book, i)), ("práctica", K.pieza_practica(book, i)), ("caso", K.pieza_caso(book, i)), ("a fondo", fondo)) if p]
        f.puntos += len(dan)
        if dan:
            f.motivos.append("da " + ", ".join(dan))
        entero = any(s.kind == "c-figura" and K.figura_entera(s.view) for p in (idea, fondo) if p for s in p.scenes)
        if entero:
            f.puntos += 1
            f.motivos.append("su esquema se ve entero")
        if not f.posible:
            f.motivos = ["sin idea ni pieza larga que contar: no puede tener vídeo"]
        filas.append(f)
    quiero = cuantas(len(filas))
    for f in sorted((f for f in filas if f.posible), key=lambda f: (-f.puntos, f.n))[:quiero]:
        f.propuesta = True
    return filas


# ───────────────────────── el archivo que se corrige a mano ─────────────────────────


def _si(v: str) -> bool | None:
    v = T.norm(v or "").strip()
    return True if v in ("si", "s", "x", "1") else False if v in ("no", "n", "0") else None


def leer(ruta: Path = CSV) -> dict[str, dict[str, str]]:
    """Filas del archivo por id de lección."""
    if not ruta.is_file():
        return {}
    with ruta.open(encoding="utf-8", newline="") as fh:
        return {r["leccion_id"]: r for r in csv.DictReader(fh) if r.get("leccion_id")}


def anotar(books: list[Book], ruta: Path = CSV) -> dict[str, int]:
    """Pone al día la propuesta de estos libros. Lo decidido a mano (`decision`) y los demás libros no se tocan."""
    antes = leer(ruta)
    ids = {b.id for b in books}
    filas = [r for r in antes.values() if r.get("libro_id") not in ids]
    cuenta = {"libros": len(books), "lecciones": 0, "propuestas": 0, "decididas": 0}
    for book in books:
        for f in puntuar(book):
            previa = antes.get(f.leccion.id) or {}
            decision = previa.get("decision", "")
            filas.append({"libro_id": book.id, "libro": book.titulo, "n": str(f.n), "leccion_id": f.leccion.id, "leccion": f.leccion.titulo, "puntos": str(f.puntos), "motivos": "; ".join(f.motivos), "propuesta": "sí" if f.propuesta else "no", "decision": decision, "nota": previa.get("nota", "") or ""})
            cuenta["lecciones"] += 1
            cuenta["propuestas"] += f.propuesta
            cuenta["decididas"] += _si(decision) is not None
    filas.sort(key=lambda r: (T.norm(r["libro"]), r["libro_id"], int(r["n"] or 0)))
    with ruta.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS, lineterminator="\n")
        w.writeheader()
        w.writerows(filas)
    return cuenta


def elegidas(book: Book, ruta: Path = CSV) -> set[int]:
    """Números de lección (1…N) con vídeo: lo decidido a mano y, donde no hay decisión, lo propuesto.

    Un libro que aún no está en el archivo usa la propuesta calculada en el momento."""
    archivo = leer(ruta)
    de_libro = {le.id: archivo[le.id] for le in book.lessons if le.id in archivo}
    if not de_libro:
        return {f.n for f in puntuar(book) if f.propuesta}
    fuera = {f.n for f in puntuar(book) if f.propuesta} if len(de_libro) < len(book.lessons) else set()
    out: set[int] = set()
    for n, le in enumerate(book.lessons, start=1):
        r = de_libro.get(le.id)
        if r is None:  # lección añadida después de anotar el libro
            if n in fuera:
                out.add(n)
            continue
        decision = _si(r.get("decision", ""))
        if decision if decision is not None else _si(r.get("propuesta", "")):
            out.add(n)
    return out
