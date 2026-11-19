"""Fotogramas: cada estado de cada escena se compone en HTML y se captura con Chrome sin cabeza.

Por qué HTML y no dibujo a mano: los esquemas de las lecciones se pintan con el **mismo motor de la
app** (`lib/diagram.js`) y los iconos del mapa salen de `lib/mapa.js`, así que el vídeo enseña la
misma figura verificada que la lección, con la misma tipografía y paleta.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from glob import glob
from pathlib import Path
from typing import Any

from PIL import Image

from .scriptwriter import LETRAS, Episode, Scene

WIDTH = 1080
HEIGHT = 1920

VIDEO_DIR = Path(__file__).resolve().parent
REPO_ROOT = VIDEO_DIR.parent.parent
ASSETS = VIDEO_DIR / "assets"
_DEPENDENCIAS = [
    ASSETS / "frame.css",
    ASSETS / "frame.js",
    REPO_ROOT / "lib" / "diagram.js",
    REPO_ROOT / "lib" / "mapa.js",
    REPO_ROOT / "styles.css",
]


class BrowserNotFound(RuntimeError):
    pass


def find_chrome() -> str:
    """Localiza un Chrome/Chromium. Se puede forzar con la variable CHROME_BIN."""
    candidatos: list[str] = []
    if os.getenv("CHROME_BIN"):
        candidatos.append(os.environ["CHROME_BIN"])
    candidatos += [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ]
    for nombre in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome"):
        ruta = shutil.which(nombre)
        if ruta:
            candidatos.append(ruta)
    home = Path.home()
    for patron in (
        "/opt/pw-browsers/chromium-*/chrome-linux*/chrome",
        str(home / ".cache/ms-playwright/chromium-*/chrome-linux*/chrome"),
        str(home / "Library/Caches/ms-playwright/chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium"),
        str(home / "Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    ):
        candidatos += sorted(glob(patron), reverse=True)
    for c in candidatos:
        if c and Path(c).exists():
            return c
    raise BrowserNotFound(
        "No se encontró Chrome ni Chromium. Instala Google Chrome o indica su ruta con CHROME_BIN "
        "(hace falta para dibujar los fotogramas y los esquemas)."
    )


# ───────────────────────── estados ─────────────────────────

@dataclass
class State:
    """Un fotograma fijo: la vista de una escena en un momento dado."""

    scene_index: int
    view: dict[str, Any]
    at_word: int | None = None
    at_s: float | None = None


def scene_states(scene: Scene, scene_index: int) -> list[State]:
    """Estado inicial de la escena y uno más por cada `Beat` (los cambios se acumulan)."""
    view = dict(scene.view)
    states = [State(scene_index, dict(view), at_word=0, at_s=0.0)]
    for beat in scene.beats:
        view.update(beat.patch)
        states.append(State(scene_index, dict(view), beat.at_word, beat.at_s))
    return states


# ───────────────────────── HTML ─────────────────────────

def _e(v: Any) -> str:
    return html.escape(str(v if v is not None else ""), quote=True)


def _size_class(text: str, long_at: int, xlong_at: int) -> str:
    n = len(text or "")
    return " xlong" if n > xlong_at else " long" if n > long_at else ""


def _kicker(view: dict[str, Any]) -> str:
    step = view.get("step")
    extra = f'<span class="vf-step">{int(step[0])} / {int(step[1])}</span>' if step and step[1] > 1 else ""
    return f'<div class="vf-kicker">{_e(view.get("kicker"))}{extra}</div>'


def _route(route: dict[str, Any] | None) -> str:
    if not route or not route.get("n"):
        return ""
    n, cur = int(route["n"]), int(route.get("current") or 0)
    dots = "".join(f'<i class="{"on" if i == cur else "done" if i < cur else ""}"></i>' for i in range(1, n + 1))
    return f'<div class="vf-route{" many" if n > 14 else ""}">{dots}</div>'


def _stage_portada(v: dict[str, Any]) -> str:
    return (
        f'<div class="vf-eje">{_e(str(v.get("eje", "")).upper())}</div>'
        + _kicker(v)
        + f'<h1 class="vf-title{_size_class(v.get("title", ""), 52, 84)}">{_e(v.get("title"))}</h1>'
        + '<div class="vf-rule"></div>'
        + f'<div class="vf-byline"><b>{_e(v.get("book"))}</b><span>{_e(v.get("author"))}</span></div>'
        + _route(v.get("route"))
    )


def _stage_puente(v: dict[str, Any]) -> str:
    return (
        _kicker(v)
        + f'<div class="vf-ref"><span class="n">{_e(v.get("number"))}</span><span class="t">{_e(v.get("title"))}</span></div>'
        + f'<div class="vf-big{_size_class(v.get("text", ""), 130, 210)}">{_e(v.get("text"))}</div>'
        + _route(v.get("route"))
    )


def _stage_idea(v: dict[str, Any]) -> str:
    sub = f'<div class="vf-sub">{_e(v["title"])}</div>' if v.get("title") else ""
    return _kicker(v) + sub + f'<div class="vf-big{_size_class(v.get("text", ""), 130, 210)}">{_e(v.get("text"))}</div>'


def _stage_texto(v: dict[str, Any]) -> str:
    chips = v.get("chips") or []
    on = int(v.get("chips_on") or 0)
    chips_html = "".join(f'<span class="vf-chip{" on" if i < on else ""}">{_e(c)}</span>' for i, c in enumerate(chips))
    return (
        _kicker(v)
        + f'<div class="vf-card"><div class="vf-anchor{_size_class(v.get("text", ""), 150, 230)}">{_e(v.get("text"))}</div></div>'
        + (f'<div class="vf-chips">{chips_html}</div>' if chips else "")
    )


def _stage_esquema(v: dict[str, Any]) -> str:
    spec = v.get("spec") or {}
    pie = f'<div class="vf-fig-pie">{_e(spec.get("pie"))}</div>' if spec.get("pie") else ""
    return (
        _kicker(v)
        + '<div class="vf-fig">'
        + f'<h2 class="vf-fig-title">{_e(spec.get("titulo"))}</h2>'
        + f'<div class="dg" data-plantilla="{_e(spec.get("plantilla"))}"><div id="vf-dg"></div></div>'
        + pie
        + "</div>"
    )


def _stage_pregunta(v: dict[str, Any]) -> str:
    reveal = bool(v.get("reveal"))
    correct = int(v.get("correct") or 0)
    opts = []
    for i, o in enumerate(v.get("options") or []):
        cls = (" ok" if i == correct else " dim") if reveal else ""
        letra = LETRAS[i] if i < len(LETRAS) else str(i + 1)
        opts.append(f'<div class="vf-opt{cls}"><span class="l">{letra}</span><span class="o">{_e(o)}</span></div>')
    cd = v.get("countdown")
    if reveal:
        pie = f'<div class="vf-think"><div class="vf-why">{_e(v.get("explanation"))}</div></div>'
    elif cd is None:
        pie = '<div class="vf-think vf-hide"><span>.</span></div>'
    else:
        num = f"<b>{int(cd)}</b>" if cd else ""
        pie = f'<div class="vf-think"><span>PIENSA TU RESPUESTA</span>{num}</div>'
    return _kicker(v) + f'<h2 class="vf-q">{_e(v.get("question"))}</h2><div class="vf-opts">{"".join(opts)}</div>' + pie


def _stage_mapa(v: dict[str, Any]) -> str:
    shown, active = int(v.get("shown") or 0), int(v.get("active") if v.get("active") is not None else -1)
    nodes = []
    for i, n in enumerate(v.get("nodes") or []):
        cls = (" shown" if i < shown else "") + (" on" if i == active else "")
        texto = f'<span>{_e(n.get("texto"))}</span>' if n.get("texto") else ""
        nodes.append(
            f'<div class="vf-node{cls}"><div class="ic" data-icon="{_e(n.get("icono"))}"></div>'
            f'<div><b>{_e(n.get("etiqueta"))}</b>{texto}</div></div>'
        )
    central = ""
    if v.get("cierre"):
        central = (
            f'<div class="vf-central{" shown" if v.get("show_cierre") else ""}">'
            f'<small>LA IDEA CENTRAL</small><p>{_e(v.get("cierre"))}</p></div>'
        )
    return _kicker(v) + f'<div class="vf-nodes">{"".join(nodes)}</div>' + central


def _stage_ruta(v: dict[str, Any]) -> str:
    shown, active = int(v.get("shown") or 0), int(v.get("active") if v.get("active") is not None else -1)
    items = v.get("items") or []
    filas = []
    for i, t in enumerate(items):
        cls = (" shown" if i < shown else "") + (" on" if i == active else "")
        filas.append(f'<div class="vf-item{cls}"><span class="n">{i + 1}</span><span class="t">{_e(t)}</span></div>')
    return _kicker(v) + f'<div class="vf-items{" cols" if len(items) > 10 else ""}">{"".join(filas)}</div>'


def _stage_cierre(v: dict[str, Any]) -> str:
    out = _kicker(v)
    if v.get("text"):
        out += f'<div class="vf-big{_size_class(v.get("text", ""), 130, 210)}">{_e(v.get("text"))}</div>'
    if v.get("next_title"):
        out += (
            f'<div class="vf-next"><small>SIGUIENTE · LECCIÓN {_e(v.get("next_number"))}</small>'
            f'<b>{_e(v.get("next_title"))}</b></div>'
        )
    related = v.get("related") or []
    if related:
        out += f'<div class="vf-related"><em>PARA SEGUIR</em>{_e(" · ".join(related))}</div>'
    credito = " · ".join(x for x in (v.get("book"), v.get("author"), v.get("counter")) if x)
    return out + f'<div class="vf-credit">{_e(credito)}</div>'


def _stage_libro(v: dict[str, Any]) -> str:
    eje = str(v.get("eje") or "")
    if v.get("sub_eje") and v["sub_eje"] != eje:
        eje = f"{eje} · {v['sub_eje']}" if eje else str(v["sub_eje"])
    cover = ""
    if v.get("cover") and Path(str(v["cover"])).exists():
        cover = f'<div class="vf-cover"><img src="{_e(Path(str(v["cover"])).resolve().as_uri())}" alt=""></div>'
    return (
        cover
        + f'<div class="vf-eje">{_e(eje.upper())}</div>'
        + f'<h1 class="vf-title{_size_class(v.get("title", ""), 44, 70)}">{_e(v.get("title"))}</h1>'
        + f'<div class="vf-byline" style="margin-top:2.4em"><span>{_e(v.get("author"))}</span></div>'
        + f'<div class="vf-count">{int(v.get("n_lessons") or 0)} LECCIONES</div>'
        + (f'<div class="vf-desc">{_e(v.get("description"))}</div>' if v.get("description") else "")
    )


_STAGES = {
    "portada": _stage_portada,
    "puente": _stage_puente,
    "idea": _stage_idea,
    "texto": _stage_texto,
    "esquema": _stage_esquema,
    "pregunta": _stage_pregunta,
    "mapa": _stage_mapa,
    "ruta": _stage_ruta,
    "cierre": _stage_cierre,
    "libro": _stage_libro,
}


def _rail(episode: Episode, section: str, finished: bool) -> str:
    if not episode.sections:
        return ""
    activo = episode.sections.index(section) if section in episode.sections else (len(episode.sections) if finished else -1)
    items = []
    for i, nombre in enumerate(episode.sections):
        cls = "on" if i == activo else "done" if i < activo else ""
        items.append(f'<span class="vf-rail-i {cls}"><i></i><b>{_e(nombre)}</b></span>')
    return f'<nav class="vf-rail">{"".join(items)}</nav>'


def frame_html(episode: Episode, scene: Scene, view: dict[str, Any], scene_index: int, photo: Path | None = None) -> str:
    """HTML completo de un fotograma. Sin dependencias de red: todo se carga del repositorio."""
    stage_fn = _STAGES.get(scene.kind)
    if stage_fn is None:
        raise ValueError(f"Plantilla de escena desconocida: {scene.kind!r}")
    # El índice queda «todo hecho» en las escenas posteriores a la última sección (el cierre).
    ultima_con_seccion = max((i for i, s in enumerate(episode.scenes) if s.section), default=-1)
    finished = scene_index > ultima_con_seccion
    libro = episode.book_title + (f" · {episode.book_author}" if episode.book_author else "")
    estado = {"eje": episode.eje, "spec": view.get("spec")}
    foto = ""
    if photo and photo.exists() and scene.kind in ("portada", "cierre", "libro"):
        foto = f'<div class="vf-photo" style="background-image:url(\'{_e(photo.resolve().as_uri())}\')"></div>'
    tono = view.get("tone") if view.get("tone") in ("mal", "ok") else "a"
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="{(REPO_ROOT / 'styles.css').as_uri()}">
<link rel="stylesheet" href="{(ASSETS / 'frame.css').as_uri()}">
</head>
<body class="vf k-{_e(scene.kind)} tone-{tono}">
<div class="vf-frame">
  {foto}<div class="vf-glow"></div>
  <header class="vf-hd">
    <div class="vf-hd-row"><span class="vf-brand">MENTE FRÍA</span><span class="vf-counter">{_e(episode.counter)}</span></div>
    <div class="vf-hd-book">{_e(libro)}</div>
    {_rail(episode, scene.section, finished)}
  </header>
  <main class="vf-stage">{stage_fn(view)}</main>
</div>
<script>window.__VF__ = {json.dumps(estado, ensure_ascii=False).replace("</", "<\\/")};</script>
<script src="{(REPO_ROOT / 'lib' / 'diagram.js').as_uri()}"></script>
<script src="{(REPO_ROOT / 'lib' / 'mapa.js').as_uri()}"></script>
<script src="{(ASSETS / 'frame.js').as_uri()}"></script>
</body></html>
"""


# ───────────────────────── captura ─────────────────────────

def _assets_stamp() -> str:
    h = hashlib.sha256()
    for p in _DEPENDENCIAS:
        try:
            h.update(p.read_bytes())
        except OSError:
            h.update(b"-")
    return h.hexdigest()[:12]


def _capture(chrome: str, html_path: Path, out_png: Path, profile_root: Path) -> None:
    profile = Path(tempfile.mkdtemp(prefix="perfil-", dir=profile_root))
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-component-update",
        "--allow-file-access-from-files",
        "--force-device-scale-factor=1",
        f"--window-size={WIDTH},{HEIGHT}",
        "--virtual-time-budget=4000",
        f"--user-data-dir={profile}",
        f"--screenshot={out_png}",
        html_path.resolve().as_uri(),
    ]
    if sys.platform.startswith("linux"):
        cmd.insert(1, "--no-sandbox")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not out_png.exists():
        raise RuntimeError(f"Chrome no generó el fotograma {out_png.name}: {res.stderr.strip()[-400:]}")
    _normalize_png(out_png)


def _normalize_png(out_png: Path) -> None:
    """Deja la captura en RGB de 1080×1920 exactos (lo que espera el montaje)."""
    with Image.open(out_png) as im:
        if im.size != (WIDTH, HEIGHT) or im.mode != "RGB":
            arreglada = im.convert("RGB")
            if arreglada.size != (WIDTH, HEIGHT):
                arreglada = arreglada.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
            arreglada.save(out_png)


def render_frames(pages: list[str], frames_dir: Path, jobs: int | None = None) -> list[Path]:
    """Captura cada HTML como PNG de 1080×1920. Reutiliza los ya capturados (la clave es el contenido)."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    sello = _assets_stamp()
    salidas: list[Path] = []
    pendientes: dict[Path, str] = {}
    for doc in pages:
        clave = hashlib.sha256((sello + doc).encode("utf-8")).hexdigest()[:20]
        png = frames_dir / f"f_{clave}.png"
        salidas.append(png)
        if not png.exists():
            pendientes[png] = doc
    if not pendientes:
        return salidas

    chrome = find_chrome()

    # Vía rápida: un solo Chrome y todas las capturas por DevTools. Si falla, un proceso por fotograma.
    if os.getenv("VF_CAPTURA", "cdp").strip().lower() != "clasica":
        from .cdp import CDPError, capture_pages

        trabajos: list[tuple[Path, Path]] = []
        for png, doc in pendientes.items():
            html_path = png.with_suffix(".html")
            html_path.write_text(doc, encoding="utf-8")
            trabajos.append((html_path, png.with_name(png.stem + ".tmp.png")))
        try:
            capture_pages(chrome, trabajos, WIDTH, HEIGHT, workers=jobs or 4)
            for (_, tmp), png in zip(trabajos, pendientes):
                _normalize_png(tmp)
                tmp.replace(png)
            return salidas
        except CDPError as exc:
            print(f"[fotogramas] {exc} Se usa la captura clásica (un Chrome por fotograma).")
            for _, tmp in trabajos:
                tmp.unlink(missing_ok=True)
            pendientes = {png: doc for png, doc in pendientes.items() if not png.exists()}

    perfiles = frames_dir / "_perfiles"
    perfiles.mkdir(exist_ok=True)

    def trabajo(item: tuple[Path, str]) -> None:
        png, doc = item
        html_path = png.with_suffix(".html")
        html_path.write_text(doc, encoding="utf-8")
        tmp = png.with_name(png.stem + ".tmp.png")
        _capture(chrome, html_path, tmp, perfiles)
        tmp.replace(png)

    n = jobs or max(1, min(6, (os.cpu_count() or 2)))
    try:
        with ThreadPoolExecutor(max_workers=n) as pool:
            list(pool.map(trabajo, pendientes.items()))
    finally:
        shutil.rmtree(perfiles, ignore_errors=True)
    return salidas


def episode_pages(episode: Episode, photo: Path | None = None) -> tuple[list[State], list[str]]:
    """Todos los estados del episodio, en orden, con su HTML."""
    states: list[State] = []
    pages: list[str] = []
    for i, scene in enumerate(episode.scenes):
        for st in scene_states(scene, i):
            states.append(st)
            pages.append(frame_html(episode, scene, st.view, i, photo))
    return states, pages
