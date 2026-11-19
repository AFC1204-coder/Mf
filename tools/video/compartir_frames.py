"""Fotogramas de las piezas compartibles: cada estado de cada escena, en HTML, para capturar con Chrome.

Comparte con `frames.py` la captura y la caché; no comparte el aspecto. Aquí no hay cabecera de
aplicación, índice de secciones ni contador de lecciones: arriba la marca y el tipo de pieza, en el
centro una sola cosa en grande y abajo, siempre, de qué libro sale.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any

from . import compartir as K
from . import text as T
from .frames import ASSETS, REPO_ROOT, State, scene_states
from .scriptwriter import Scene

DEPENDENCIAS = [ASSETS / "compartir.css", ASSETS / "compartir.js"]


def _e(v: Any) -> str:
    return html.escape(str(v if v is not None else ""), quote=True)


def _largo(texto: str, long_at: int, xlong_at: int) -> str:
    n = len(texto or "")
    return " xlong" if n > xlong_at else " long" if n > long_at else ""


def acento_eje(eje: str) -> str:
    """El color del eje, leído de `lib/mapa.js` (para lo que se pinta fuera del navegador)."""
    try:
        fuente = (REPO_ROOT / "lib" / "mapa.js").read_text(encoding="utf-8")
        bloque = re.search(r"ACENTOS\s*=\s*\{(.*?)\}", fuente, re.S)
        colores = dict(re.findall(r"'([^']+)'\s*:\s*'(#[0-9a-fA-F]{6})'", bloque.group(1))) if bloque else {}
    except OSError:
        colores = {}
    return colores.get(eje, "#c9a84c")


# ───────────────────────── escenas ─────────────────────────

def _kicker(texto: str, tema: bool = False) -> str:
    return f'<div class="cs-kicker{" tema" if tema else ""}">{_e(texto)}</div>' if texto else ""


def _stage_frase(v: dict[str, Any], tag: str) -> tuple[str, str]:
    palabras = v.get("words") or []
    paginas = v.get("pages") or [[0, len(palabras)]]
    pi = min(int(v.get("page") or 0), len(paginas) - 1)
    a, b = paginas[pi]
    visto = int(v.get("shown") or 0)
    h0, h1 = (v.get("hot") or [0, 0])[:2]
    trozos = []
    for i in range(a, b):
        cls = "w off" if i >= visto else ("w hot" if h0 <= i < h1 else "w")
        trozos.append(f'<span class="{cls}">{_e(palabras[i])}</span>')
    n = b - a
    talla = " l" if n > 11 else " m" if n > 7 else ""
    # El rótulo de la escena: el tema (título de la lección) si lo hay; si no, el suyo cuando no repite el de arriba.
    rotulo = v.get("tema") or (v.get("kicker") if v.get("kicker") != tag else "")
    puntos = ""
    if len(paginas) > 1:
        puntos = '<div class="cs-pages">' + "".join(f'<i class="{"on" if i == pi else "done" if i < pi else ""}"></i>' for i in range(len(paginas))) + "</div>"
    marca = '<div class="cs-qmark">?</div>' if v.get("style") == "pregunta" else ""
    cuerpo = marca + _kicker(rotulo, tema=bool(v.get("tema"))) + f'<p class="cs-kin{talla}">{" ".join(trozos)}</p>' + puntos
    return cuerpo, ("solo" if visto == 0 else "")


def _stage_pausa(v: dict[str, Any], tag: str) -> tuple[str, str]:
    cd = int(v.get("countdown") or 0)
    return (
        '<div class="cs-qmark">?</div>'
        + f'<p class="cs-q-small">{_e(v.get("question"))}</p>'
        + f'<div class="cs-think"><b>{cd}</b><span>{_e(v.get("kicker"))}</span></div>',
        "",
    )


def _tarjeta(v: dict[str, Any]) -> str:
    pz = v.get("pieces") or []
    j = int(v.get("active") if v.get("active") is not None else -1)
    if not (0 <= j < len(pz)):
        return ""
    p = pz[j]
    desc = f'<span>{_e(p.get("d"))}</span>' if p.get("d") else ""
    items = "".join(f"<li>{_e(x)}</li>" for x in p.get("items") or [])
    return (
        f'<div class="cs-card tn-{_e(p.get("tone") or "a")}"><small>{j + 1} / {len(pz)}</small>'
        f'<b>{_e(p.get("t"))}</b>{desc}{f"<ul>{items}</ul>" if items else ""}</div>'
    )


def _stage_figura(v: dict[str, Any], tag: str) -> tuple[str, str]:
    spec = v.get("spec") or {}
    modo = v.get("mode") or "titulo"
    silueta = f'<div class="cs-sil"><div class="dg" data-plantilla="{_e(spec.get("plantilla"))}"><div id="cs-dg"></div></div></div>'
    titulo = f'<h2 class="cs-fig-title">{_e(v.get("title"))}</h2>' if v.get("title") else ""
    if modo == "pieza":
        resto = _tarjeta(v)
    elif modo == "pie":
        resto = f'<p class="cs-pie">{_e(v.get("pie"))}</p>'
    else:
        resto = ""
    return _kicker(v.get("kicker")) + titulo + f'<div class="cs-figrow">{silueta}{resto}</div>', f"m-{modo}"


def _stage_credito(v: dict[str, Any], tag: str) -> tuple[str, str]:
    rotulo = v.get("kicker") if v.get("kicker") != tag else K.ROTULOS["credito"]
    autor = f'<div class="cs-author">{_e(v.get("author"))}</div>' if v.get("author") else ""
    return (
        _kicker(rotulo)
        + f'<h1 class="cs-book{_largo(v.get("title", ""), 28, 52)}">{_e(v.get("title"))}</h1>'
        + autor
        + f'<div class="cs-eje">{_e(v.get("eje"))}</div>',
        "",
    )


def _stage_nodo(v: dict[str, Any], tag: str) -> tuple[str, str]:
    i, n = int(v.get("index") or 0), int(v.get("n") or 0)
    puntos = "".join(f'<i class="{"on" if j == i else "done" if j < i else ""}"></i>' for j in range(n))
    texto = f'<p class="cs-node-d">{_e(v.get("text"))}</p>' if v.get("text") else ""
    return (
        f'<div class="cs-dots">{puntos}</div>'
        + f'<div class="cs-node-hd"><div class="cs-node-n">{i + 1}</div><div class="cs-ic" data-icon="{_e(v.get("icon"))}"></div></div>'
        + f'<h2 class="cs-node-t">{_e(v.get("label"))}</h2>'
        + texto,
        "",
    )


def _stage_cierre(v: dict[str, Any], tag: str) -> tuple[str, str]:
    autor = f'<span>{_e(v.get("author"))}</span>' if v.get("author") else ""
    seguir = f'<div class="cs-seguir">{_e(v.get("cta"))}</div>' if v.get("cta") else ""
    return (
        '<div class="cs-mark">§</div>'
        + f'<div class="cs-wordmark">{_e(v.get("brand"))}</div>'
        + f'<div class="cs-lema">{_e(v.get("lema"))}</div>'
        + f'<div class="cs-cta">{_e(v.get("said"))}</div>'
        + seguir
        + f'<div class="cs-from"><b>{_e(v.get("title"))}</b>{autor}</div>',
        "",
    )


def _stage_portada(v: dict[str, Any], tag: str) -> tuple[str, str]:
    tema = f'<div class="cs-cover-tema">{_e(v.get("tema"))}</div>' if v.get("tema") else ""
    return (
        f'<div class="cs-chip">{_e(v.get("tag"))}</div>'
        + f'<h1 class="cs-cover{_largo(v.get("text", ""), 70, 110)}">{_e(v.get("text"))}</h1>'
        + tema,
        "",
    )


STAGES = {
    "c-frase": _stage_frase,
    "c-pausa": _stage_pausa,
    "c-figura": _stage_figura,
    "c-credito": _stage_credito,
    "c-nodo": _stage_nodo,
    "c-cierre": _stage_cierre,
    "c-portada": _stage_portada,
}

# En estas escenas el crédito ya es el contenido: el pie sobra.
_SIN_PIE = ("c-credito", "c-cierre")


def palabras_en_pantalla(kind: str, view: dict[str, Any]) -> int:
    """Palabras de contenido a la vista en un estado (sin marca, rótulos ni el crédito del pie)."""
    v = view
    if kind == "c-frase":
        paginas = v.get("pages") or [[0, 0]]
        a, b = paginas[min(int(v.get("page") or 0), len(paginas) - 1)]
        return max(0, min(b, int(v.get("shown") or 0)) - a)
    if kind == "c-pausa":
        return T.n_words(str(v.get("question") or ""))
    if kind == "c-figura":
        titulo = T.n_words(str(v.get("title") or ""))
        if v.get("mode") == "pieza":
            pz = v.get("pieces") or []
            j = int(v.get("active") if v.get("active") is not None else -1)
            p = pz[j] if 0 <= j < len(pz) else {}
            return titulo + sum(T.n_words(str(x)) for x in [p.get("t"), p.get("d"), *(p.get("items") or [])] if x)
        return titulo + (T.n_words(str(v.get("pie") or "")) if v.get("mode") == "pie" else 0)
    if kind == "c-nodo":
        return T.n_words(str(v.get("label") or "")) + T.n_words(str(v.get("text") or ""))
    if kind == "c-credito":
        return T.n_words(str(v.get("title") or "")) + T.n_words(str(v.get("author") or ""))
    if kind == "c-cierre":
        return T.n_words(str(v.get("said") or "")) + T.n_words(str(v.get("cta") or ""))
    if kind == "c-portada":
        return T.n_words(str(v.get("text") or ""))
    return 0


def frame_html(pieza: K.Pieza, kind: str, view: dict[str, Any], aspecto: str = "9:16", motivo: int = 0) -> str:
    """HTML completo de un fotograma. Sin red: todo se carga del repositorio."""
    stage_fn = STAGES.get(kind)
    if stage_fn is None:
        raise ValueError(f"Plantilla de escena desconocida: {kind!r}")
    tag = K.ROTULOS.get(pieza.tipo, "").format(n=sum(1 for s in pieza.scenes if s.kind == "c-nodo"))
    cuerpo, clase_stage = stage_fn(view, tag)
    estado = {
        "eje": pieza.eje,
        "spec": view.get("spec"),
        "order": view.get("order"),
        "n": view.get("n"),
        "active": view.get("active"),
        "shown": view.get("shown"),
    }
    libro = K.titulo_corto(pieza.book_title)
    pie = ""
    if kind not in _SIN_PIE:
        pie = f'<footer class="cs-foot"><b>{_e(libro)}</b>{" · " + _e(pieza.book_author) if pieza.book_author else ""}</footer>'
    estilo = view.get("style") or ""
    ar = aspecto.replace(":", "x")
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="{(REPO_ROOT / 'styles.css').as_uri()}">
<link rel="stylesheet" href="{(ASSETS / 'compartir.css').as_uri()}">
</head>
<body class="cs ar-{_e(ar)} k-{_e(kind)} st-{_e(estilo)} motivo-{int(motivo) % 4}">
<div class="cs-frame">
  <div class="cs-bg"></div><div class="cs-shade"></div>
  <header class="cs-top"><span class="cs-brand"><i>§</i>{_e(K.ROTULOS["marca"])}</span><span class="cs-tag">{_e(tag if kind != "c-portada" else "")}</span></header>
  <main class="cs-stage {clase_stage}">{cuerpo}</main>
  {pie}
</div>
<script>window.__CS__ = {json.dumps(estado, ensure_ascii=False).replace("</", "<\\/")};</script>
<script src="{(REPO_ROOT / 'lib' / 'diagram.js').as_uri()}"></script>
<script src="{(REPO_ROOT / 'lib' / 'mapa.js').as_uri()}"></script>
<script src="{(ASSETS / 'compartir.js').as_uri()}"></script>
</body></html>
"""


def pieza_pages(pieza: K.Pieza, aspecto: str = "9:16", motivo: int = 0) -> tuple[list[State], list[str]]:
    """Todos los estados de la pieza, en orden, con su HTML."""
    states: list[State] = []
    pages: list[str] = []
    for i, scene in enumerate(pieza.scenes):
        for st in scene_states(scene, i):
            states.append(st)
            pages.append(frame_html(pieza, scene.kind, st.view, aspecto, motivo))
    return states, pages


def portada_html(pieza: K.Pieza, aspecto: str = "9:16", motivo: int = 0) -> str:
    """La miniatura: el gancho, el libro y la marca en un solo fotograma pensado para verse pequeño."""
    return frame_html(pieza, "c-portada", dict(pieza.portada), aspecto, motivo)


def estados(scene: Scene) -> list[dict[str, Any]]:
    """Las vistas por las que pasa una escena (para medir cuánto texto hay a la vez)."""
    return [st.view for st in scene_states(scene, 0)]


def dependencias() -> list[Path]:
    return list(DEPENDENCIAS)
