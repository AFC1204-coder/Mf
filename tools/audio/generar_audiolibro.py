"""Audiolibro de Mente Fría: un MP3 por lección, con la misma voz que los vídeos, y el índice que lee la web.

Cada audio dice, en este orden y sin reescribir nada:

  1. «Lección N: <título>.»            (fórmula fija + el título de la lección)
  2. el cuerpo de la lección, entero, párrafo a párrafo
  3. «El matiz.» + la autocorrección    (si la lección la tiene: la idea sin su límite exagera)

Salida:
  - `audio/<id de la lección>.mp3`      lo que reproduce la app (48 kbps mono, con título, autor y libro en las etiquetas)
  - `datos/audios.json`                 índice: por lección, duración, huella del texto y huella de la receta de voz
  - `tools/audio/output/<libro>/`       lista `.m3u`, `manifest.json` y, con `--merge`, el libro en un solo MP3

La huella del texto (`h`) se calcula igual aquí y en `lib/audio.js`: si la lección cambia después de grabarla, la app
deja de usar ese audio (ya no dice lo mismo que el texto) hasta que se vuelva a generar.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from tools.video import corpus as C
from tools.video import text as T
from tools.video.tts import get_tts_engine

REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIO_DIR = Path(__file__).resolve().parent
SALIDA = REPO_ROOT / "audio"
INDICE = REPO_ROOT / "datos" / "audios.json"

VOZ = "fr-FR-RemyMultilingualNeural"  # la de los vídeos (tools/video/compartir.py, VOZ_EDGE)
ROTULO_MATIZ = "El matiz."  # el mismo rótulo que dicen los vídeos
RECETA = 1  # súbelo al cambiar qué se dice o cómo se monta: obliga a regenerar
PAUSA_PARRAFO_S, PAUSA_PARTE_S = 0.45, 0.9
VERSION = 1
MAX_CARACTERES = 2500  # por locución; un párrafo más largo se parte por frases enteras


# ───────────────────────── texto (puro) ─────────────────────────


def huella_texto(titulo: str | None, cuerpo: str | None, matiz: str | None) -> str:
    """FNV-1a de 32 bits sobre las unidades UTF-16 de los tres campos tal cual están en el corpus.

    Es la misma cuenta que `AudioLeccion.huella` en `lib/audio.js`: la app la usa para saber si el audio grabado
    sigue correspondiendo al texto que muestra.
    """
    s = f"{titulo or ''}\n{cuerpo or ''}\n{matiz or ''}"
    h = 0x811C9DC5
    datos = s.encode("utf-16-le")
    for i in range(0, len(datos), 2):
        h ^= datos[i] | (datos[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def huella_receta(voz: str, ajustes: str = "", con_matiz: bool = True) -> str:
    """Lo que cambia el sonido sin cambiar el texto: voz, ritmo y tono, y la receta de montaje."""
    raw = json.dumps([RECETA, voz, ajustes, con_matiz], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:6]


def _titulo_dicho(orden: int, titulo: str) -> str:
    t = T.for_speech(titulo)
    return f"Lección {orden}: {t}" + ("" if t[-1:] in ".!?…" else ".")


def _trozos(parrafo: str, maximo: int = MAX_CARACTERES) -> list[str]:
    """Un párrafo en locuciones de tamaño razonable, cortando solo entre frases."""
    if len(parrafo) <= maximo:
        return [parrafo]
    trozos, actual = [], ""
    for frase in T.split_sentences(parrafo):
        if actual and len(actual) + len(frase) + 1 > maximo:
            trozos.append(actual)
            actual = frase
        else:
            actual = f"{actual} {frase}".strip()
    return trozos + ([actual] if actual else [])


def partes_de_leccion(orden: int, titulo: str, cuerpo: str, matiz: str = "", con_matiz: bool = True) -> list[list[str]]:
    """Lo que se dice, por partes (título · cuerpo · matiz) y, dentro de cada una, por locuciones.

    Solo texto del corpus pasado por `for_speech` (que no quita ni añade palabras con significado) más las dos
    fórmulas fijas: «Lección N:» y «El matiz.».
    """
    partes = [[_titulo_dicho(orden, titulo)]]
    cuerpo_dicho = [t for p in T.paragraphs(cuerpo) for t in _trozos(T.for_speech(p)) if t]
    if cuerpo_dicho:
        partes.append(cuerpo_dicho)
    m = [t for p in T.paragraphs(matiz) for t in _trozos(T.for_speech(p)) if t] if con_matiz else []
    if m:
        partes.append([ROTULO_MATIZ] + m)
    return partes


# ───────────────────────── audio ─────────────────────────


def _duracion(mp3: Path) -> float:
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(mp3)],
        capture_output=True, text=True, check=True,
    )
    return float(res.stdout.strip())


def montar(partes: list[list[Path]], out_mp3: Path, etiquetas: dict[str, str] | None = None) -> float:
    """Une las locuciones con una pausa corta entre párrafos y una más larga entre partes. MP3 mono de 48 kbps."""
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    cmd, filtros, entradas = ["ffmpeg", "-v", "error", "-y"], [], []
    n = 0
    for i, parte in enumerate(partes):
        for j, p in enumerate(parte):
            cmd += ["-i", str(p)]
            ultima = i == len(partes) - 1 and j == len(parte) - 1
            pausa = 0.0 if ultima else (PAUSA_PARTE_S if j == len(parte) - 1 else PAUSA_PARRAFO_S)
            filtros.append(f"[{n}:a]aresample=24000,aformat=channel_layouts=mono,apad=pad_dur={pausa}[a{n}]")
            entradas.append(f"[a{n}]")
            n += 1
    filtros.append("".join(entradas) + f"concat=n={n}:v=0:a=1[out]")
    cmd += ["-filter_complex", ";".join(filtros), "-map", "[out]", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k"]
    for k, v in (etiquetas or {}).items():
        cmd += ["-metadata", f"{k}={v}"]
    subprocess.run(cmd + [str(out_mp3)], check=True)
    return _duracion(out_mp3)


def unir(mp3s: list[Path], out_mp3: Path) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.writelines(f"file '{p.resolve()}'\n" for p in mp3s)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f.name, "-c", "copy", str(out_mp3)], check=True)
    Path(f.name).unlink(missing_ok=True)


# ───────────────────────── índice ─────────────────────────


def leer_indice(ruta: Path = INDICE) -> dict[str, Any]:
    try:
        d = json.loads(ruta.read_text(encoding="utf-8"))
        if isinstance(d, dict) and isinstance(d.get("lecciones"), dict):
            return d
    except (ValueError, OSError):
        pass
    return {"v": VERSION, "base": "audio/", "lecciones": {}}


def escribir_indice(indice: dict[str, Any], ruta: Path = INDICE) -> None:
    indice["v"], indice["base"] = VERSION, indice.get("base") or "audio/"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(indice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def al_dia(entrada: Any, h: str, r: str, mp3: Path) -> bool:
    return isinstance(entrada, dict) and entrada.get("h") == h and entrada.get("r") == r and mp3.is_file() and mp3.stat().st_size > 1000


# ───────────────────────── orden ─────────────────────────


def generar_libro(book: C.Book, tts: Any, voz: str, indice: dict[str, Any], *, con_matiz: bool = True, merge: bool = False, salida: Path = SALIDA) -> dict[str, int]:
    out_dir = AUDIO_DIR / "output" / book.slug
    out_dir.mkdir(parents=True, exist_ok=True)
    r = huella_receta(voz, getattr(tts, "ajustes", lambda: "")(), con_matiz)
    cuenta = {"nuevos": 0, "sin_cambios": 0, "fallidos": 0}
    items, m3u = [], ["#EXTM3U"]
    print(f"\n{book.titulo} ({book.autor}) — {len(book.lessons)} lecciones", flush=True)
    for n, lec in enumerate(book.lessons, start=1):
        mp3 = salida / f"{lec.id}.mp3"
        h = huella_texto(lec.titulo, lec.cuerpo, lec.autocorreccion)
        previa = indice["lecciones"].get(lec.id)
        if al_dia(previa, h, r, mp3):
            cuenta["sin_cambios"] += 1
            dur = float(previa.get("s") or 0)
            print(f"  ↷ {n:02d} {lec.titulo[:60]} — sin cambios", flush=True)
        else:
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    rutas: list[list[Path]] = []
                    for i, parte in enumerate(partes_de_leccion(n, lec.titulo, lec.cuerpo, lec.autocorreccion, con_matiz)):
                        rutas.append([])
                        for j, texto in enumerate(parte):
                            res = tts.synthesize(texto, Path(tmp) / f"{i:02d}-{j:02d}.mp3", voice=voz)
                            rutas[-1].append(res.audio_path)
                    dur = montar(rutas, mp3, {"title": f"{n:02d}. {lec.titulo}", "artist": book.autor, "album": f"{book.titulo} · Mente Fría", "track": str(n)})
            except Exception as exc:  # noqa: BLE001 (una lección que falla no detiene el libro)
                cuenta["fallidos"] += 1
                indice["lecciones"].pop(lec.id, None)
                mp3.unlink(missing_ok=True)
                print(f"  ✗ {n:02d} {lec.titulo[:60]} — {exc}", flush=True)
                continue
            indice["lecciones"][lec.id] = {"s": int(round(dur)), "h": h, "r": r, "b": mp3.stat().st_size}
            cuenta["nuevos"] += 1
            print(f"  ✓ {n:02d} {lec.titulo[:60]} — {dur:.0f} s ({mp3.stat().st_size // 1024} KB)", flush=True)
        items.append({"orden": n, "id": lec.id, "titulo": lec.titulo, "archivo": str(mp3.relative_to(REPO_ROOT)) if mp3.is_relative_to(REPO_ROOT) else str(mp3), "duracion_s": dur})
        m3u += [f"#EXTINF:{int(round(dur))},{n:02d}. {lec.titulo}", str(mp3)]
    (out_dir / "audiolibro.m3u").write_text("\n".join(m3u) + "\n", encoding="utf-8")
    (out_dir / "manifest.json").write_text(
        json.dumps({"libro_id": book.id, "titulo": book.titulo, "autor": book.autor, "voz": voz, "duracion_total_s": round(sum(i["duracion_s"] for i in items), 1), "items": items}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if merge and items and not cuenta["fallidos"]:
        unir([salida / f"{i['id']}.mp3" for i in items], out_dir / "audiolibro_completo.mp3")
        print(f"  ✓ libro completo: {out_dir / 'audiolibro_completo.mp3'}", flush=True)
    return cuenta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m tools.audio.generar_audiolibro",
        description="Genera el audio de las lecciones de uno o varios libros y actualiza datos/audios.json.",
    )
    parser.add_argument("libros", nargs="+", help="Título (exacto o parcial) o id de cada libro.")
    parser.add_argument("--engine", choices=["edge", "auto", "gemini", "kokoro", "mudo"], default="edge")
    parser.add_argument("--voice", default=VOZ, help=f"Voz (por defecto la de los vídeos: {VOZ}).")
    parser.add_argument("--sin-matiz", action="store_true", help="No decir el matiz (la autocorrección) al final de cada lección.")
    parser.add_argument("--merge", action="store_true", help="Además, el libro entero en un solo MP3 (en tools/audio/output/).")
    args = parser.parse_args(argv)

    tts = get_tts_engine(engine=args.engine, voice=args.voice)
    indice = leer_indice()
    total = {"nuevos": 0, "sin_cambios": 0, "fallidos": 0}
    for q in args.libros:
        try:
            book = C.load_book(q)
        except Exception as exc:  # noqa: BLE001 (un libro que no carga no detiene a los demás)
            print(f"\n✗ {q}: {exc}", flush=True)
            total["fallidos"] += 1
            continue
        cuenta = generar_libro(book, tts, args.voice, indice, con_matiz=not args.sin_matiz, merge=args.merge)
        for k, v in cuenta.items():
            total[k] += v
        # Tras cada libro: si la tanda se corta, lo hecho queda registrado. Se vuelve a leer el índice del disco y solo
        # se tocan las lecciones de este libro, para que dos tandas a la vez (libros distintos) no se pisen.
        en_disco = leer_indice()
        for lec in book.lessons:
            if lec.id in indice["lecciones"]:
                en_disco["lecciones"][lec.id] = indice["lecciones"][lec.id]
            else:
                en_disco["lecciones"].pop(lec.id, None)
        indice = en_disco
        escribir_indice(indice)
    seg = sum(int(e.get("s") or 0) for e in indice["lecciones"].values())
    mb = sum(int(e.get("b") or 0) for e in indice["lecciones"].values()) / 1_048_576
    print(f"\nListo: {total['nuevos']} nuevos, {total['sin_cambios']} sin cambios, {total['fallidos']} fallidos. "
          f"En el índice: {len(indice['lecciones'])} lecciones, {seg / 60:.0f} min, {mb:.1f} MB.", flush=True)
    return 1 if total["fallidos"] else 0


if __name__ == "__main__":
    sys.exit(main())
