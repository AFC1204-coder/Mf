"""CLI principal de tools/video: convierte una lección de Mente Fría en vídeo vertical 9:16."""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

from dotenv import load_dotenv

from .infographic import prepare_infographic
from .renderer import assemble_video
from .scriptwriter import export_script_markdown, generate_script
from .supabase_client import fetch_book, fetch_lesson
from .tts import get_tts_engine
from .visuals import fetch_scene_story_shots

VIDEO_DIR = Path(__file__).resolve().parent
REPO_ROOT = VIDEO_DIR.parent.parent


def _load_env() -> None:
    for candidate in (VIDEO_DIR / ".env", REPO_ROOT / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def _slugify(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return slug[:60] or "leccion"


def main(argv: list[str] | None = None) -> int:
    _load_env()

    parser = argparse.ArgumentParser(
        prog="python -m tools.video.cli",
        description="Genera un vídeo vertical (9:16, 60-90 s) a partir de una lección de Mente Fría.",
    )
    parser.add_argument("query", help="ID (UUID) o título (exacto o parcial) de la lección o libro en Supabase.")
    parser.add_argument("--book", action="store_true", help="Fuerza la búsqueda como libro completo (resumen de sus lecciones clave).")
    parser.add_argument("--engine", choices=["auto", "gemini", "edge", "kokoro"], default=None, help="Motor TTS (por defecto: auto).")
    parser.add_argument("--voice", default=None, help="Nombre de la voz (ej. Aoede, Charon, es-ES-AlvaroNeural, es-ES-ElviraNeural).")
    parser.add_argument(
        "--gemini-model",
        default=None,
        choices=["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
        help="Modelo Gemini TTS.",
    )
    parser.add_argument(
        "--sample-voices",
        action="store_true",
        help="Genera muestras de audio de la escena 1 con 3 voces distintas para elegir antes de montar el vídeo.",
    )
    parser.add_argument("--no-gemini-script", action="store_true", help="Genera el guion localmente sin llamar a Gemini.")
    parser.add_argument("--script-only", action="store_true", help="Solo exporta el guion (.md y .json) sin generar audio ni vídeo.")
    parser.add_argument("--out-dir", default=None, help="Directorio de salida (por defecto: tools/video/output/<slug>).")

    args = parser.parse_args(argv)

    print(f"1/5 · Leyendo {'libro' if args.book else 'contenido'} desde Supabase: {args.query!r}...")
    lesson = fetch_book(args.query) if args.book else fetch_lesson(args.query)
    print(f"      ✓ {lesson.titulo} ({lesson.libro_titulo} · {lesson.libro_autor})")

    out_dir = Path(args.out_dir) if args.out_dir else (VIDEO_DIR / "output" / _slugify(lesson.titulo))
    out_dir.mkdir(parents=True, exist_ok=True)
    work_dir = out_dir / "_work"
    work_dir.mkdir(parents=True, exist_ok=True)

    print("2/5 · Generando guion de 5-7 escenas...")
    script = generate_script(lesson, use_gemini=not args.no_gemini_script)
    guion_md = export_script_markdown(script, out_dir / "guion.md")
    (out_dir / "script.json").write_text(json.dumps(script.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      ✓ {len(script.scenes)} escenas · {script.total_words} palabras · ~{script.estimated_seconds:.0f} s -> {guion_md}")

    if args.script_only:
        return 0

    tts = get_tts_engine(engine=args.engine, voice=args.voice, gemini_model=args.gemini_model)

    if args.sample_voices:
        samples_dir = out_dir / "samples"
        samples_dir.mkdir(parents=True, exist_ok=True)
        sample_text = script.scenes[0].narration
        voices = tts.sample_voices()
        print(f"3/5 · Probando {len(voices)} voces en la Escena 1 ({voices})...")
        for v in voices:
            res = tts.synthesize(sample_text, samples_dir / f"muestra_{v}.mp3", voice=v)
            print(f"      ✓ {v} ({res.engine_name}, {res.duration_s:.1f} s) -> {res.audio_path}")
        print(f"\nEscucha las muestras en {samples_dir} y vuelve a ejecutar con --voice <nombre>.")
        return 0

    print("3/5 · Generando locución escena por escena...")
    tts_results = []
    audio_dir = work_dir / "audio"
    for idx, scene in enumerate(script.scenes):
        if idx > 0 and "gemini" in (args.engine or "auto"):
            time.sleep(1.5)
        res = tts.synthesize(scene.narration, audio_dir / f"scene_{scene.index:02d}.mp3", voice=args.voice)
        tts_results.append(res)
        print(f"      ✓ Escena {scene.index}/{len(script.scenes)}: {res.duration_s:.1f} s [{res.engine_name} · {res.voice}]")

    total_audio_s = sum(r.duration_s for r in tts_results)
    print(f"      ✓ Duración total de locución: {total_audio_s:.1f} s")

    print("4/5 · Preparando secuencia visual en formato historia (2 planos por escena)...")
    infographic_png = prepare_infographic(lesson, work_dir / "infographic.png")
    if infographic_png:
        print(f"      ✓ Infografía lista -> {infographic_png}")

    shots_dir = work_dir / "story_shots"
    used_urls: set[str] = set()
    scene_shots: list[list[Path]] = []
    for scene in script.scenes:
        shots = fetch_scene_story_shots(scene, lesson, shots_dir, used_urls, num_shots=2)
        scene_shots.append(shots)
        names = ", ".join(s.name for s in shots) if shots else "fondo Mente Fría (respaldo)"
        print(f"      ✓ Escena {scene.index}/{len(script.scenes)}: {names}")

    print("5/5 · Montando vídeo vertical 9:16 (1080x1920) con subtítulos sincronizados...")
    out_mp4 = out_dir / "video.mp4"
    assemble_video(
        script=script,
        tts_results=tts_results,
        work_dir=work_dir,
        out_mp4=out_mp4,
        scene_shots=scene_shots,
        infographic_png=infographic_png,
    )
    print(f"\nListo:")
    print(f"  Vídeo: {out_mp4}")
    print(f"  Guion: {guion_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
