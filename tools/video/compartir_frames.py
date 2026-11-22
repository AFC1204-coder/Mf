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

_CIFRA = re.compile(r"\d")

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

def _kicker(texto: str, tema: bool = False, icono: str = "") -> str:
    """El rótulo de la escena, con el icono que dice qué tipo de momento es (ver `compartir.ICONOS`)."""
    if not texto:
        return ""
    marca = f'<span class="cs-kic" data-icon="{_e(K.ICONOS.get(icono, ""))}"></span>' if K.ICONOS.get(icono) else ""
    return f'<div class="cs-kicker{" tema" if tema else ""}{" con-ic" if marca else ""}">{marca}<span>{_e(texto)}</span></div>'


def _stage_frase(v: dict[str, Any], tag: str) -> tuple[str, str]:
    palabras = v.get("words") or []
    paginas = v.get("pages") or [[0, len(palabras)]]
    pi = min(int(v.get("page") or 0), len(paginas) - 1)
    a, b = paginas[pi]
    visto = int(v.get("shown") or 0)
    h0, h1 = (v.get("hot") or [0, 0])[:2]
    afi = v.get("afi") or [-1, -1]
    trozos = []
    for i in range(a, b):
        cls = "w off" if i >= visto else ("w hot" if h0 <= i < h1 else "w")
        # «no X, sino Y»: lo afirmado se queda en color una vez dicho. Lo negado no se toca (ver `compartir.no_sino`).
        if i < visto and afi[0] <= i < afi[1]:
            cls += " afi"
        if _CIFRA.search(palabras[i]):
            cls += " num"  # una cifra que el texto da se ve como dato: es literal, solo cambia su peso
        trozos.append(f'<span class="{cls}">{_e(palabras[i])}</span>')
    n = b - a
    talla = " xl" if n > 16 else " l" if n > 11 else " m" if n > 7 else ""
    # El rótulo de la escena: el tema (título de la lección) si lo hay; si no, el suyo cuando no repite el de arriba.
    rotulo = v.get("tema") or (v.get("kicker") if v.get("kicker") != tag else "")
    puntos = ""
    if len(paginas) > 1:
        puntos = '<div class="cs-pages">' + "".join(f'<i class="{"on" if i == pi else "done" if i < pi else ""}"></i>' for i in range(len(paginas))) + "</div>"
    comp = _companero(v)
    if comp:
        # Con el esquema delante, el texto baja un cuerpo y el rótulo del tema sobra: el esquema ya dice de qué va.
        talla = " xl" if n > 11 else " l"
        return comp + f'<p class="cs-kin{talla}">{" ".join(trozos)}</p>' + puntos, "con-comp"
    cuerpo = _kicker(rotulo, tema=bool(v.get("tema")), icono=str(v.get("style") or "")) + f'<p class="cs-kin{talla}">{" ".join(trozos)}</p>' + puntos
    return cuerpo, ("solo" if visto == 0 else "")


def _companero(v: dict[str, Any]) -> str:
    """El esquema de la lección junto a la explicación: sus rótulos, y encendidos los que la voz ya ha nombrado."""
    fig = v.get("fig") or {}
    piezas = fig.get("pieces") or []
    if not piezas:
        return ""
    on = set(v.get("fig_on") or [])
    act = int(v.get("fig_act") if v.get("fig_act") is not None else -1)
    def chip(j: int, p: dict[str, Any]) -> str:
        estado = "act" if j == act else "on" if j in on else ""
        return f'<li class="{estado} tn-{_e(p.get("tone") or "a")}">{_insignia(p, j)}<b>{_e(p.get("t"))}</b></li>'

    patron = str(fig.get("patron") or "")
    chips = "".join(chip(j, p) for j, p in enumerate(piezas))
    antes = ""
    if fig.get("centro"):
        antes = f'<div class="cs-comp-hub">{_e(fig.get("centro"))}</div>'
    if fig.get("polos"):
        antes = f'<div class="cs-comp-polos"><span>{_e(fig["polos"][0])}</span><span>{_e(fig["polos"][1])}</span></div>'
    marca = f'<span class="cs-kic" data-icon="{_e(K.ICONOS.get(patron, ""))}"></span>' if K.ICONOS.get(patron) else ""
    titulo = f'<div class="cs-comp-t{" con-ic" if marca else ""}">{marca}<span>{_e(fig.get("title"))}</span></div>' if fig.get("title") else ""
    return f'<div class="cs-comp cp-{_e(patron)} cn-{len(piezas)}">{titulo}{antes}<ol>{chips}</ol></div>'


def _stage_pausa(v: dict[str, Any], tag: str) -> tuple[str, str]:
    cd = int(v.get("countdown") or 0)
    return (
        f'<p class="cs-q-small">{_e(v.get("question"))}</p>'
        + f'<div class="cs-think"><b>{cd}</b><span>{_e(v.get("kicker"))}</span><span class="cs-kic" data-icon="{_e(K.ICONOS["pensar"])}"></span></div>',
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


def _panel(p: dict[str, Any], j: int, estado: str, ancho: float = 0.0) -> str:
    """Un lado de un contraste o un eslabón de una cadena. `estado`: on (entero) · visto (solo el título) · falta."""
    cuerpo = ""
    if estado == "on":
        desc = f'<span>{_e(p.get("d"))}</span>' if p.get("d") else ""
        items = "".join(f"<li>{_e(x)}</li>" for x in p.get("items") or [])
        cuerpo = desc + (f"<ul>{items}</ul>" if items else "")
    estilo = f' style="width:{ancho:.0f}%"' if ancho else ""
    return f'<div class="cs-pan {estado} tn-{_e(p.get("tone") or "a")}"{estilo}>{_insignia(p, j)}<div><b>{_e(p.get("t"))}</b>{cuerpo}</div></div>'


def _insignia(p: dict[str, Any], j: int) -> str:
    """El número de la pieza o, si una persona le ha aprobado uno, su icono (ver `compartir.iconos_de_piezas`)."""
    if p.get("icon"):
        return f'<i class="ic" data-icon="{_e(p.get("icon"))}"></i>'
    return f"<i>{j + 1}</i>"


def _ancho_nivel(plantilla: str, j: int, n: int) -> float:
    """Una pirámide se ensancha de la cima a la base y un embudo se estrecha, como en la figura de la app
    (`lib/diagram.js`): el ancho de cada nivel, en % (0 = el normal). El texto manda: nunca menos del 64 %."""
    if n < 2 or plantilla not in ("piramide", "embudo"):
        return 0.0
    f = j / (n - 1)
    return 64 + 36 * (f if plantilla == "piramide" else 1 - f)


def _recapitula(v: dict[str, Any]) -> bool:
    """¿Caben a la vez el título, los títulos de las piezas y el pie sin pasar del presupuesto de lectura?"""
    total = T.n_words(str(v.get("title") or "")) + T.n_words(str(v.get("pie") or "")) + sum(T.n_words(str(x.get("t") or "")) for x in v.get("pieces") or [])
    return total <= 30


LISTAS = ("contraste", "cadena", "ciclo", "radial", "iceberg")  # patrones que son una lista de paneles
PATRONES_PROPIOS = (*LISTAS, "matriz", "espectro", "cifra")


def _centro(v: dict[str, Any]) -> str:
    """El centro de un mapa o de un ciclo (y su apostilla): parte de la figura, siempre a la vista."""
    marco = v.get("marco") or {}
    if not marco.get("centro"):
        return ""
    sub = f'<span>{_e(marco.get("centro_sub"))}</span>' if marco.get("centro_sub") else ""
    return f'<div class="cs-hub"><b>{_e(marco.get("centro"))}</b>{sub}</div>'


def _patron(v: dict[str, Any]) -> str:
    """Una lista de paneles con los rótulos literales de la figura: contraste (dos lados enfrentados), cadena
    (eslabones), ciclo (cadena que vuelve al principio) o radial (un centro y lo que sale de él).

    Antes de explicar nada se ven todos los títulos (la estructura entera); después, la pieza de la que se
    habla se abre y las demás quedan en su título: se ve dónde estamos y qué se ha dicho ya.
    """
    pz = v.get("pieces") or []
    modo = v.get("mode") or "titulo"
    activa = int(v.get("active") if v.get("active") is not None else -1)
    filas = []
    plantilla = str((v.get("spec") or {}).get("plantilla") or "")
    for j, p in enumerate(pz):
        if modo == "pieza":
            estado = "on" if j == activa else "visto" if j < activa else "falta"
        else:
            # Al presentar la estructura, las piezas entran una a una: las que aún no han entrado guardan su sitio.
            estado = "visto" if (modo != "titulo" or v.get("shown") is None or j < int(v.get("shown"))) else "visto aun-no"
        if v.get("patron") == "iceberg":
            # La línea de flotación: arriba lo que se ve, debajo lo que lo sostiene, cada parte con su rótulo.
            marco = v.get("marco") or {}
            if j == 0 and marco.get("superficie"):
                filas.append(f'<div class="cs-ice">{_e(marco.get("superficie"))}</div>')
            if j == int(marco.get("corte") or 0):
                filas.append(f'<div class="cs-ice fondo">{_e(marco.get("fondo"))}</div>')
        filas.append(_panel(p, j, estado, _ancho_nivel(plantilla, j, len(pz))))
    pie = f'<p class="cs-pie">{_e(v.get("pie"))}</p>' if modo == "pie" else ""
    if modo == "pie" and not _recapitula(v):
        return _centro(v) + pie  # con el pie, la recapitulación de títulos ya sería demasiado texto a la vez
    abierto = " abierto" if (v.get("patron") == "ciclo" and v.get("vuelta") == 0) else ""  # la flecha de vuelta aún no se ha dibujado
    return _centro(v) + f'<div class="cs-pat p-{_e(v.get("patron"))} pl-{_e(plantilla)} n-{len(pz)}{abierto}">{"".join(filas)}</div>{pie}'


def _matriz(v: dict[str, Any]) -> str:
    """Dos ejes y cuatro cuadrantes, con el nombre de cada extremo en su sitio; el cuadrante del que se habla, encendido."""
    pz = v.get("pieces") or []
    ejes = (v.get("marco") or {}).get("ejes") or {}
    modo = v.get("mode") or "titulo"
    activa = int(v.get("active") if v.get("active") is not None else -1)
    celdas_html: list[str] = []
    for j, p in enumerate(pz[:4]):
        estado = ("on" if j == activa else "visto" if j < activa else "falta") if modo == "pieza" else "visto"
        if modo == "titulo" and v.get("shown") is not None and j >= int(v.get("shown")):
            estado += " aun-no"
        # Los títulos de los cuadrantes se ven todos juntos al principio; después la cuadrícula solo sitúa (el texto va en la tarjeta).
        rotulo = f'<b>{_e(p.get("t"))}</b>' if modo == "titulo" else ""
        celdas_html.append(f'<div class="cs-cel {estado} tn-{_e(p.get("tone") or "a")}"><i>{j + 1}</i>{rotulo}</div>')
    x, y = (ejes.get("x") or ["", ""]), (ejes.get("y") or ["", ""])
    if modo == "pie":
        return ""  # el pie se lee solo: la cuadrícula ya se ha visto y recorrido
    if modo == "pieza" and 0 <= activa < 4:
        # Recorriéndola, cada cuadrante se sitúa con sus dos coordenadas (los rótulos de los ejes) y un mini-mapa.
        mini = "".join(f'<i class="{"on" if j == activa else ""}"></i>' for j in range(4))
        return (
            f'<div class="cs-coord"><div class="cs-mini">{mini}</div>'
            f'<div><span>{_e(x[activa % 2])}</span><span>{_e(y[activa // 2])}</span></div></div>'
        )
    c = [celdas_html[j] if j < len(celdas_html) else "" for j in range(4)]
    return (
        '<div class="cs-mat">'
        # Los nombres de los dos ejes, con su flecha (→ columnas, ↓ filas), y la tabla: todo en horizontal para que quepa.
        + f'<div class="cs-mat-n"><em class="x">{_e(ejes.get("x_nombre"))}</em><em class="y">{_e(ejes.get("y_nombre"))}</em></div>'
        + f'<span></span><span class="cs-mat-h">{_e(x[0])}</span><span class="cs-mat-h">{_e(x[1])}</span>'
        + f'<span class="cs-mat-v">{_e(y[0])}</span>{c[0]}{c[1]}'
        + f'<span class="cs-mat-v">{_e(y[1])}</span>{c[2]}{c[3]}'
        + "</div>"
    )


def _espectro(v: dict[str, Any]) -> str:
    """Una recta entre dos polos con cada posición marcada donde la figura la pone; la posición de la que se habla, encendida."""
    marco = v.get("marco") or {}
    polos = marco.get("polos") or ["", ""]
    pos = marco.get("pos") or []
    modo = v.get("mode") or "titulo"
    activa = int(v.get("active") if v.get("active") is not None else -1)
    puntos = ""
    for j, p in enumerate(v.get("pieces") or []):
        estado = ("on" if j == activa else "visto" if j < activa else "falta") if modo == "pieza" else "visto"
        if modo == "titulo" and v.get("shown") is not None and j >= int(v.get("shown")):
            estado += " aun-no"
        x = 4 + 92 * float(pos[j] if j < len(pos) else 0.5)
        puntos += f'<i class="{estado} tn-{_e(p.get("tone") or "a")}" style="left:{x:.1f}%">{j + 1}</i>'
    return (
        '<div class="cs-esp">'
        + f'<div class="cs-esp-polos"><span>{_e(polos[0])}</span><span>{_e(polos[1])}</span></div>'
        + f'<div class="cs-esp-linea">{puntos}</div></div>'
    )


def _cifras(v: dict[str, Any]) -> str:
    """El número, enorme, y debajo qué mide. Antes de recorrerlas, todas las cifras juntas."""
    pz = v.get("pieces") or []
    modo = v.get("mode") or "titulo"
    activa = int(v.get("active") if v.get("active") is not None else -1)
    if modo == "pieza" and 0 <= activa < len(pz):
        p = pz[activa]
        return f'<div class="cs-cifra tn-{_e(p.get("tone") or "a")}"><b>{_e(p.get("t"))}</b><span>{_e(p.get("d"))}</span></div>'
    visibles = int(v.get("shown")) if (modo == "titulo" and v.get("shown") is not None) else len(pz)
    return '<div class="cs-cifras">' + "".join(f'<b class="tn-{_e(p.get("tone") or "a")}{" aun-no" if j >= visibles else ""}">{_e(p.get("t"))}</b>' for j, p in enumerate(pz)) + "</div>"


def _stage_figura(v: dict[str, Any], tag: str) -> tuple[str, str]:
    spec = v.get("spec") or {}
    modo = v.get("mode") or "titulo"
    patron = v.get("patron")
    titulo = f'<h2 class="cs-fig-title">{_e(v.get("title"))}</h2>' if v.get("title") else ""
    pie = f'<p class="cs-pie">{_e(v.get("pie"))}</p>' if modo == "pie" else ""
    if patron in LISTAS:
        # Mientras se recorre, el título de la figura ya se ha visto: el sitio es para la pieza.
        return _kicker(v.get("kicker"), icono=str(patron or "")) + ("" if modo == "pieza" else titulo) + _patron(v), f"m-{modo} con-patron"
    if patron in ("matriz", "espectro"):
        forma = _matriz(v) if patron == "matriz" else _espectro(v)
        return _kicker(v.get("kicker"), icono=str(patron or "")) + titulo + forma + (_tarjeta(v) if modo == "pieza" else pie), f"m-{modo} con-forma"
    if patron == "cifra":
        return _kicker(v.get("kicker"), icono=str(patron or "")) + titulo + _cifras(v) + pie, f"m-{modo} con-forma"
    silueta = f'<div class="cs-sil"><div class="dg" data-plantilla="{_e(spec.get("plantilla"))}"><div id="cs-dg"></div></div></div>'
    resto = _tarjeta(v) if modo == "pieza" else pie
    return _kicker(v.get("kicker"), icono="silueta") + titulo + f'<div class="cs-figrow">{silueta}{resto}</div>', f"m-{modo}"


def _stage_credito(v: dict[str, Any], tag: str) -> tuple[str, str]:
    rotulo = v.get("kicker") if v.get("kicker") != tag else K.ROTULOS["credito"]
    autor = f'<div class="cs-author">{_e(v.get("author"))}</div>' if v.get("author") else ""
    return (
        _kicker(rotulo, icono="credito")
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
    recuerda = ""
    if v.get("recuerda"):
        antes = f'<em>{_e(v.get("recuerda_antes"))}</em>' if v.get("recuerda_antes") else ""
        largo = " largo" if T.n_words(str(v.get("recuerda"))) + T.n_words(str(v.get("recuerda_antes") or "")) > 22 else ""
        recuerda = f'<div class="cs-recuerda{largo}"><small>{_e(v.get("recuerda_rotulo"))}</small>{antes}<p>{_e(v.get("recuerda"))}</p></div>'
    return (
        recuerda
        + '<div class="cs-lockup"><div class="cs-mark">§</div><div>'
        + f'<div class="cs-wordmark">{_e(v.get("brand"))}</div>'
        + f'<div class="cs-lema">{_e(v.get("lema"))}</div></div></div>'
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
        fig = v.get("fig") or {}
        rotulos = T.n_words(str(fig.get("title") or "")) + sum(T.n_words(str(p.get("t") or "")) for p in fig.get("pieces") or [])
        rotulos += T.n_words(str(fig.get("centro") or "")) + sum(T.n_words(str(x)) for x in fig.get("polos") or [])
        return max(0, min(b, int(v.get("shown") or 0)) - a) + rotulos
    if kind == "c-pausa":
        return T.n_words(str(v.get("question") or ""))
    if kind == "c-figura":
        patron, modo = v.get("patron"), v.get("mode")
        en_lista = patron in LISTAS
        titulo = 0 if (en_lista and modo == "pieza") else T.n_words(str(v.get("title") or ""))
        pz = v.get("pieces") or []
        j = int(v.get("active") if v.get("active") is not None else -1)
        marco = v.get("marco") or {}
        ejes = marco.get("ejes") or {}
        # El marco de la figura (centro, polos, extremos de los ejes) está siempre a la vista.
        fijo = sum(T.n_words(str(x)) for x in [marco.get("centro"), marco.get("centro_sub"), marco.get("superficie"), marco.get("fondo"), *(marco.get("polos") or []), *(ejes.get("x") or []), *(ejes.get("y") or []), ejes.get("x_nombre"), ejes.get("y_nombre")] if x)
        rotulos_todos = sum(T.n_words(str(x.get("t") or "")) for x in pz)
        if modo == "pieza":
            p = pz[j] if 0 <= j < len(pz) else {}
            propia = sum(T.n_words(str(x)) for x in [p.get("t"), p.get("d"), *(p.get("items") or [])] if x)
            if patron == "cifra":
                return titulo + propia
            if patron == "matriz":
                x, y = (ejes.get("x") or ["", ""]), (ejes.get("y") or ["", ""])
                return titulo + T.n_words(str(x[j % 2])) + T.n_words(str(y[(j // 2) % 2])) + propia
            vistos = sum(T.n_words(str(x.get("t") or "")) for x in pz[:j]) if en_lista else 0
            return titulo + fijo + vistos + propia
        if patron == "cifra" or (patron == "matriz" and modo == "titulo"):
            rotulos = rotulos_todos
        elif en_lista and (modo != "pie" or _recapitula(v)):
            rotulos = rotulos_todos
        else:
            rotulos = 0
        if patron == "matriz" and modo == "pie":
            fijo = 0
        return titulo + fijo + rotulos + (T.n_words(str(v.get("pie") or "")) if modo == "pie" else 0)
    if kind == "c-nodo":
        return T.n_words(str(v.get("label") or "")) + T.n_words(str(v.get("text") or ""))
    if kind == "c-credito":
        return T.n_words(str(v.get("title") or "")) + T.n_words(str(v.get("author") or ""))
    if kind == "c-cierre":
        return T.n_words(str(v.get("said") or "")) + T.n_words(str(v.get("cta") or "")) + T.n_words(str(v.get("recuerda") or "")) + T.n_words(str(v.get("recuerda_antes") or ""))
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
