"""Renderizador de vídeo vertical 9:16 (1080x1920) con la estética de Mente Fría."""

from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .scriptwriter import Scene, VideoScript
from .tts.base import TTSResult, WordTiming

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FONTS_DIR = Path(__file__).resolve().parent / "assets" / "fonts"

EJE_COLORS = {
    "economia": "#c9a84c",
    "economía": "#c9a84c",
    "psicologia": "#9b59b6",
    "psicología": "#9b59b6",
    "filosofia": "#5dade2",
    "filosofía": "#5dade2",
    "neurociencia": "#1abc9c",
    "desarrollo": "#e67e22",
    "historia": "#e74c3c",
    "ciencia": "#00bcd4",
}


def _eje_color(eje: str) -> str:
    key = (eje or "").strip().lower()
    for k, color in EJE_COLORS.items():
        if k in key:
            return color
    return "#c9a84c"


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _font(filename: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS_DIR / filename), size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


def _draw_glow(img: Image.Image, color_hex: str) -> None:
    r, g, b = _hex_to_rgb(color_hex)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = WIDTH // 2, 340
    for radius, alpha in [(520, 14), (360, 18), (220, 22)]:
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            fill=(r, g, b, alpha),
        )
    combined = Image.alpha_composite(img.convert("RGBA"), overlay)
    img.paste(combined.convert("RGB"))


def _wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for w in words:
        candidate = f"{current} {w}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def render_story_hud(
    scene: Scene,
    script: VideoScript,
    total_scenes: int,
    out_png: Path,
    infographic_png: Path | None = None,
) -> Path:
    """Genera una capa RGBA transparente con cabecera Mente Fría, titular e infografía opcional."""
    accent = _eje_color(script.eje)
    hud = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hud)

    f_brand = _font("Outfit-Regular.ttf", 26, 600)
    f_meta = _font("Outfit-Regular.ttf", 24, 500)
    f_tag = _font("Outfit-Regular.ttf", 23, 700)
    f_head = _font("PlayfairDisplay-Bold.ttf", 52, 700)
    f_book = _font("SourceSerif4-Regular.ttf", 26, 400)

    # Cabecera superior
    draw.text((76, 86), "MENTE FRÍA", font=f_brand, fill=(232, 197, 106, 255))
    eje_label = (script.eje or "BIBLIOTECA").upper()[:22]
    draw.text((266, 88), f"·  {eje_label}", font=f_meta, fill=(210, 202, 190, 230))

    counter = f"{scene.index:02d} / {total_scenes:02d}"
    cb = draw.textbbox((0, 0), counter, font=f_meta)
    draw.text((WIDTH - 76 - (cb[2] - cb[0]), 88), counter, font=f_meta, fill=(210, 202, 190, 230))

    # Barra de progreso
    bar_y = 140
    bar_w = WIDTH - 152
    draw.rounded_rectangle([76, bar_y, 76 + bar_w, bar_y + 5], radius=3, fill=(255, 255, 255, 45))
    fill_w = max(24, int(bar_w * (scene.index / total_scenes)))
    r, g, b = _hex_to_rgb(accent)
    draw.rounded_rectangle([76, bar_y, 76 + fill_w, bar_y + 5], radius=3, fill=(r, g, b, 240))

    # Píldora de escena + titular editorial con sombra suave
    tag_text = scene.tag.upper()
    tb = draw.textbbox((0, 0), tag_text, font=f_tag)
    pill_w = (tb[2] - tb[0]) + 42
    pill_x = 76
    pill_y = 195
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + 42],
        radius=21,
        fill=(14, 14, 14, 200),
        outline=(r, g, b, 230),
        width=2,
    )
    draw.text((pill_x + 21, pill_y + 8), tag_text, font=f_tag, fill=(r, g, b, 255))

    lines = _wrap_lines(scene.on_screen, f_head, WIDTH - 152, draw)[:3]
    ty = pill_y + 66
    for i, line in enumerate(lines):
        col = (232, 197, 106, 255) if (scene.kind == "gancho" and i == 0) else (237, 232, 223, 255)
        draw.text((78, ty + 3), line, font=f_head, fill=(0, 0, 0, 175))
        draw.text((76, ty), line, font=f_head, fill=col)
        ty += 64

    # Si esta escena lleva la infografía real de la lección, encajarla limpia en el centro
    if scene.show_infographic and infographic_png and infographic_png.exists():
        with Image.open(infographic_png) as raw_info:
            info = raw_info.convert("RGB")
            info.thumbnail((900, 560), Image.Resampling.LANCZOS)
            iw, ih = info.size
            ix = (WIDTH - iw) // 2
            iy = max(ty + 48, 660)
            mask = Image.new("L", (iw, ih), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw, ih], radius=22, fill=255)
            hud.paste(info, (ix, iy), mask)
            draw.rounded_rectangle([ix - 2, iy - 2, ix + iw + 2, iy + ih + 2], radius=24, outline=(r, g, b, 220), width=2)

    # Crédito discreto al pie (debajo de los subtítulos)
    attr = f"{script.book_title}" + (f" · {script.book_author}" if script.book_author else "")
    ab = draw.textbbox((0, 0), attr[:58], font=f_book)
    draw.text(((WIDTH - (ab[2] - ab[0])) // 2, 1745), attr[:58], font=f_book, fill=(168, 160, 148, 220))

    out_png.parent.mkdir(parents=True, exist_ok=True)
    hud.save(out_png)
    return out_png


def _render_fallback_bg(script: VideoScript, out_jpg: Path) -> Path:
    img = Image.new("RGB", (WIDTH, HEIGHT), "#080808")
    _draw_glow(img, _eje_color(script.eje))
    out_jpg.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_jpg, quality=90)
    return out_jpg
    accent = _eje_color(script.eje)
    img = Image.new("RGB", (WIDTH, HEIGHT), "#080808")
    _draw_glow(img, accent)
    draw = ImageDraw.Draw(img)

    f_brand = _font("Outfit-Regular.ttf", 26, 600)
    f_meta = _font("Outfit-Regular.ttf", 24, 500)
    f_tag = _font("Outfit-Regular.ttf", 24, 700)
    f_book = _font("SourceSerif4-Regular.ttf", 30, 400)

    # Top header
    draw.text((84, 96), "MENTE FRÍA", font=f_brand, fill="#c9a84c")
    eje_label = (script.eje or "BIBLIOTECA").upper()[:22]
    draw.text((280, 98), f"·  {eje_label}", font=f_meta, fill="#a8a094")

    counter = f"{scene.index:02d} / {total_scenes:02d}"
    cb = draw.textbbox((0, 0), counter, font=f_meta)
    draw.text((WIDTH - 84 - (cb[2] - cb[0]), 98), counter, font=f_meta, fill="#a8a094")

    # Progress bar
    bar_y = 154
    bar_w = WIDTH - 168
    draw.rounded_rectangle([84, bar_y, 84 + bar_w, bar_y + 6], radius=3, fill="#222222")
    fill_w = max(24, int(bar_w * (scene.index / total_scenes)))
    draw.rounded_rectangle([84, bar_y, 84 + fill_w, bar_y + 6], radius=3, fill=accent)

    # Main editorial card
    card_top, card_bot = 230, 1340
    draw.rounded_rectangle(
        [72, card_top, WIDTH - 72, card_bot],
        radius=32,
        fill="#111111",
        outline="#222222",
        width=2,
    )
    # Subtle top accent bar inside card
    draw.rounded_rectangle([120, card_top, WIDTH - 120, card_top + 4], radius=2, fill=accent)

    # Scene tag pill
    tag_text = scene.tag.upper()
    tb = draw.textbbox((0, 0), tag_text, font=f_tag)
    pill_w = (tb[2] - tb[0]) + 48
    pill_x = (WIDTH - pill_w) // 2
    pill_y = card_top + 56
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + 48], radius=24, fill="#1c1c1c", outline=accent, width=2)
    draw.text((pill_x + 24, pill_y + 10), tag_text, font=f_tag, fill=accent)

    has_visual = bool(visual_img and visual_img.exists())

    if has_visual and visual_img is not None:
        # Titular arriba + imagen secuencial o infografía centrada + pie de libro
        f_title = _font("PlayfairDisplay-Bold.ttf", 46, 700)
        lines = _wrap_lines(scene.on_screen, f_title, WIDTH - 210, draw)[:3]
        ty = pill_y + 78
        for i, line in enumerate(lines):
            lb = draw.textbbox((0, 0), line, font=f_title)
            color = "#e8c56a" if (scene.kind == "gancho" and i == 0) else "#ede8df"
            draw.text(((WIDTH - (lb[2] - lb[0])) // 2, ty), line, font=f_title, fill=color)
            ty += 58

        img_area_top = max(ty + 28, 520)
        img_area_bot = card_bot - 96
        center_y = (img_area_top + img_area_bot) // 2
        max_h = max(360, img_area_bot - img_area_top - 20)
        _paste_rounded(
            img,
            visual_img,
            box_center_y=center_y,
            max_w=840,
            max_h=min(580, max_h),
            radius=20,
            border_color=accent if scene.show_infographic else "#2e2e2e",
        )

        attr = f"{script.book_title}" + (f" · {script.book_author}" if script.book_author else "")
        ab = draw.textbbox((0, 0), attr[:54], font=f_book)
        draw.text(((WIDTH - (ab[2] - ab[0])) // 2, card_bot - 68), attr[:54], font=f_book, fill="#a8a094")
    else:
        # Big centered statement
        font_size = 66 if len(scene.on_screen) <= 65 else 56
        f_head = _font("PlayfairDisplay-Bold.ttf", font_size, 700)
        lines = _wrap_lines(scene.on_screen, f_head, WIDTH - 230, draw)[:6]
        line_h = int(font_size * 1.28)
        block_h = len(lines) * line_h
        start_y = card_top + ((card_bot - card_top) - block_h) // 2 - 20

        for i, line in enumerate(lines):
            lb = draw.textbbox((0, 0), line, font=f_head)
            lx = (WIDTH - (lb[2] - lb[0])) // 2
            color = "#e8c56a" if (scene.kind == "gancho" and i == 0) else "#ede8df"
            draw.text((lx, start_y + i * line_h), line, font=f_head, fill=color)

        # Divider line
        div_y = start_y + block_h + 44
        if div_y < card_bot - 120:
            draw.rounded_rectangle([WIDTH // 2 - 64, div_y, WIDTH // 2 + 64, div_y + 4], radius=2, fill=accent)

        # Book + author attribution inside card footer
        attr = f"{script.book_title}" + (f" · {script.book_author}" if script.book_author else "")
        attr_lines = textwrap.wrap(attr, width=42)[:2]
        ay = card_bot - 108
        for al in attr_lines:
            ab = draw.textbbox((0, 0), al, font=f_book)
            draw.text(((WIDTH - (ab[2] - ab[0])) // 2, ay), al, font=f_book, fill="#a8a094")
            ay += 38

    out_png.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_png)
    return out_png


def _fmt_srt_time(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms >= 1000:
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _build_subtitle_chunks(
    scene_timings: list[tuple[float, list[WordTiming]]],
) -> list[tuple[float, float, str]]:
    """Agrupa las palabras en frases cortas de 4-5 palabras con tiempos absolutos."""
    chunks_out: list[tuple[float, float, str]] = []
    offset_s = 0.0
    for scene_dur, words in scene_timings:
        if not words:
            offset_s += scene_dur
            continue

        grouped: list[list[WordTiming]] = []
        cur: list[WordTiming] = []
        cur_chars = 0
        for wt in words:
            wlen = len(wt.text) + 1
            if cur and (len(cur) >= 5 or cur_chars + wlen > 30):
                grouped.append(cur)
                cur = [wt]
                cur_chars = len(wt.text)
            else:
                cur.append(wt)
                cur_chars += wlen
        if cur:
            grouped.append(cur)

        for idx, ch in enumerate(grouped):
            start = offset_s + ch[0].start_s
            if idx + 1 < len(grouped):
                end = offset_s + grouped[idx + 1][0].start_s
            else:
                end = offset_s + min(scene_dur, ch[-1].end_s + 0.25)
            end = max(start + 0.25, end)
            line_text = " ".join(w.text for w in ch).replace("\n", " ").strip()
            chunks_out.append((round(start, 3), round(end, 3), line_text))

        offset_s += scene_dur
    return chunks_out


def write_srt_subtitles(chunks: list[tuple[float, float, str]], out_srt: Path) -> Path:
    lines: list[str] = []
    for i, (start, end, text) in enumerate(chunks, start=1):
        lines.extend([str(i), f"{_fmt_srt_time(start)} --> {_fmt_srt_time(end)}", text, ""])
    out_srt.write_text("\n".join(lines), encoding="utf-8")
    return out_srt


def _render_subtitle_overlay_track(
    chunks: list[tuple[float, float, str]],
    total_duration: float,
    work_dir: Path,
) -> Path:
    """Genera un archivo de vídeo RGBA con los subtítulos sincronizados usando Pillow + concat."""
    sub_dir = work_dir / "subs"
    sub_dir.mkdir(parents=True, exist_ok=True)
    sub_h = 280
    f_sub = _font("Outfit-Regular.ttf", 50, 600)

    blank_png = sub_dir / "blank.png"
    Image.new("RGBA", (WIDTH, sub_h), (0, 0, 0, 0)).save(blank_png)

    entries: list[tuple[Path, float]] = []
    cursor = 0.0

    for idx, (start, end, text) in enumerate(chunks, start=1):
        if start > cursor + 0.04:
            entries.append((blank_png, start - cursor))
            cursor = start

        dur = max(0.15, end - cursor)
        png_path = sub_dir / f"sub_{idx:03d}.png"
        im = Image.new("RGBA", (WIDTH, sub_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        lines = _wrap_lines(text, f_sub, WIDTH - 180, draw)[:2]
        line_h = 62
        text_h = len(lines) * line_h
        max_w = max((draw.textbbox((0, 0), ln, font=f_sub)[2] for ln in lines), default=200)

        box_w = min(WIDTH - 100, max_w + 68)
        box_h = text_h + 38
        bx0 = (WIDTH - box_w) // 2
        by0 = (sub_h - box_h) // 2
        draw.rounded_rectangle(
            [bx0, by0, bx0 + box_w, by0 + box_h],
            radius=24,
            fill=(17, 17, 17, 240),
            outline=(56, 56, 56, 255),
            width=2,
        )

        ty = by0 + 16
        for ln in lines:
            lb = draw.textbbox((0, 0), ln, font=f_sub)
            lx = (WIDTH - (lb[2] - lb[0])) // 2
            draw.text((lx, ty), ln, font=f_sub, fill=(237, 232, 223, 255))
            ty += line_h

        im.save(png_path)
        entries.append((png_path, dur))
        cursor += dur

    if total_duration > cursor + 0.04:
        entries.append((blank_png, total_duration - cursor))

    concat_txt = sub_dir / "subs_concat.txt"
    lines_txt: list[str] = []
    for p, d in entries:
        lines_txt.append(f"file '{p.resolve()}'")
        lines_txt.append(f"duration {d:.3f}")
    if entries:
        lines_txt.append(f"file '{entries[-1][0].resolve()}'")
    concat_txt.write_text("\n".join(lines_txt) + "\n", encoding="utf-8")
    return concat_txt


def assemble_video(
    script: VideoScript,
    tts_results: list[TTSResult],
    work_dir: Path,
    out_mp4: Path,
    scene_shots: list[list[Path]] | None = None,
    infographic_png: Path | None = None,
) -> Path:
    """Renderiza las escenas en formato historia cinematográfica 9:16 y exporta el MP4 final."""
    hud_dir = work_dir / "hud"
    clips_dir = work_dir / "clips"
    hud_dir.mkdir(parents=True, exist_ok=True)
    clips_dir.mkdir(parents=True, exist_ok=True)

    fallback_bg = _render_fallback_bg(script, work_dir / "fallback_bg.jpg")
    clip_paths: list[Path] = []
    audio_paths: list[Path] = []
    scene_timings: list[tuple[float, list[WordTiming]]] = []

    shots_per_scene = scene_shots or [[] for _ in script.scenes]
    for scene, tts_res, shots in zip(script.scenes, tts_results, shots_per_scene):
        hud_png = hud_dir / f"hud_{scene.index:02d}.png"
        render_story_hud(
            scene=scene,
            script=script,
            total_scenes=len(script.scenes),
            out_png=hud_png,
            infographic_png=infographic_png if scene.show_infographic else None,
        )

        dur = tts_res.duration_s
        usable_shots = [p for p in shots if p.exists()] or [fallback_bg]
        if len(usable_shots) == 1:
            sub_segs = [(usable_shots[0], dur, 0)]
        else:
            d1 = round(dur * 0.5, 3)
            d2 = max(0.5, round(dur - d1, 3))
            sub_segs = [(usable_shots[0], d1, 0), (usable_shots[1], d2, 1)]

        for sub_idx, (bg_img, sub_dur, dir_mode) in enumerate(sub_segs, start=1):
            n_frames = max(12, int(round(sub_dur * FPS)))
            clip_mp4 = clips_dir / f"clip_{scene.index:02d}_{sub_idx}.mp4"
            if dir_mode == 0:
                zoom_expr = "min(zoom+0.00055,1.08)"
            else:
                zoom_expr = "if(eq(on,1),1.08,max(zoom-0.00055,1.0))"
            fade_out_start = max(0.0, sub_dur - 0.18)

            vf_bg = (
                f"zoompan=z='{zoom_expr}':"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                f"d={n_frames}:s={WIDTH}x{HEIGHT}:fps={FPS}"
            )
            fc = (
                f"[0:v]{vf_bg}[bg];"
                f"[bg][1:v]overlay=0:0:shortest=1,"
                f"fade=t=in:st=0:d=0.18,fade=t=out:st={fade_out_start:.3f}:d=0.18[v]"
            )
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(bg_img),
                    "-loop",
                    "1",
                    "-i",
                    str(hud_png),
                    "-filter_complex",
                    fc,
                    "-map",
                    "[v]",
                    "-t",
                    f"{sub_dur:.3f}",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-r",
                    str(FPS),
                    str(clip_mp4),
                ],
                capture_output=True,
                check=True,
            )
            clip_paths.append(clip_mp4)

        audio_paths.append(tts_res.audio_path)
        scene_timings.append((dur, tts_res.word_timings))

    # Concatenar vídeo y audio por separado
    video_list = work_dir / "videos.txt"
    video_list.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in clip_paths) + "\n",
        encoding="utf-8",
    )
    audio_list = work_dir / "audios.txt"
    audio_list.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in audio_paths) + "\n",
        encoding="utf-8",
    )

    raw_video = work_dir / "raw_video.mp4"
    voiceover = work_dir / "voiceover.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(raw_video)],
        capture_output=True,
        check=True,
    )
    # Concatenar audios con filter_complex para tolerar distintas tasas entre Gemini TTS y Edge TTS
    audio_inputs: list[str] = []
    filter_parts: list[str] = []
    for i, ap in enumerate(audio_paths):
        audio_inputs.extend(["-i", str(ap)])
        filter_parts.append(f"[{i}:a]")
    concat_filter = "".join(filter_parts) + f"concat=n={len(audio_paths)}:v=0:a=1[aout]"
    subprocess.run(
        ["ffmpeg", "-y", *audio_inputs, "-filter_complex", concat_filter, "-map", "[aout]", "-c:a", "libmp3lame", "-q:a", "2", str(voiceover)],
        capture_output=True,
        check=True,
    )

    # Subtítulos sincronizados (SRT + pista RGBA Pillow) + mux final
    total_dur = sum(d for d, _ in scene_timings)
    chunks = _build_subtitle_chunks(scene_timings)
    write_srt_subtitles(chunks, out_mp4.with_suffix(".srt"))
    subs_concat = _render_subtitle_overlay_track(chunks, total_dur, work_dir)

    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw_video),
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(subs_concat),
            "-i",
            str(voiceover),
            "-filter_complex",
            "[0:v][1:v]overlay=0:1390:shortest=1[v]",
            "-map",
            "[v]",
            "-map",
            "2:a",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(out_mp4),
        ],
        capture_output=True,
        check=True,
    )
    return out_mp4
