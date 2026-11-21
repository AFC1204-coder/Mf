"""Montaje: une fotogramas, voz y subtítulos de un episodio en un MP4 vertical (1080×1920).

La línea de tiempo la manda la voz: cada escena dura lo que su locución (más una pausa para
asimilar) y cada cambio en pantalla entra en la palabra que lo nombra. El vídeo se arma como una
lista de imágenes fijas con su duración (con fundidos precalculados) y una sola pasada de ffmpeg.
"""

from __future__ import annotations

import array
import hashlib
import shutil
import subprocess
import wave
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .frames import HEIGHT, WIDTH, State, episode_pages, render_frames
from .scriptwriter import Episode
from .tts.base import TTSEngine, WordTiming

FPS = 30
SAMPLE_RATE = 48000
FONTS_DIR = Path(__file__).resolve().parent / "assets" / "fonts"

LEAD_IN_S = 0.35  # silencio antes de la primera palabra
FADE_SCENE_S = 0.40  # fundido entre escenas
FADE_BEAT_S = 0.24  # fundido cuando aparece un elemento dentro de la escena
FADE_STEP_S = 1 / 15  # resolución de los fundidos
SUB_Y = 1390  # franja de subtítulos (debajo del escenario)
SUB_H = 260


@dataclass
class RenderStyle:
    """Cómo se monta un formato. Los valores por defecto son los del formato «clase»."""

    width: int = WIDTH
    height: int = HEIGHT
    burn_subs: bool = True  # barra de subtítulos quemada (las piezas compartibles llevan el texto en el propio fotograma)
    lead_in_s: float = LEAD_IN_S
    fade_scene_s: float = FADE_SCENE_S
    fade_beat_s: float = FADE_BEAT_S
    progress_color: str = ""
    trim_tail_s: float | None = None  # si se da: el silencio que el motor deja tras la última palabra se recorta a esto  # «#rrggbb»: barra de progreso continua arriba (vacío = sin barra)
    extra_deps: list[Path] = field(default_factory=list)  # estilos propios, para la huella de los fotogramas


@dataclass
class SceneTiming:
    start_s: float
    speech_s: float  # duración de la voz (0 si la escena no tiene)
    total_s: float  # voz + pausa, o el silencio fijado
    words: list[tuple[str, float, float]] = field(default_factory=list)  # (palabra mostrada, inicio, fin) relativos


@dataclass
class RenderInfo:
    video: Path
    duration_s: float
    chapters: list[tuple[str, float]]  # (sección, segundo de inicio)
    voices: list[str]
    frames: int
    thumbnail: Path | None = None


# ───────────────────────── audio ─────────────────────────

def _decode_pcm(audio_path: Path) -> bytes:
    """Cualquier audio → PCM 16 bits mono a 48 kHz (para sumar duraciones con exactitud de muestra)."""
    res = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(audio_path), "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1"],
        capture_output=True,
        check=True,
    )
    return res.stdout


def _silence(seconds: float) -> bytes:
    return b"\x00\x00" * max(0, int(round(seconds * SAMPLE_RATE)))


def align_words(tokens: list[str], timings: list[WordTiming], duration_s: float) -> list[tuple[str, float, float]]:
    """Asigna a cada palabra del texto mostrado su tramo de audio.

    Si el motor devuelve una marca por palabra, se usan tal cual; si no cuadran (el motor parte o
    une palabras, o el texto para la voz lleva algún cambio), se interpolan sobre las marcas.
    """
    if not tokens:
        return []
    if not timings:
        paso = duration_s / len(tokens)
        return [(t, round(i * paso, 3), round((i + 1) * paso, 3)) for i, t in enumerate(tokens)]
    if len(timings) == len(tokens):
        return [(t, w.start_s, max(w.end_s, w.start_s + 0.04)) for t, w in zip(tokens, timings)]
    n, m = len(tokens), len(timings)
    out: list[tuple[str, float, float]] = []
    for i, t in enumerate(tokens):
        a = timings[min(m - 1, int(i * m / n))]
        b = timings[min(m - 1, max(int(i * m / n), int((i + 1) * m / n) - 1))]
        out.append((t, a.start_s, max(b.end_s, a.start_s + 0.04)))
    return out


def _spoken_tokens(narration: str) -> tuple[list[str], list[int]]:
    """Palabras que se pronuncian (las rayas sueltas no) y, para cada token del texto, su posición entre ellas."""
    hablados: list[str] = []
    mapa: list[int] = []
    for tok in narration.split():
        if any(ch.isalnum() for ch in tok):
            mapa.append(len(hablados))
            hablados.append(tok)
        else:
            mapa.append(max(0, len(hablados) - 1))
            if hablados:
                hablados[-1] = f"{hablados[-1]} {tok}"  # la raya no suena, pero se ve junto a su palabra
    return hablados, mapa


# ───────────────────────── subtítulos ─────────────────────────

def _font(filename: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS_DIR / filename), size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


Chunk = tuple[float, float, list[tuple[str, float, float]]]


def build_subtitle_chunks(timings: list[SceneTiming]) -> list[Chunk]:
    """Bloques de 3-4 palabras que nunca cruzan el final de una frase, con el tiempo de cada palabra."""
    chunks: list[Chunk] = []
    for st in timings:
        if not st.words:
            continue
        absolutas = [(w, st.start_s + a, st.start_s + b) for w, a, b in st.words]
        grupos: list[list[tuple[str, float, float]]] = []
        cur: list[tuple[str, float, float]] = []
        chars = 0
        for item in absolutas:
            largo = len(item[0]) + 1
            if cur and (len(cur) >= 4 or chars + largo > 26):
                grupos.append(cur)
                cur, chars = [item], len(item[0])
            else:
                cur.append(item)
                chars += largo
            if item[0].rstrip("\"'»”)").endswith((".", "!", "?", "…")):
                grupos.append(cur)
                cur, chars = [], 0
        if cur:
            grupos.append(cur)
        fin_voz = st.start_s + st.speech_s
        for i, g in enumerate(grupos):
            inicio = g[0][1]
            fin = grupos[i + 1][0][1] if i + 1 < len(grupos) else min(fin_voz + 0.25, st.start_s + st.total_s)
            chunks.append((round(inicio, 3), round(max(inicio + 0.25, fin), 3), g))
    return chunks


def _fmt_srt_time(sec: float) -> str:
    ms_total = int(round(max(0.0, sec) * 1000))
    h, resto = divmod(ms_total, 3_600_000)
    m, resto = divmod(resto, 60_000)
    s, ms = divmod(resto, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _split_balanced(frase: list[tuple[str, float, float]], max_words: int = 14) -> list[list[tuple[str, float, float]]]:
    """Parte una frase larga en trozos parecidos, cortando en una coma si hay una cerca."""
    n = len(frase)
    if n <= max_words:
        return [frase]
    partes = -(-n // max_words)
    trozos: list[list[tuple[str, float, float]]] = []
    inicio = 0
    for k in range(1, partes):
        ideal = round(k * n / partes)
        candidatos = [j for j in range(max(inicio + 3, ideal - 3), min(n - 2, ideal + 3)) if frase[j - 1][0].rstrip("\"'»”)").endswith((",", ";", ":"))]
        corte = min(candidatos, key=lambda j: abs(j - ideal)) if candidatos else ideal
        if corte <= inicio:
            continue
        trozos.append(frase[inicio:corte])
        inicio = corte
    trozos.append(frase[inicio:])
    return trozos


def write_srt(timings: list[SceneTiming], out_srt: Path) -> Path:
    """Subtítulos por frase (para subir junto al vídeo): más legibles que los de 3-4 palabras."""
    lines: list[str] = []
    n = 0
    for st in timings:
        frase: list[tuple[str, float, float]] = []
        for i, item in enumerate(st.words):
            frase.append(item)
            if item[0].rstrip("\"'»”)").endswith((".", "!", "?", "…")) or i == len(st.words) - 1:
                for trozo in _split_balanced(frase):
                    n += 1
                    ini = st.start_s + trozo[0][1]
                    fin = st.start_s + trozo[-1][2]
                    lines += [str(n), f"{_fmt_srt_time(ini)} --> {_fmt_srt_time(max(fin, ini + 0.4))}", " ".join(w for w, _, _ in trozo), ""]
                frase = []
    out_srt.write_text("\n".join(lines), encoding="utf-8")
    return out_srt


def _subtitle_track(chunks: list[Chunk], total_s: float, sub_dir: Path) -> Path:
    """Pista de subtítulos con la palabra activa resaltada: una imagen por palabra, unidas con `concat`."""
    if sub_dir.exists():
        shutil.rmtree(sub_dir)
    sub_dir.mkdir(parents=True)
    f_sub = _font("Outfit-Regular.ttf", 54, 700)
    medida = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    blank = sub_dir / "blank.png"
    Image.new("RGBA", (WIDTH, SUB_H), (0, 0, 0, 0)).save(blank, compress_level=1)

    entries: list[tuple[Path, float]] = []
    cursor = 0.0
    n = 0
    for start, end, words in chunks:
        if start > cursor + 0.04:
            entries.append((blank, start - cursor))
            cursor = start
        texto = " ".join(w[0] for w in words)
        tb = medida.textbbox((0, 0), texto, font=f_sub)
        total_w, text_h = tb[2] - tb[0], tb[3] - tb[1]
        box_w = min(WIDTH - 80, total_w + 68)
        box_h = max(86, text_h + 40)
        bx0, by0 = (WIDTH - box_w) // 2, (SUB_H - box_h) // 2
        avances = [medida.textbbox((0, 0), w[0] + " ", font=f_sub)[2] for w in words]
        for i, (_, w_start, _) in enumerate(words):
            seg_start = max(cursor, w_start if i > 0 else cursor)
            seg_end = words[i + 1][1] if i + 1 < len(words) else end
            seg_dur = max(0.06, seg_end - seg_start)
            n += 1
            png = sub_dir / f"sub_{n:05d}.png"
            im = Image.new("RGBA", (WIDTH, SUB_H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(im)
            draw.rounded_rectangle([bx0, by0, bx0 + box_w, by0 + box_h], radius=24, fill=(10, 10, 10, 238), outline=(62, 62, 62, 255), width=2)
            x = (WIDTH - total_w) // 2
            y = by0 + (box_h - 56) // 2 - 4
            for j, (tok, _, _) in enumerate(words):
                draw.text((x, y), tok, font=f_sub, fill=(232, 197, 106, 255) if j == i else (237, 232, 223, 255))
                x += avances[j]
            im.save(png, compress_level=1)
            entries.append((png, seg_dur))
            cursor += seg_dur
    if total_s > cursor + 0.02:
        entries.append((blank, total_s - cursor))
    return _write_concat(entries, sub_dir / "subs.txt")


def _write_concat(entries: list[tuple[Path, float]], out_txt: Path) -> Path:
    lines: list[str] = []
    for p, d in entries:
        lines.append(f"file '{p.resolve().as_posix()}'")
        lines.append(f"duration {d:.4f}")
    if entries:
        lines.append(f"file '{entries[-1][0].resolve().as_posix()}'")  # el demuxer necesita repetir el último
    out_txt.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_txt


# ───────────────────────── imagen ─────────────────────────

def _blend_frames(a: Path, b: Path, steps: int, blend_dir: Path) -> list[Path]:
    """Fotogramas intermedios de un fundido de `a` a `b` (se guardan y se reutilizan)."""
    clave = hashlib.sha256(f"{a.name}|{b.name}|{steps}".encode()).hexdigest()[:16]
    outs = [blend_dir / f"b_{clave}_{i}.png" for i in range(steps)]
    if all(p.exists() for p in outs):
        return outs
    blend_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(a) as ia, Image.open(b) as ib:
        ia, ib = ia.convert("RGB"), ib.convert("RGB")
        for i, p in enumerate(outs):
            Image.blend(ia, ib, (i + 1) / (steps + 1)).save(p, compress_level=1)
    return outs


def _video_entries(
    cuts: list[tuple[float, Path, bool]],
    total_s: float,
    blend_dir: Path,
    fade_scene_s: float = FADE_SCENE_S,
    fade_beat_s: float = FADE_BEAT_S,
) -> list[tuple[Path, float]]:
    """De una lista de cortes (segundo, imagen, ¿cambia de escena?) a imágenes con duración, con fundidos."""
    entries: list[tuple[Path, float]] = []
    for i, (t0, png, new_scene) in enumerate(cuts):
        t1 = cuts[i + 1][0] if i + 1 < len(cuts) else total_s
        slot = t1 - t0
        if slot <= 0:
            continue
        fade = 0.0
        if i > 0 and cuts[i - 1][1] != png:
            fade = fade_scene_s if new_scene else fade_beat_s
            if slot < fade + 0.2:
                fade = 0.0
        if fade:
            steps = max(2, int(round(fade / FADE_STEP_S)))
            for b in _blend_frames(cuts[i - 1][1], png, steps, blend_dir):
                entries.append((b, fade / steps))
        entries.append((png, slot - fade))
    return entries


# ───────────────────────── episodio ─────────────────────────

def _chapters_file(chapters: list[tuple[str, float]], total_s: float, episode: Episode, out: Path) -> Path:
    def esc(v: str) -> str:
        return "".join("\\" + c if c in "=;#\\\n" else c for c in v)

    lines = [";FFMETADATA1", f"title={esc(episode.title)}", f"album={esc(episode.book_title)}"]
    if episode.book_author:
        lines.append(f"artist={esc(episode.book_author)}")
    if episode.number:
        lines.append(f"track={episode.number}/{episode.total}")
    for i, (name, start) in enumerate(chapters):
        end = chapters[i + 1][1] if i + 1 < len(chapters) else total_s
        lines += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={int(start * 1000)}", f"END={int(end * 1000)}", f"title={esc(name)}"]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def render_episode(
    episode: Episode,
    tts: TTSEngine,
    work_dir: Path,
    out_mp4: Path,
    frames_dir: Path | None = None,
    voice: str | None = None,
    photo: Path | None = None,
    log=print,
    style: RenderStyle | None = None,
    pages: tuple[list[State], list[str]] | None = None,
    thumb_page: str | None = None,
) -> RenderInfo:
    """Renderiza un episodio completo. Devuelve duración, capítulos (para la descripción) y voces usadas.

    `style`, `pages` y `thumb_page` permiten montar otro formato (las piezas compartibles) con la misma
    línea de tiempo: otro tamaño, otros fotogramas, sin barra de subtítulos y con miniatura propia.
    """
    style = style or RenderStyle()
    work_dir.mkdir(parents=True, exist_ok=True)
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    frames_dir = frames_dir or (work_dir / "frames")
    size = (style.width, style.height)

    # 1 · Fotogramas.
    states, docs = pages if pages is not None else episode_pages(episode, photo)
    todos = render_frames(docs + ([thumb_page] if thumb_page else []), frames_dir, size=size, extra_deps=style.extra_deps)
    pngs = todos[: len(docs)]
    log(f"      ✓ {len(set(pngs))} fotogramas")

    # 2 · Voz, escena a escena, y línea de tiempo.
    pcm = bytearray(_silence(style.lead_in_s))
    timings: list[SceneTiming] = []
    voices: list[str] = []
    cursor = style.lead_in_s
    audio_dir = work_dir / "audio"
    for i, scene in enumerate(episode.scenes):
        if scene.narration:
            res = tts.synthesize(scene.speech, audio_dir / f"escena_{i + 1:02d}.mp3", voice=voice)
            datos = _decode_pcm(res.audio_path)
            if style.trim_tail_s is not None and res.word_timings:
                # Edge deja ~1 s de silencio tras la última palabra, que se suma a la pausa del guion: en un vídeo
                # corto son segundos de aire muerto. La pausa la manda el guion (pause_after_s), no el motor.
                fin = int((max(w.end_s for w in res.word_timings) + style.trim_tail_s) * SAMPLE_RATE) * 2
                datos = datos[: max(2, min(len(datos), fin))]
            speech_s = len(datos) / 2 / SAMPLE_RATE
            etiqueta = f"{res.engine_name} · {res.voice}"
            if etiqueta not in voices:
                voices.append(etiqueta)
            hablados, _ = _spoken_tokens(scene.narration)
            palabras = align_words(hablados, res.word_timings, speech_s)
            total = speech_s + scene.pause_after_s
            pcm += datos + _silence(scene.pause_after_s)
            timings.append(SceneTiming(cursor, speech_s, total, palabras))
        else:
            total = scene.hold_s + scene.pause_after_s
            pcm += _silence(total)
            timings.append(SceneTiming(cursor, 0.0, total, []))
        cursor += timings[-1].total_s
    # La duración real es la del audio (las pausas se redondean a muestras).
    total_s = len(pcm) / 2 / SAMPLE_RATE
    log(f"      ✓ locución: {total_s / 60:.1f} min [{', '.join(voices) or 'sin voz'}]")

    # 3 · Cuándo entra cada estado.
    cuts: list[tuple[float, Path, bool]] = []
    for st, png in zip(states, pngs):
        scene = episode.scenes[st.scene_index]
        tm = timings[st.scene_index]
        es_inicio = st.at_word == 0 and st.at_s == 0.0
        if es_inicio:
            t = 0.0 if st.scene_index == 0 else tm.start_s
        elif st.at_s is not None:
            t = tm.start_s + st.at_s
        else:
            _, mapa = _spoken_tokens(scene.narration)
            pos = mapa[min(len(mapa) - 1, max(0, st.at_word or 0))] if mapa else 0
            t = tm.start_s + (tm.words[min(pos, len(tm.words) - 1)][1] if tm.words else 0.0)
        t = min(max(t, cuts[-1][0] if cuts else 0.0), max(0.0, tm.start_s + tm.total_s - 0.12))
        cuts.append((t, png, es_inicio))

    blend_dir = work_dir / "fundidos"
    video_txt = _write_concat(_video_entries(cuts, total_s, blend_dir, style.fade_scene_s, style.fade_beat_s), work_dir / "video.txt")

    # 4 · Capítulos: dónde empieza cada sección del índice.
    chapters: list[tuple[str, float]] = []
    con_seccion = [i for i, s in enumerate(episode.scenes) if s.section]
    for i, (scene, tm) in enumerate(zip(episode.scenes, timings)):
        nombre = scene.section or ("Inicio" if (not con_seccion or i < con_seccion[0]) else "Cierre")
        if not chapters or chapters[-1][0] != nombre:
            chapters.append((nombre, 0.0 if not chapters else round(tm.start_s, 2)))

    # 5 · Subtítulos y audio.
    chunks = build_subtitle_chunks(timings)
    write_srt(timings, out_mp4.with_suffix(".srt"))
    wav = work_dir / "locucion.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(pcm))
    con_voz = any(array.array("h", bytes(pcm[: 2 * SAMPLE_RATE * 30])))  # el motor «mudo» no se normaliza
    meta = _chapters_file(chapters, total_s, episode, work_dir / "capitulos.txt")

    # 6 · Mezcla final.
    # Entradas: 0 fotogramas · 1 locución · 2 metadatos · (3 subtítulos, si se queman).
    audio_filter = "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]" if con_voz else "[1:a]anull[a]"
    entradas = ["-f", "concat", "-safe", "0", "-i", str(video_txt), "-i", str(wav), "-f", "ffmetadata", "-i", str(meta)]
    video_filter = f"[0:v]fps={FPS},format=yuv420p[v0]"
    ultimo = "v0"
    if style.burn_subs:
        subs_txt = _subtitle_track(chunks, total_s, work_dir / "subs")
        entradas += ["-f", "concat", "-safe", "0", "-i", str(subs_txt)]
        video_filter += f";[{ultimo}][3:v]overlay=0:{SUB_Y}:eof_action=pass[v1]"
        ultimo = "v1"
    if style.progress_color:
        # Barra de progreso continua: lo único que se mueve entre corte y corte (el vídeo no parece una diapositiva).
        color = "0x" + style.progress_color.lstrip("#")
        video_filter += (
            f";color=c={color}:s={style.width}x10:r={FPS}[pb];"
            f"[{ultimo}][pb]overlay=x='-W+W*t/{total_s:.3f}':y=0:shortest=0:eof_action=pass[v2]"
        )
        ultimo = "v2"
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        *entradas,
        "-filter_complex", f"{video_filter};{audio_filter}",
        "-map", f"[{ultimo}]", "-map", "[a]", "-map_metadata", "2", "-map_chapters", "2",
        "-t", f"{total_s:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart",
        str(out_mp4),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not out_mp4.exists():
        raise RuntimeError(f"ffmpeg falló al montar {out_mp4.name}: {res.stderr.strip()[-600:]}")

    thumb = out_mp4.with_name("miniatura.png")
    # La miniatura es la portada (título y lugar en la serie), no el gancho que la precede.
    if thumb_page:
        portada = todos[-1]
    else:
        portada = next((png for st, png in zip(states, pngs) if episode.scenes[st.scene_index].kind in ("portada", "libro")), pngs[0])
    shutil.copyfile(portada, thumb)
    return RenderInfo(out_mp4, round(total_s, 2), chapters, voices, len(set(pngs)), thumb)


def probe_duration(path: Path) -> float:
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(res.stdout.strip())


def merge_videos(parts: list[tuple[str, Path]], out_mp4: Path, title: str, author: str = "") -> list[tuple[str, float]]:
    """Une los episodios en un solo vídeo del libro (sin recodificar) con un capítulo por episodio."""
    work = out_mp4.parent / "_unir"
    work.mkdir(parents=True, exist_ok=True)
    chapters: list[tuple[str, float]] = []
    cursor = 0.0
    lista = []
    for name, p in parts:
        chapters.append((name, round(cursor, 2)))
        cursor += probe_duration(p)
        lista.append(f"file '{p.resolve().as_posix()}'")
    (work / "lista.txt").write_text("\n".join(lista) + "\n", encoding="utf-8")

    def esc(v: str) -> str:
        return "".join("\\" + c if c in "=;#\\\n" else c for c in v)

    meta = [";FFMETADATA1", f"title={esc(title)}"] + ([f"artist={esc(author)}"] if author else [])
    for i, (name, start) in enumerate(chapters):
        end = chapters[i + 1][1] if i + 1 < len(chapters) else cursor
        meta += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={int(start * 1000)}", f"END={int(end * 1000)}", f"title={esc(name)}"]
    (work / "capitulos.txt").write_text("\n".join(meta) + "\n", encoding="utf-8")
    res = subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0", "-i", str(work / "lista.txt"),
            "-f", "ffmetadata", "-i", str(work / "capitulos.txt"),
            "-map", "0", "-map_metadata", "1", "-map_chapters", "1",
            "-c", "copy", "-movflags", "+faststart", str(out_mp4),
        ],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg falló al unir el libro: {res.stderr.strip()[-500:]}")
    shutil.rmtree(work, ignore_errors=True)
    return chapters
