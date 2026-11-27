"""CLI de tools/video: vídeos didácticos (9:16) a partir del corpus de Mente Fría.

    python -m tools.video.cli leccion "<título o id>"      una lección, contada dentro de su libro
    python -m tools.video.cli libro "<título o id>"        la serie del libro: presentación + lecciones + repaso
    python -m tools.video.cli biblioteca --limit 5         los siguientes libros sin serie completa

Todo es repetible: si el guion, la voz y el motor de fotogramas no han cambiado, el episodio no se
vuelve a renderizar (usa --force para obligar).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

from . import text as T
from .corpus import Book, find_lesson, list_book_rows, load_book, load_book_by_row
from .frames import _assets_stamp
from .lint import _textos_de_vista, has_errors, lint_episode
from .renderer import merge_videos, render_episode
from . import compartir as K
from . import seleccion as SEL
from .scriptwriter import FORMATS, SCRIPT_VERSION, Episode, book_series, export_script_markdown
from .tts import DEFAULT_ENGINE, get_tts_engine
from .tts.cache import CachedTTS

VIDEO_DIR = Path(__file__).resolve().parent
REPO_ROOT = VIDEO_DIR.parent.parent
OUTPUT = VIDEO_DIR / "output"
COMMANDS = ("leccion", "libro", "biblioteca", "calendario", "publicados", "seleccion")


def _load_env() -> None:
    for candidate in (VIDEO_DIR / ".env", REPO_ROOT / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


@dataclass
class Result:
    key: str
    title: str
    status: str  # ok | sin-cambios | guion | error
    duration_s: float = 0.0
    detail: str = ""
    video: str = ""
    chapters: list[tuple[str, float]] = field(default_factory=list)
    voices: list[str] = field(default_factory=list)


def _mmss(sec: float) -> str:
    sec = int(round(sec))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _write_description(ep: Episode, chapters: list[tuple[str, float]], out: Path) -> None:
    """Texto listo para publicar: título, lugar en la serie, la idea y los capítulos con su minuto."""
    if ep.kind == "leccion":
        sitio = f"Lección {ep.number} de {ep.total} · {ep.book_title}"
    else:
        sitio = ("Presentación" if ep.kind == "presentacion" else "Repaso") + f" · {ep.book_title}"
    if ep.book_author:
        sitio += f", de {ep.book_author}"
    lines = [ep.title, sitio + " · Mente Fría", ""]
    if ep.summary:
        lines += [ep.summary, ""]
    if len(chapters) > 1:
        lines.append("Capítulos")
        lines += [f"{_mmss(t)} {name}" for name, t in chapters]
    out.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _download_cover(book: Book, cache: Path) -> str | None:
    """Portada del libro para la presentación (si tiene y hay red). Sin ella, la portada es tipográfica."""
    if not book.portada_url.startswith("http"):
        return None
    destino = cache / f"{book.id}.jpg"
    if destino.exists() and destino.stat().st_size > 5_000:
        return str(destino)
    try:
        r = requests.get(book.portada_url, timeout=12, headers={"User-Agent": "MenteFriaVideo/2.0"})
        if r.ok and len(r.content) > 5_000 and r.headers.get("content-type", "").startswith("image/"):
            cache.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(r.content)
            return str(destino)
    except requests.RequestException:
        pass
    return None


def _fetch_photo(book: Book, cache: Path) -> Path | None:
    from .visuals import fetch_backdrop  # solo si se pide: necesita red

    return fetch_backdrop(f"{book.titulo} {book.descripcion} {book.eje}", cache / f"{book.id}.jpg")


def _episode_dir(base: Path, ep: Episode) -> Path:
    return base / ep.key


def process_episode(ep: Episode, book: Book, base: Path, args: argparse.Namespace, tts, photo: Path | None) -> Result:
    """Guion → control de calidad → render. Devuelve qué pasó con el episodio."""
    ep_dir = _episode_dir(base, ep)
    ep_dir.mkdir(parents=True, exist_ok=True)
    export_script_markdown(ep, ep_dir / "guion.md")
    (ep_dir / "script.json").write_text(json.dumps(ep.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")

    issues = lint_episode(ep, book)
    for issue in issues:
        print(f"      {issue}")
    if has_errors(issues):
        return Result(ep.key, ep.title, "error", detail="; ".join(str(i) for i in issues if i.level == "error"))
    if args.script_only:
        return Result(ep.key, ep.title, "guion", duration_s=ep.estimated_seconds)

    huella = {
        "guion": ep.fingerprint(),
        "version": SCRIPT_VERSION,
        "motor": args.engine,
        "voz": args.voice or "",
        "ajustes_voz": [os.getenv("EDGE_RATE", ""), os.getenv("EDGE_PITCH", "")],
        "fotogramas": _assets_stamp(),
        "foto": bool(photo),
    }
    estado_path = ep_dir / "episodio.json"
    video = ep_dir / "video.mp4"
    if not args.force and video.exists() and estado_path.exists():
        try:
            previo = json.loads(estado_path.read_text(encoding="utf-8"))
            if previo.get("huella") == huella:
                return Result(
                    ep.key, ep.title, "sin-cambios", previo.get("duracion_s", 0.0), video=str(video),
                    chapters=[tuple(c) for c in previo.get("capitulos", [])], voices=previo.get("voces", []),
                )
        except ValueError:
            pass

    work = ep_dir / "_work"
    info = render_episode(ep, tts, work, video, voice=args.voice, photo=photo, log=print)
    _write_description(ep, info.chapters, ep_dir / "descripcion.txt")
    estado_path.write_text(
        json.dumps(
            {
                "huella": huella,
                "titulo": ep.title,
                "duracion_s": info.duration_s,
                "capitulos": info.chapters,
                "voces": info.voices,
                "avisos": [str(i) for i in issues],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    if not args.keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return Result(ep.key, ep.title, "ok", info.duration_s, video=str(video), chapters=info.chapters, voices=info.voices)


# ───────────────────────── piezas compartibles (--format compartir) ─────────────────────────

def _dir_compartir(slug: str, args: argparse.Namespace) -> Path:
    return Path(args.out_dir) if args.out_dir else OUTPUT / slug / "compartir" / args.aspecto.replace(":", "x")


SELECCION_TIPOS = "presentacion,libro,recorrido,fondo"  # con --seleccionadas: la pieza del libro (la primera que haya) y la larga de cada lección elegida
PIEZA_DE_LIBRO = ("presentacion", "recorrido", "libro")  # por orden de preferencia


def piezas_seleccionadas(book: Book, piezas: list[K.Pieza]) -> list[K.Pieza]:
    """Del plan, las del libro (un solo vídeo, el de la primera clase que haya) y las de sus lecciones elegidas."""
    quiero = SEL.elegidas(book) | {0}
    piezas = [p for p in piezas if p.leccion_n in quiero]
    del_libro = [t for t in PIEZA_DE_LIBRO if any(p.tipo == t for p in piezas)][:1]
    return [p for p in piezas if p.leccion_n != 0 or p.tipo in del_libro]


def _tipos(args: argparse.Namespace) -> tuple[str, ...]:
    por_defecto = SELECCION_TIPOS if getattr(args, "seleccionadas", False) else ",".join(K.TIPOS)
    pedidos = [t.strip() for t in (args.piezas or por_defecto).split(",") if t.strip()]
    malos = [t for t in pedidos if t not in K.TIPOS]
    if malos:
        raise SystemExit(f"Tipo de pieza desconocido: {', '.join(malos)} (usa {', '.join(K.TIPOS)})")
    return tuple(pedidos)


def _filtra_plan(plan: K.Plan, args: argparse.Namespace) -> K.Plan:
    """`--max-seg` y `--excluir`: las piezas que no pasan el filtro quedan anotadas como omitidas, con su motivo."""
    tope = getattr(args, "max_seg", None)
    temas = [T.norm(t.strip()) for t in (getattr(args, "excluir", None) or "").split(",") if t.strip()]
    if not tope and not temas:
        return plan
    quedan: list[K.Pieza] = []
    omitidas = list(plan.omitidas)
    for p in plan.piezas:
        # Todo lo que se oye y todo lo que se ve (una tarjeta de esquema no se lee en voz alta, pero sale).
        visto = [t for s in p.scenes for _, t in _textos_de_vista(s.view)] + [" ".join(s.view.get("words") or []) for s in p.scenes]
        texto = T.norm(" ".join([*(s.narration for s in p.scenes), *visto, p.titulo_pub, p.descripcion_pub]))
        tema = next((t for t in temas if re.search(rf"(?<![a-z0-9ñ]){re.escape(t)}", texto)), None)
        if tope and p.estimated_seconds > tope:
            omitidas.append(K.Omitida(p.tipo, p.leccion_n, p.title, f"dura ~{p.estimated_seconds:.0f} s, más de los {tope:.0f} s pedidos con --max-seg"))
        elif tema:
            omitidas.append(K.Omitida(p.tipo, p.leccion_n, p.title, f"habla de «{tema}», excluido con --excluir"))
        else:
            quedan.append(p)
    return K.Plan(quedan, omitidas, K.orden_sugerido(quedan))


def publicados(args: argparse.Namespace) -> int:
    """Registro de vídeos subidos (`tools/video/publicados.csv`) → índice de la web (`datos/videos.json`)."""
    from . import publicados as P

    registro, indice = VIDEO_DIR / "publicados.csv", REPO_ROOT / "datos" / "videos.json"
    recuento, avisos = P.actualizar(registro, indice, OUTPUT, args.aspecto.replace(":", "x"))
    for a in avisos:
        print(f"  [aviso] {a}")
    print(f"Registro: {recuento['filas']} piezas, {recuento['con_enlace']} con enlace → {registro}")
    print(f"Índice de la web: {recuento['publicados']} vídeos publicados → {indice}")
    return 0


def calendario(args: argparse.Namespace) -> int:
    """Calendario de publicación entre libros: reparte las piezas ya renderizadas de todos los libros, una por turno,
    alternando ejes y sin poner seguidas dos del mismo libro. Dentro de cada libro respeta el orden de su manifiesto."""
    import datetime

    carpeta = args.aspecto.replace(":", "x")
    colas: list[dict[str, Any]] = []
    for mf in sorted(OUTPUT.glob(f"*/compartir/{carpeta}/manifiesto.json")):
        try:
            datos = json.loads(mf.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(datos, dict) or not isinstance(datos.get("piezas"), list):
            continue  # un manifiesto con otra forma no detiene el calendario
        piezas = [
            dict(x, libro=datos.get("titulo"), autor=datos.get("autor"), eje=datos.get("eje"), carpeta=str(mf.parent.relative_to(OUTPUT)), duracion_s=float(x.get("duracion_s") or 0))
            for x in datos["piezas"]
            if isinstance(x, dict) and x.get("clave") and (x.get("video") or args.todas)
        ]
        if piezas:
            colas.append({"titulo": datos.get("titulo"), "eje": datos.get("eje") or "", "piezas": piezas})
    if not colas:
        print(f"No hay manifiestos en {OUTPUT}/*/compartir/{carpeta}/. Genera antes las piezas de algún libro con --format compartir.")
        return 1
    # Los libros se ordenan alternando ejes (un libro de cada eje por vuelta) y se va tomando una pieza de cada uno.
    por_eje: dict[str, list[dict[str, Any]]] = {}
    for c in colas:
        por_eje.setdefault(c["eje"], []).append(c)
    ronda: list[dict[str, Any]] = []
    while any(por_eje.values()):
        for eje in sorted(por_eje):
            if por_eje[eje]:
                ronda.append(por_eje[eje].pop(0))
    try:
        dia = datetime.date.fromisoformat(args.desde) if args.desde else None
    except ValueError:
        print(f"Fecha no válida en --desde: {args.desde!r} (usa AAAA-MM-DD).")
        return 1
    salida: list[dict[str, Any]] = []
    while any(c["piezas"] for c in ronda):
        for c in ronda:
            if c["piezas"]:
                salida.append(c["piezas"].pop(0))
    filas = ["| n.º | día | libro | pieza | tipo | duración | título de publicación |", "|---|---|---|---|---|---|---|"]
    for n, x in enumerate(salida):
        fecha = (dia + datetime.timedelta(days=n // max(1, args.por_dia))).isoformat() if dia else f"día {n // max(1, args.por_dia) + 1}"
        x.update({"n": n + 1, "dia": fecha})
        filas.append(f"| {n + 1} | {fecha} | {x['libro']} | `{x['carpeta']}/{x['clave']}` | {x.get('tipo', '')} | {x['duracion_s']:.0f} s | {x.get('titulo', '')} |")
    base = OUTPUT / f"calendario-compartir-{carpeta}"
    base.with_suffix(".json").write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    base.with_suffix(".md").write_text("\n".join([f"# Calendario de publicación · {args.aspecto}", "", f"{len(salida)} piezas de {len(ronda)} libros · {args.por_dia} al día", "", *filas]) + "\n", encoding="utf-8")
    print(f"Calendario: {len(salida)} piezas de {len(ronda)} libros → {base.with_suffix('.md')}")
    return 0


def process_pieza(p: K.Pieza, book: Book, base: Path, args: argparse.Namespace, tts) -> Result:
    """Guion → control de calidad → render de una pieza compartible."""
    from . import compartir_frames as CF
    from .lint import lint_pieza
    from .renderer import RenderStyle

    p_dir = base / p.key
    p_dir.mkdir(parents=True, exist_ok=True)
    (p_dir / "guion.md").write_text(K.guion_markdown(p), encoding="utf-8")
    (p_dir / "script.json").write_text(json.dumps(p.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    (p_dir / "publicacion.txt").write_text(K.texto_publicacion(p), encoding="utf-8")
    (p_dir / "publicacion.json").write_text(json.dumps(K.textos_por_red(p), ensure_ascii=False, indent=2), encoding="utf-8")

    issues = lint_pieza(p, book)
    for issue in issues:
        print(f"      {issue}")
    if has_errors(issues):
        return Result(p.key, p.title, "error", detail="; ".join(str(i) for i in issues if i.level == "error"))
    if args.script_only:
        return Result(p.key, p.title, "guion", duration_s=p.estimated_seconds)

    motivo = K.motivo_libro(book)
    huella = {
        "guion": p.fingerprint(),
        "version": [SCRIPT_VERSION, K.COMPARTIR_VERSION],
        "motor": args.engine,
        "voz": args.voice or "",
        "ajustes_voz": [os.getenv("EDGE_RATE", ""), os.getenv("EDGE_PITCH", "")],
        "fotogramas": _assets_stamp(CF.dependencias()),
        "aspecto": args.aspecto,
        "montaje": 9,  # 7: las frases de una a tres palabras se dicen tras una frase de apoyo en español · 4: el esquema se dibuja y el texto entra con barrido · sube cuando cambia cómo se monta (2: se recorta el silencio final de cada locución · 3: empuje entre secciones)
        "motivo": motivo,
    }
    if getattr(args, "sonidos", True):
        huella["sonidos"] = 1
    estado_path = p_dir / "pieza.json"
    video = p_dir / "video.mp4"
    if not args.force and video.exists() and estado_path.exists():
        try:
            previo = json.loads(estado_path.read_text(encoding="utf-8"))
            if previo.get("huella") == huella:
                return Result(p.key, p.title, "sin-cambios", previo.get("duracion_s", 0.0), video=str(video), voices=previo.get("voces", []))
        except ValueError:
            pass

    ancho, alto = K.ASPECTOS[args.aspecto]
    estilo = RenderStyle(
        width=ancho, height=alto, burn_subs=False, lead_in_s=0.15, fade_scene_s=0.26, fade_beat_s=0.0,
        progress_color=CF.acento_eje(book.eje), extra_deps=CF.dependencias(), trim_tail_s=0.12, push_s=0.36, reveal_s=0.42, reveal_text_s=0.13, move_s=0.45, sfx=bool(getattr(args, "sonidos", True)),
    )
    work = p_dir / "_work"
    info = render_episode(
        p, tts, work, video, voice=args.voice, log=print, style=estilo,
        pages=CF.pieza_pages(p, args.aspecto, motivo), thumb_page=CF.portada_html(p, args.aspecto, motivo), tweens=CF.pieza_movimientos(p, args.aspecto, motivo),
    )
    (p_dir / "publicacion.txt").write_text(K.texto_publicacion(p, info.duration_s), encoding="utf-8")
    estado_path.write_text(
        json.dumps({"huella": huella, "titulo": p.title, "tipo": p.tipo, "duracion_s": info.duration_s, "voces": info.voices, "avisos": [str(i) for i in issues]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if not args.keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return Result(p.key, p.title, "ok", info.duration_s, video=str(video), voices=info.voices)


def process_compartir(book: Book, args: argparse.Namespace, only_lesson: int | None = None) -> list[Result]:
    """Las piezas compartibles de un libro (o de una de sus lecciones) y su manifiesto de publicación."""
    base = _dir_compartir(book.slug, args)
    base.mkdir(parents=True, exist_ok=True)
    if getattr(args, "seguir", None):
        K.ROTULOS["seguir"] = args.seguir.strip()  # el rótulo del cierre (no se lee): la cuenta o dónde seguir
    plan = _filtra_plan(K.plan_libro(book, _tipos(args), solo_leccion=only_lesson, breve=bool(getattr(args, "breve", False))), args)
    piezas = plan.piezas
    if getattr(args, "seleccionadas", False) and only_lesson is None:
        # Un vídeo del libro y los de sus lecciones elegidas (tools/video/seleccion.csv): el resto no se produce.
        piezas = piezas_seleccionadas(book, piezas)
        plan = K.Plan(piezas, plan.omitidas, K.orden_sugerido(piezas))  # el manifiesto cuenta solo lo elegido
    if args.only and only_lesson is None:
        quiero = _numeros(args.only)  # 0 = la pieza del libro, 1…N = las de esa lección
        piezas = [p for p in piezas if p.leccion_n in quiero]

    tts = None
    if not args.script_only:
        tts = get_tts_engine(engine=args.engine, voice=args.voice, gemini_model=args.gemini_model)
        if args.engine != "mudo":
            tts = CachedTTS(tts, OUTPUT / "_cache" / "voz" / args.engine)

    print(f"\n«{book.titulo}»" + (f" — {book.autor}" if book.autor else "") + f" · {len(piezas)} piezas compartibles ({args.aspecto}) · {len(plan.omitidas)} sin material")
    resultados: list[Result] = []
    for i, p in enumerate(piezas, start=1):
        print(f"  [{i}/{len(piezas)}] {p.key} · ~{p.estimated_seconds:.0f} s")
        t0 = time.time()
        try:
            r = process_pieza(p, book, base, args, tts)
        except Exception as exc:  # una pieza que falla no detiene la tanda
            if args.debug:
                traceback.print_exc()
            r = Result(p.key, p.title, "error", detail=f"{type(exc).__name__}: {exc}")
        resultados.append(r)
        marca = {"ok": "✓", "sin-cambios": "↷", "guion": "✎", "error": "✗"}[r.status]
        extra = f" {r.duration_s:.0f} s en {time.time() - t0:.0f} s" if r.status == "ok" else (f" — {r.detail}" if r.detail else "")
        print(f"      {marca} {r.status}{extra}")
    if only_lesson is None and not args.only:
        _write_manifiesto(book, plan, resultados, base, args)
    return resultados


def _write_manifiesto(book: Book, plan: K.Plan, resultados: list[Result], base: Path, args: argparse.Namespace) -> None:
    """Manifiesto del libro: todas las piezas en el orden de publicación sugerido, su estado y lo que no ha salido."""
    por_clave = {r.key: r for r in resultados}
    piezas = {p.key: p for p in plan.piezas}
    items: list[dict[str, Any]] = []
    filas = ["| n.º | pieza | tipo | duración | título de publicación |", "|---|---|---|---|---|"]
    for n, clave in enumerate(plan.orden, start=1):
        p = piezas[clave]
        r = por_clave.get(clave)
        video = base / clave / "video.mp4"
        dur = r.duration_s if r and r.duration_s else 0.0
        if not dur and (base / clave / "pieza.json").exists():
            try:
                dur = json.loads((base / clave / "pieza.json").read_text(encoding="utf-8")).get("duracion_s", 0.0)
            except ValueError:
                dur = 0.0
        # Un vídeo antiguo en disco no cuenta si la pieza acaba de dar error: ya no corresponde a su guion.
        hecho = video.exists() and not (r and r.status in ("error", "guion"))
        items.append(
            {
                "orden": n, "clave": clave, "tipo": p.tipo, "arco": p.arco, "leccion": p.leccion_n, "leccion_id": p.lesson_id,
                "titulo": p.titulo_pub, "gancho": p.gancho, "etiquetas": p.etiquetas_pub,
                "video": f"{clave}/video.mp4" if hecho else None, "subtitulos": f"{clave}/video.srt" if hecho else None,
                "miniatura": f"{clave}/miniatura.png" if hecho else None, "publicacion": f"{clave}/publicacion.txt",
                "duracion_s": dur or p.estimated_seconds, "duracion_estimada": not dur,
                "estado": (r.status if r else ("ok" if hecho else "pendiente")), "detalle": (r.detail if r else ""),
            }
        )
        filas.append(f"| {n} | `{clave}` | {p.tipo} | {items[-1]['duracion_s']:.0f} s | {p.titulo_pub} |")
    datos = {
        "libro_id": book.id, "titulo": book.titulo, "autor": book.autor, "eje": book.eje,
        "formato": "compartir", "aspecto": args.aspecto, "motivo": K.motivo_libro(book),
        "tipos": list(_tipos(args)), "breve": bool(getattr(args, "breve", False)), "seleccionadas": bool(getattr(args, "seleccionadas", False)), "filtros": {"max_seg": getattr(args, "max_seg", None), "excluir": getattr(args, "excluir", None)},
        "voces": sorted({v for r in resultados for v in r.voices}),
        "piezas": items,
        "omitidas": [{"tipo": o.tipo, "leccion": o.leccion_n, "titulo": o.titulo, "motivo": o.motivo} for o in plan.omitidas],
        "completa": bool(items) and all(i["video"] for i in items),
        "duracion_total_s": round(sum(i["duracion_s"] for i in items), 1),
    }
    (base / "manifiesto.json").write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    md = [f"# {book.titulo}" + (f" — {book.autor}" if book.autor else ""), "", f"{len(items)} piezas · {datos['duracion_total_s'] / 60:.1f} min · {args.aspecto} · orden de publicación sugerido", "", *filas]
    if plan.omitidas:
        md += ["", "## Sin material", ""] + [f"- {o.tipo} · {o.titulo}: {o.motivo}" for o in plan.omitidas]
    (base / "manifiesto.md").write_text("\n".join(md) + "\n", encoding="utf-8")


def _numeros(only: str) -> set[int]:
    """«0,3-5,99» → {0, 3, 4, 5, 99}."""
    quiero: set[int] = set()
    for trozo in only.split(","):
        trozo = trozo.strip()
        if "-" in trozo:
            a, b = trozo.split("-", 1)
            quiero.update(range(int(a), int(b) + 1))
        elif trozo:
            quiero.add(int(trozo))
    return quiero


def _select(episodes: list[Episode], only: str | None) -> list[Episode]:
    """`--only 0,3-5,99`: 0 = presentación, 1…N = lecciones, 99 = repaso."""
    if not only:
        return episodes
    quiero = _numeros(only)

    def numero(ep: Episode) -> int:
        return ep.number if ep.kind == "leccion" else (0 if ep.kind == "presentacion" else 99)

    return [ep for ep in episodes if numero(ep) in quiero]


def process_book(book: Book, args: argparse.Namespace, only_lesson: int | None = None) -> list[Result]:
    """Genera la serie de un libro (o solo una de sus lecciones) y deja `serie.json` y `lista.m3u`."""
    if args.format == "compartir":
        return process_compartir(book, args, only_lesson)
    base = Path(args.out_dir) if args.out_dir else OUTPUT / book.slug / args.format
    base.mkdir(parents=True, exist_ok=True)
    cache = OUTPUT / "_cache"

    cover = _download_cover(book, cache / "portadas") if only_lesson is None else None
    photo = _fetch_photo(book, cache / "fondos") if args.photos and not args.script_only else None
    serie = book_series(book, args.format, with_quiz=not args.no_quiz, cover_path=cover)
    if only_lesson is not None:
        episodios = [ep for ep in serie if ep.kind == "leccion" and ep.number == only_lesson + 1]
    else:
        episodios = _select(serie, args.only)

    tts = None
    if not args.script_only:
        tts = get_tts_engine(engine=args.engine, voice=args.voice, gemini_model=args.gemini_model)
        if args.engine != "mudo":  # el silencio no merece caché
            tts = CachedTTS(tts, cache / "voz" / args.engine)

    print(f"\n«{book.titulo}»" + (f" — {book.autor}" if book.autor else "") + f" · {len(book.lessons)} lecciones · formato {args.format}")
    resultados: list[Result] = []
    for i, ep in enumerate(episodios, start=1):
        print(f"  [{i}/{len(episodios)}] {ep.key} · ~{ep.estimated_seconds / 60:.1f} min")
        t0 = time.time()
        try:
            r = process_episode(ep, book, base, args, tts, photo)
        except Exception as exc:  # un episodio que falla no detiene la serie
            if args.debug:
                traceback.print_exc()
            r = Result(ep.key, ep.title, "error", detail=f"{type(exc).__name__}: {exc}")
        resultados.append(r)
        marca = {"ok": "✓", "sin-cambios": "↷", "guion": "✎", "error": "✗"}[r.status]
        extra = f" {r.duration_s / 60:.1f} min en {time.time() - t0:.0f} s" if r.status == "ok" else (f" — {r.detail}" if r.detail else "")
        print(f"      {marca} {r.status}{extra}")

    voces = sorted({v for r in resultados for v in r.voices})
    if len(voces) > 1:
        print(f"  ! La serie mezcla voces ({'; '.join(voces)}). Para una voz única, fija --engine y --voice y repite con --force.")

    if only_lesson is None and not args.script_only:
        _write_series(book, serie, resultados, base, args, voces)
        if args.merge:
            _merge_book(book, serie, base)
    return resultados


def _write_series(book: Book, serie: list[Episode], resultados: list[Result], base: Path, args: argparse.Namespace, voces: list[str]) -> None:
    """Manifiesto de la serie (todos los episodios, hechos o no) y lista de reproducción en orden."""
    por_clave = {r.key: r for r in resultados}
    items: list[dict[str, Any]] = []
    m3u = ["#EXTM3U"]
    for ep in serie:
        ep_dir = _episode_dir(base, ep)
        video = ep_dir / "video.mp4"
        r = por_clave.get(ep.key)
        dur = r.duration_s if r and r.duration_s else 0.0
        if not dur and (ep_dir / "episodio.json").exists():
            try:
                dur = json.loads((ep_dir / "episodio.json").read_text(encoding="utf-8")).get("duracion_s", 0.0)
            except ValueError:
                dur = 0.0
        hecho = video.exists()
        items.append(
            {
                "clave": ep.key,
                "tipo": ep.kind,
                "numero": ep.number,
                "titulo": ep.title,
                "leccion_id": ep.lesson_id,
                "video": f"{ep.key}/video.mp4" if hecho else None,
                "duracion_s": dur,
                "estado": (r.status if r else ("ok" if hecho else "pendiente")),
                "detalle": (r.detail if r else ""),
            }
        )
        if hecho:
            m3u += [f"#EXTINF:{int(round(dur))},{ep.title}", f"{ep.key}/video.mp4"]
    (base / "serie.json").write_text(
        json.dumps(
            {
                "libro_id": book.id,
                "titulo": book.titulo,
                "autor": book.autor,
                "eje": book.eje,
                "formato": args.format,
                "voces": voces,
                "episodios": items,
                "completa": all(i["video"] for i in items),
                "duracion_total_s": round(sum(i["duracion_s"] for i in items), 1),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (base / "lista.m3u").write_text("\n".join(m3u) + "\n", encoding="utf-8")


def _merge_book(book: Book, serie: list[Episode], base: Path) -> None:
    partes = [(ep.title, _episode_dir(base, ep) / "video.mp4") for ep in serie]
    faltan = [name for name, p in partes if not p.exists()]
    if faltan:
        print(f"  ! No se une el libro completo: faltan {len(faltan)} episodios ({faltan[0]}…).")
        return
    out = base / "libro-completo.mp4"
    chapters = merge_videos(partes, out, book.titulo, book.autor)
    (base / "libro-completo.txt").write_text(
        "\n".join([book.titulo + (f" — {book.autor}" if book.autor else ""), "", "Capítulos"] + [f"{_mmss(t)} {n}" for n, t in chapters]) + "\n",
        encoding="utf-8",
    )
    print(f"  ✓ Libro completo: {out}")


def _summary(resultados: list[Result]) -> int:
    ok = sum(r.status == "ok" for r in resultados)
    igual = sum(r.status == "sin-cambios" for r in resultados)
    guion = sum(r.status == "guion" for r in resultados)
    err = [r for r in resultados if r.status == "error"]
    total = sum(r.duration_s for r in resultados if r.status in ("ok", "sin-cambios"))
    print(f"\nResumen: {ok} renderizados · {igual} sin cambios · {guion} solo guion · {len(err)} con error · {total / 60:.1f} min de vídeo")
    for r in err:
        print(f"  ✗ {r.key}: {r.detail}")
    return 1 if err else 0


def _sample_voices(book: Book, index: int, args: argparse.Namespace) -> int:
    from .scriptwriter import lesson_episode

    ep = lesson_episode(book, index, "clase" if args.format == "compartir" else args.format)
    muestra = next(s.speech for s in ep.scenes if s.kind == "idea")
    tts = get_tts_engine(engine=args.engine, voice=args.voice, gemini_model=args.gemini_model)
    out = OUTPUT / book.slug / "muestras" / args.engine
    print(f"Muestra: «{muestra[:90]}…»")
    for v in tts.sample_voices():
        res = tts.synthesize(muestra, out / f"muestra_{v}.mp3", voice=v)
        print(f"  ✓ {v} ({res.engine_name}, {res.duration_s:.1f} s) → {res.audio_path}")
    print(f"\nEscúchalas en {out} y repite con --voice <nombre>.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument("--format", choices=[*FORMATS, "compartir"], default="clase", help="clase: lección completa (3-5 min). corto: 60-90 s para redes. compartir: piezas sueltas que se entienden fuera de la web (1-2 min con su explicación; «a fondo», 2-4 min).")
    comun.add_argument("--piezas", default=None, help="(compartir) Tipos de pieza, separados por comas: idea, pregunta, practica, caso, libro, fondo. Por defecto, todos.")
    comun.add_argument("--imagenes-propuestas", action="store_true", help="(compartir) Previsualiza también las imágenes libres aún sin aprobar de tools/video/imagenes/. Solo para revisarlas: no publiques esos vídeos.")
    comun.add_argument("--iconos-propuestos", action="store_true", help="(compartir) Previsualiza también los iconos por pieza aún sin aprobar de tools/video/iconos/. Solo para revisarlos: no publiques esos vídeos.")
    comun.add_argument("--sin-sonidos", dest="sonidos", action="store_false", help="(compartir) Sin los efectos de sonido sintetizados (cambio de sección, piezas del esquema, cuenta atrás), que van por defecto.")
    comun.add_argument("--sonidos", dest="sonidos", action="store_true", help=argparse.SUPPRESS)  # compatibilidad: ya es lo de siempre
    comun.add_argument("--breve", action="store_true", help="(compartir) Versión de 30-60 s: la idea sin la explicación del cuerpo y el matiz en su primera frase.")
    comun.add_argument("--aspecto", choices=list(K.ASPECTOS), default="9:16", help="(compartir) 9:16 (por defecto), 1:1 o 16:9.")
    comun.add_argument("--seleccionadas", action="store_true", help="(compartir) Solo las piezas del libro y las de sus lecciones elegidas en tools/video/seleccion.csv (orden «seleccion»).")
    comun.add_argument("--max-seg", type=float, default=None, help="(compartir) No genera las piezas que duren (estimado) más de estos segundos; quedan anotadas en el manifiesto.")
    comun.add_argument("--excluir", default=None, help="(compartir) Temas que no deben salir, separados por comas (p. ej. «trading,inversión»): se omite la pieza cuya locución los nombre.")
    comun.add_argument("--seguir", default=None, help="(compartir) Texto del rótulo del cierre: la cuenta o dónde seguir (p. ej. «Sigue a @mentefria»). No se lee en voz alta.")
    comun.add_argument("--engine", choices=["edge", "kokoro", "mudo", "gemini", "auto"], default=None, help="Motor de voz. edge (por defecto): gratis, sin clave. kokoro: local y gratis. mudo: previsualización sin voz. gemini/auto: de pago, con clave.")
    comun.add_argument("--voice", default=None, help="Voz (Aoede, Charon… en Gemini; es-ES-AlvaroNeural… en Edge).")
    comun.add_argument("--ritmo", default=None, help="(edge) Velocidad de la voz: -8%% (por defecto), +0%%, +5%%…")
    comun.add_argument("--tono", default=None, help="(edge) Tono de la voz: -2Hz (por defecto), +0Hz…")
    comun.add_argument("--gemini-model", default=None, choices=["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"])
    comun.add_argument("--script-only", action="store_true", help="Solo guion (guion.md, script.json) y control de calidad; sin voz ni vídeo.")
    comun.add_argument("--no-quiz", action="store_true", help="Lecciones sin la pregunta de repaso.")
    comun.add_argument("--photos", action="store_true", help="Fondo fotográfico (Wikimedia) en portadas y cierres. Es ambiente, no contenido.")
    comun.add_argument("--force", action="store_true", help="Renderiza aunque el episodio no haya cambiado.")
    comun.add_argument("--keep-work", action="store_true", help="Conserva la carpeta _work de cada episodio (para depurar).")
    comun.add_argument("--out-dir", default=None, help="Carpeta de salida (por defecto tools/video/output/<libro>/<formato>).")
    comun.add_argument("--debug", action="store_true", help="Muestra la traza completa de los errores.")

    parser = argparse.ArgumentParser(prog="python -m tools.video.cli", description="Vídeos didácticos 9:16 a partir del corpus de Mente Fría.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("leccion", parents=[comun], help="Una lección, situada en su libro.")
    p.add_argument("query", help="Título (exacto o parcial) o id de la lección.")
    p.add_argument("--sample-voices", action="store_true", help="Genera muestras de la idea con varias voces para elegir.")

    p = sub.add_parser("libro", parents=[comun], help="Serie completa: presentación + lecciones + repaso.")
    p.add_argument("query", help="Título (exacto o parcial) o id del libro.")
    p.add_argument("--only", default=None, help="Solo estos episodios: 0 = presentación, 1…N = lecciones, 99 = repaso (ej. 0,3-5,99). Con --format compartir: 0 = la pieza del libro, 1…N = las piezas de esa lección.")
    p.add_argument("--merge", action="store_true", help="Une además todos los episodios en libro-completo.mp4, con capítulos.")

    p = sub.add_parser("calendario", help="(compartir) Calendario de publicación con las piezas ya generadas de todos los libros.")
    p.add_argument("--aspecto", choices=list(K.ASPECTOS), default="9:16")
    p.add_argument("--por-dia", type=int, default=1, help="Piezas por día (por defecto 1).")
    p.add_argument("--desde", default=None, help="Fecha de la primera pieza (AAAA-MM-DD). Sin ella, «día 1», «día 2»…")
    p.add_argument("--todas", action="store_true", help="Incluye también las piezas planificadas que aún no tienen vídeo.")

    p = sub.add_parser("seleccion", help="(compartir) Propone qué lecciones de cada libro llevan vídeo y lo anota en tools/video/seleccion.csv (lo decidido a mano se conserva).")
    p.add_argument("libros", nargs="*", help="Título o id de cada libro. Sin ninguno, toda la biblioteca.")

    p = sub.add_parser("publicados", help="(compartir) Pone al día el registro de vídeos subidos a YouTube y el índice que lee la web.")
    p.add_argument("--aspecto", choices=list(K.ASPECTOS), default="9:16")

    p = sub.add_parser("biblioteca", parents=[comun], help="Recorre la biblioteca y genera las series que faltan.")
    p.add_argument("--eje", default=None, help="Solo libros de este eje (texto parcial: «Psicología», «Economía»…).")
    p.add_argument("--limit", type=int, default=3, help="Cuántos libros como máximo en esta ejecución (por defecto 3).")
    p.add_argument("--merge", action="store_true", help="Une cada libro en libro-completo.mp4.")
    p.add_argument("--list", action="store_true", help="Solo muestra qué libros faltan; no genera nada.")
    p.set_defaults(only=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    _load_env()
    argv = list(sys.argv[1:] if argv is None else argv)
    # Compatibilidad con la orden antigua: `cli "<título>"` y `cli "<libro>" --book`.
    if argv and argv[0] not in COMMANDS and argv[0] not in ("-h", "--help"):
        if "--book" in argv:
            argv.remove("--book")
            argv.insert(0, "libro")
        else:
            argv.insert(0, "leccion")
    args = build_parser().parse_args(argv)
    if args.command == "calendario":
        return calendario(args)
    if args.command == "publicados":
        return publicados(args)
    if args.command == "seleccion":
        books = [load_book(q) for q in args.libros] if args.libros else [load_book_by_row(f) for f in list_book_rows()]
        c = SEL.anotar(books)
        print(f"Selección: {c['libros']} libros, {c['propuestas']} lecciones propuestas de {c['lecciones']} · {c['decididas']} decididas a mano → {SEL.CSV}")
        return 0
    if not args.engine:  # sin --engine: TTS_ENGINE o el motor gratuito por defecto
        args.engine = (os.getenv("TTS_ENGINE") or DEFAULT_ENGINE).strip().lower()
    if getattr(args, "format", "") == "compartir" and args.engine == "edge":
        # Las piezas compartibles tienen su voz: elegida de oído entre once gratuitas, a su ritmo y tono naturales.
        args.voice = args.voice or os.getenv("EDGE_VOICE") or K.VOZ_EDGE
        args.ritmo = args.ritmo or os.getenv("EDGE_RATE") or K.RITMO_EDGE
        args.tono = args.tono or os.getenv("EDGE_PITCH") or K.TONO_EDGE
    if getattr(args, "imagenes_propuestas", False):
        os.environ["IMAGENES_PROPUESTAS"] = "1"
        K.IM.catalogo(recargar=True)
    if getattr(args, "iconos_propuestos", False):
        os.environ["ICONOS_PROPUESTOS"] = "1"
        K.iconos_de_piezas(recargar=True)
    for opcion, variable in (("ritmo", "EDGE_RATE"), ("tono", "EDGE_PITCH")):
        if getattr(args, opcion, None):
            os.environ[variable] = getattr(args, opcion)
    if not hasattr(args, "merge"):
        args.merge = False
    if not hasattr(args, "only"):
        args.only = None

    if args.command == "leccion":
        book, index = find_lesson(args.query)
        if args.sample_voices:
            return _sample_voices(book, index, args)
        return _summary(process_book(book, args, only_lesson=index))

    if args.command == "libro":
        return _summary(process_book(load_book(args.query), args))

    # biblioteca
    filas = list_book_rows(args.eje)
    pendientes = []
    for fila in filas:
        slug = T.slugify(T.clean(fila.get("titulo")))
        serie_json = (_dir_compartir(slug, args) / "manifiesto.json") if args.format == "compartir" else OUTPUT / slug / args.format / "serie.json"
        completa = False
        if serie_json.exists() and not args.force:
            try:
                previo = json.loads(serie_json.read_text(encoding="utf-8"))
                completa = bool(previo.get("completa"))
                if completa and args.format == "compartir":
                    # …y si se hizo con los mismos tipos de pieza que ahora se piden (o más).
                    completa = set(_tipos(args)) <= set(previo.get("tipos") or []) and bool(previo.get("breve")) == bool(getattr(args, "breve", False)) and (bool(getattr(args, "seleccionadas", False)) or not previo.get("seleccionadas"))
            except (ValueError, AttributeError):
                completa = False
        if not completa:
            pendientes.append(fila)
    print(f"Biblioteca: {len(filas)} libros públicos · {len(filas) - len(pendientes)} con serie completa · {len(pendientes)} pendientes")
    if args.list:
        for fila in pendientes[:60]:
            print(f"  · {fila.get('titulo')} — {fila.get('autor') or '—'} [{fila.get('eje_principal') or fila.get('eje') or ''}]")
        if len(pendientes) > 60:
            print(f"  … y {len(pendientes) - 60} más")
        return 0
    todos: list[Result] = []
    for fila in pendientes[: max(0, args.limit)]:
        try:
            todos += process_book(load_book_by_row(fila), args)
        except Exception as exc:  # un libro que falla no detiene la biblioteca
            if args.debug:
                traceback.print_exc()
            todos.append(Result(T.slugify(T.clean(fila.get("titulo"))), str(fila.get("titulo")), "error", detail=f"{type(exc).__name__}: {exc}"))
    return _summary(todos)


if __name__ == "__main__":
    raise SystemExit(main())
