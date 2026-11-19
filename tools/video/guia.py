"""Esquema-guía: las piezas de la figura de una lección y en qué momento de la locución se nombra cada una.

La idea didáctica: el esquema verificado de la lección es la columna vertebral del vídeo.
  · antes de explicar se enseña entero y se nombran sus piezas (organizador previo);
  · mientras se explica, un mini-esquema sin texto marca **dónde estamos** (la pieza se ilumina cuando
    la voz la nombra) y una tarjeta grande dice qué pieza es;
  · al final se oculta y se pide recordarlo antes de revelarlo pieza a pieza.

Este módulo solo decide *qué pieza* y *cuándo*. Todo el texto que se muestra o se lee sale literal de la
figura. El emparejamiento con la locución es léxico y prudente: ante la duda no ilumina nada (una pieza
mal iluminada engaña; una sin iluminar solo informa menos).
"""

from __future__ import annotations

import collections
from dataclasses import dataclass, field
from typing import Any

from . import text as T

GUIDED = ("pasos", "comparar", "mapa", "ciclo", "piramide", "matriz")
MAX_PIECES = 6

# Palabras que sirven para señalar de qué se habla pero no distinguen una pieza de otra.
_NEUTRAS = {"lectura", "nuestra", "biblioteca", "libro", "autor", "autores", "segun", "tesis"}


@dataclass
class Piece:
    t: str  # rótulo de la pieza (literal de la figura)
    d: str = ""  # descripción (literal)
    items: list[str] = field(default_factory=list)  # elementos (solo en `comparar`)
    tone: str = "a"
    dom: int = 0  # posición de su caja en el SVG que dibuja lib/diagram.js

    @property
    def lines(self) -> list[str]:
        """Los textos de la pieza en orden de lectura."""
        return [x for x in [self.t, self.d, *self.items] if x]

    def to_view(self) -> dict[str, Any]:
        return {"t": self.t, "d": self.d, "items": self.items, "tone": self.tone}


def _s(v: Any) -> str:
    return T.clean(v) if isinstance(v, str) else ""


def pieces(spec: dict[str, Any] | None) -> list[Piece]:
    """Piezas de una figura en orden de lectura. [] si la plantilla no se puede guiar."""
    if not spec or spec.get("plantilla") not in GUIDED:
        return []
    d = spec.get("datos") if isinstance(spec.get("datos"), dict) else {}
    kind = spec["plantilla"]
    out: list[Piece] = []
    if kind == "pasos":
        for i, x in enumerate(d.get("pasos") or []):
            if isinstance(x, dict):
                out.append(Piece(_s(x.get("t")), _s(x.get("d")), tone=x.get("tono") or d.get("tono") or "a", dom=i))
    elif kind == "comparar":
        for i, k in enumerate(("izq", "der")):
            col = d.get(k) if isinstance(d.get(k), dict) else {}
            out.append(Piece(_s(col.get("t")), items=[_s(x) for x in col.get("items") or [] if _s(x)], tone=col.get("tono") or "a", dom=i))
    elif kind == "mapa":
        nodos = [x for x in (d.get("nodos") or []) if isinstance(x, dict)]
        izq = (len(nodos) + 1) // 2  # lib/diagram.js dibuja primero la columna izquierda (nodos pares) y luego la derecha
        for i, x in enumerate(nodos):
            out.append(Piece(_s(x.get("t")), _s(x.get("d")), tone=x.get("tono") or "a", dom=(i // 2 if i % 2 == 0 else izq + i // 2)))
    elif kind in ("ciclo", "piramide", "matriz"):
        clave = {"ciclo": "nodos", "piramide": "niveles", "matriz": "celdas"}[kind]
        for i, x in enumerate(d.get(clave) or []):
            if isinstance(x, dict):
                out.append(Piece(_s(x.get("t")), _s(x.get("d")), tone=x.get("tono") or "a", dom=i))
    if not (2 <= len(out) <= MAX_PIECES) or any(not p.t for p in out):
        return []
    return out


def order(ps: list[Piece]) -> list[int]:
    """Para cada pieza, el índice de su caja en el SVG (el recorrido usa este mapa para iluminarla)."""
    return [p.dom for p in ps]


def reading_lines(p: Piece, compact: bool) -> list[str]:
    """Qué se lee de una pieza: título y descripción (o elementos); solo el título si hay que ir corto."""
    return [p.t] if compact else p.lines


def reading_is_long(ps: list[Piece], max_words: int = 110) -> bool:
    return sum(T.n_words(x) for p in ps for x in p.lines) > max_words


# ───────────────────────── emparejamiento con la locución ─────────────────────────

def _stem(w: str) -> str:
    return w[:5]


def _stems(text: str) -> set[str]:
    return {_stem(w) for w in T.content_tokens(text) if _stem(w) not in _NEUTRAS}


def _token_stems(block: str) -> list[str | None]:
    """Un valor por cada palabra del bloque (separada por espacios): su raíz, o None si no tiene contenido."""
    out: list[str | None] = []
    for tok in block.split():
        ws = T.content_tokens(tok)
        out.append(_stem(ws[0]) if ws else None)
    return out


def mentions(block: str, ps: list[Piece], theta: float = 0.4, window: int = 12, min_gap: int = 4) -> list[tuple[int, int]]:
    """Piezas que el bloque nombra y en qué palabra del bloque empieza a nombrarlas: [(pieza, palabra)] por orden.

    Una pieza cuenta si el bloque contiene una parte suficiente de sus términos distintivos (peso 1/nº de
    piezas que los comparten) y al menos dos de ellos. La palabra es el arranque de la ventana de `window`
    palabras donde más se concentran.
    """
    if len(ps) < 2:
        return []
    pst = [_stems(" ".join(p.lines)) for p in ps]
    df = collections.Counter(s for st in pst for s in st)
    peso = [sum(1.0 / df[s] for s in st) or 1e-9 for st in pst]
    toks = _token_stems(block)
    presentes = {s for s in toks if s}
    candidatas: list[tuple[float, int, int]] = []  # (puntuación, palabra, pieza)
    for j, st in enumerate(pst):
        comunes = st & presentes
        if len(comunes) < min(2, len(st)):
            continue
        score = sum(1.0 / df[s] for s in comunes) / peso[j]
        if score < theta:
            continue
        # ventana más densa en términos de la pieza
        mejor, pos = -1.0, 0
        for i, s in enumerate(toks):
            if s not in st:
                continue
            visto: set[str] = set()
            w = 0.0
            for s2 in toks[i : i + window]:
                if s2 in st and s2 not in visto:
                    visto.add(s2)
                    w += 1.0 / df[s2]
            if w > mejor + 1e-9:
                mejor, pos = w, i
        candidatas.append((score, pos, j))
    # Dos piezas no se iluminan a la vez: se queda la de mayor puntuación si caen demasiado juntas.
    elegidas: list[tuple[float, int, int]] = []
    for c in sorted(candidatas, key=lambda x: -x[0]):
        if all(abs(c[1] - e[1]) >= min_gap for e in elegidas):
            elegidas.append(c)
    return [(j, pos) for _, pos, j in sorted(elegidas, key=lambda x: x[1])]


def timeline(block: str, ps: list[Piece], offset: int = 0) -> tuple[int, list[tuple[int, int]]]:
    """(pieza inicial, [(palabra, pieza) para cada cambio]) de un bloque narrado.

    La pieza inicial es -1 (ninguna) salvo que la primera mención caiga en las primeras palabras.
    `offset` son las palabras de locución que van antes del bloque en la misma escena.
    """
    ms = mentions(block, ps)
    if not ms:
        return -1, []
    inicial = -1
    if ms[0][1] <= 3:
        inicial, ms = ms[0][0], ms[1:]
    return inicial, [(offset + pos, j) for j, pos in ms]
