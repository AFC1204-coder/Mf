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
from .lint import has_errors, lint_episode
from .renderer import merge_videos, render_episode
from .scriptwriter import FORMATS, SCRIPT_VERSION, Episode, book_series, export_script_markdown
from .tts import DEFAULT_ENGINE, get_tts_engine
from .tts.cache import CachedTTS

VIDEO_DIR = Path(__file__).resolve().parent
REPO_ROOT = VIDEO_DIR.parent.parent
OUTPUT = VIDEO_DIR / "output"
COMMANDS = ("leccion", "libro", "biblioteca")


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


def _select(episodes: list[Episode], only: str | None) -> list[Episode]:
    """`--only 0,3-5,99`: 0 = presentación, 1…N = lecciones, 99 = repaso."""
    if not only:
        return episodes
    quiero: set[int] = set()
    for trozo in only.split(","):
        trozo = trozo.strip()
        if "-" in trozo:
            a, b = trozo.split("-", 1)
            quiero.update(range(int(a), int(b) + 1))
        elif trozo:
            quiero.add(int(trozo))

    def numero(ep: Episode) -> int:
        return ep.number if ep.kind == "leccion" else (0 if ep.kind == "presentacion" else 99)

    return [ep for ep in episodes if numero(ep) in quiero]


def process_book(book: Book, args: argparse.Namespace, only_lesson: int | None = None) -> list[Result]:
    """Genera la serie de un libro (o solo una de sus lecciones) y deja `serie.json` y `lista.m3u`."""
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

    ep = lesson_episode(book, index, args.format)
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
    comun.add_argument("--format", choices=FORMATS, default="clase", help="clase: lección completa (3-5 min). corto: 60-90 s para redes.")
    comun.add_argument("--engine", choices=["edge", "kokoro", "mudo", "gemini", "auto"], default=None, help="Motor de voz. edge (por defecto): gratis, sin clave. kokoro: local y gratis. mudo: previsualización sin voz. gemini/auto: de pago, con clave.")
    comun.add_argument("--voice", default=None, help="Voz (Aoede, Charon… en Gemini; es-ES-AlvaroNeural… en Edge).")
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
    p.add_argument("--only", default=None, help="Solo estos episodios: 0 = presentación, 1…N = lecciones, 99 = repaso (ej. 0,3-5,99).")
    p.add_argument("--merge", action="store_true", help="Une además todos los episodios en libro-completo.mp4, con capítulos.")

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
    if not args.engine:  # sin --engine: TTS_ENGINE o el motor gratuito por defecto
        import os

        args.engine = (os.getenv("TTS_ENGINE") or DEFAULT_ENGINE).strip().lower()
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
        serie_json = OUTPUT / T.slugify(T.clean(fila.get("titulo"))) / args.format / "serie.json"
        completa = False
        if serie_json.exists() and not args.force:
            try:
                completa = bool(json.loads(serie_json.read_text(encoding="utf-8")).get("completa"))
            except ValueError:
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
