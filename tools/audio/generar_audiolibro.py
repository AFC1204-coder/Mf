"""Genera los MP3 de todas las lecciones de un libro en Supabase (modo audiolibro)."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from tools.video.tts import get_tts_engine

REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIO_DIR = Path(__file__).resolve().parent
VIDEO_ENV = REPO_ROOT / "tools" / "video" / ".env"


def _load_env() -> None:
    for candidate in (AUDIO_DIR / ".env", VIDEO_ENV, REPO_ROOT / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def _slugify(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()[:60] or "libro"


def _sb_get(path: str) -> list[dict]:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env")
    r = requests.get(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=20,
    )
    if not r.ok:
        raise RuntimeError(f"Error Supabase ({r.status_code}): {r.text[:250]}")
    return r.json()


def _clean_for_tts(text: str) -> str:
    t = re.sub(r"<[^>]+>", " ", text or "")
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"\*(.+?)\*", r"\1", t)
    t = re.sub(r"`(.+?)`", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"\(\s*ej\.?\s*:\s*([^)]+)\)", r", por ejemplo, \1", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _chunk_text(text: str, max_chars: int = 1800) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    cur = ""
    for s in sentences:
        if cur and len(cur) + len(s) + 1 > max_chars:
            chunks.append(cur.strip())
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        chunks.append(cur.strip())
    return chunks


def _compress_speech_mp3(inputs: list[Path], out_mp3: Path) -> float:
    """Une los fragmentos (si hay varios) y comprime a MP3 hablado mono 64 kbps."""
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    if len(inputs) == 1:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(inputs[0]), "-ac", "1", "-ar", "24000", "-b:a", "64k", str(out_mp3)],
            capture_output=True,
            check=True,
        )
    else:
        cmd = ["ffmpeg", "-y"]
        parts = []
        for idx, p in enumerate(inputs):
            cmd.extend(["-i", str(p)])
            parts.append(f"[{idx}:a]")
        fc = "".join(parts) + f"concat=n={len(inputs)}:v=0:a=1[aout]"
        cmd.extend(["-filter_complex", fc, "-map", "[aout]", "-ac", "1", "-ar", "24000", "-b:a", "64k", str(out_mp3)])
        subprocess.run(cmd, capture_output=True, check=True)

    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(out_mp3)],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(res.stdout.strip())


def main(argv: list[str] | None = None) -> int:
    _load_env()
    parser = argparse.ArgumentParser(
        prog="python -m tools.audio.generar_audiolibro",
        description="Genera los MP3 de todas las lecciones activas de un libro de Mente Fría.",
    )
    parser.add_argument("book", help="Título (exacto o parcial) o UUID del libro en Supabase.")
    parser.add_argument("--engine", choices=["auto", "gemini", "edge"], default="edge", help="Motor TTS (por defecto: edge para lotes rápidos sin cuota).")
    parser.add_argument("--voice", default=None, help="Voz (ej. es-ES-AlvaroNeural, es-ES-ElviraNeural, Charon).")
    parser.add_argument("--merge", action="store_true", help="Crea también un único audiolibro_completo.mp3.")
    args = parser.parse_args(argv)

    q = args.book.strip()
    if re.match(r"^[0-9a-fA-F-]{36}$", q):
        books = _sb_get(f"libros?id=eq.{q}&select=id,titulo,autor&limit=1")
    else:
        books = _sb_get(f"libros?titulo=eq.{quote(q, safe='')}&select=id,titulo,autor&limit=1")
        if not books:
            books = _sb_get(f"libros?titulo=ilike.{quote(f'*{q}*', safe='')}&select=id,titulo,autor&limit=3")
    if not books:
        raise LookupError(f"Libro no encontrado: {q!r}")

    book = books[0]
    lessons = _sb_get(
        f"lecciones?libro_id=eq.{book['id']}&activa=eq.true&select=id,titulo,orden,cuerpo,aplicacion_practica&order=orden.asc"
    )
    if not lessons:
        raise LookupError(f"El libro {book['titulo']!r} no tiene lecciones activas.")

    out_dir = AUDIO_DIR / "output" / _slugify(book["titulo"])
    tmp_dir = out_dir / "_tmp"
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    tts = get_tts_engine(engine=args.engine, voice=args.voice)
    print(f"Libro: {book['titulo']} ({book.get('autor', '')}) — {len(lessons)} lecciones")
    print(f"Motor: {args.engine} · Voz: {args.voice or tts.default_voice()}")

    manifest_items = []
    m3u_lines = ["#EXTM3U"]
    total_dur = 0.0
    total_bytes = 0

    for idx, lec in enumerate(lessons, start=1):
        out_mp3 = out_dir / f"{idx:02d}_{lec['id']}.mp3"
        parts = [f"Lección {idx}: {lec['titulo']}."]
        if lec.get("cuerpo"):
            parts.append(_clean_for_tts(lec["cuerpo"]))
        full_text = "\n\n".join(parts)

        chunks = _chunk_text(full_text, max_chars=1800 if args.engine != "edge" else 6000)
        chunk_paths: list[Path] = []
        used_engine = ""
        used_voice = ""
        for c_idx, ch in enumerate(chunks, start=1):
            if args.engine != "edge" and (idx > 1 or c_idx > 1):
                time.sleep(1.5)
            cp = tmp_dir / f"{idx:02d}_{c_idx:02d}.mp3"
            res = tts.synthesize(ch, cp, voice=args.voice)
            chunk_paths.append(res.audio_path)
            used_engine = res.engine_name
            used_voice = res.voice

        dur = _compress_speech_mp3(chunk_paths, out_mp3)
        size_b = out_mp3.stat().st_size
        total_dur += dur
        total_bytes += size_b
        print(f"  ✓ {idx:02d}/{len(lessons)} {lec['titulo'][:48]} — {dur:.0f} s ({size_b // 1024} KB) [{used_engine} · {used_voice}]")

        manifest_items.append({
            "orden": idx,
            "id": lec["id"],
            "titulo": lec["titulo"],
            "archivo": out_mp3.name,
            "duracion_s": round(dur, 1),
            "bytes": size_b,
            "motor": used_engine,
            "voz": used_voice,
        })
        m3u_lines.append(f"#EXTINF:{int(round(dur))},{idx:02d}. {lec['titulo']}")
        m3u_lines.append(out_mp3.name)

    (out_dir / "audiolibro.m3u").write_text("\n".join(m3u_lines) + "\n", encoding="utf-8")
    (out_dir / "manifest.json").write_text(
        json.dumps(
            {
                "libro_id": book["id"],
                "titulo": book["titulo"],
                "autor": book.get("autor", ""),
                "lecciones": len(manifest_items),
                "duracion_total_s": round(total_dur, 1),
                "tamano_total_mb": round(total_bytes / (1024 * 1024), 2),
                "items": manifest_items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if args.merge:
        merged = out_dir / "audiolibro_completo.mp3"
        _compress_speech_mp3([out_dir / it["archivo"] for it in manifest_items], merged)
        print(f"  ✓ Audiolibro completo: {merged}")

    print(f"\nListo: {len(manifest_items)} MP3 · {total_dur/60:.1f} min · {total_bytes/(1024*1024):.2f} MB en {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
