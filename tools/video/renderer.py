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
) -> Path:
    """Capa RGBA limpia: en Escena 1 muestra el gancho editorial; en 2..N deja respirar la historia visual."""
    accent = _eje_color(script.eje)
    hud = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hud)

    f_brand = _font("Outfit-Regular.ttf", 26, 700)
    f_meta = _font("Outfit-Regular.ttf", 24, 500)
    f_tag = _font("Outfit-Regular.ttf", 24, 700)
    f_head = _font("PlayfairDisplay-Bold.ttf", 60, 700)
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

    # Píldora de capítulo
    tag_text = scene.tag.upper()
    tb = draw.textbbox((0, 0), tag_text, font=f_tag)
    pill_w = (tb[2] - tb[0]) + 44
    pill_x = 76
    pill_y = 192
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + 44],
        radius=22,
        fill=(12, 12, 12, 205),
        outline=(r, g, b, 235),
        width=2,
    )
    draw.text((pill_x + 22, pill_y + 9), tag_text, font=f_tag, fill=(r, g, b, 255))

    # Solo en Escena 1 (gancho) o Cierre mostramos titular grande; en escenas 2..N la foto manda
    if scene.kind == "gancho":
        lines = _wrap_lines(scene.on_screen, f_head, WIDTH - 152, draw)[:4]
        ty = pill_y + 82
        for i, line in enumerate(lines):
            col = (232, 197, 106, 255) if i == 0 else (237, 232, 223, 255)
            draw.text((78, ty + 4), line, font=f_head, fill=(0, 0, 0, 190))
            draw.text((76, ty), line, font=f_head, fill=col)
            ty += 74

    # Crédito discreto al pie (debajo de los subtítulos)
    attr = f"{script.book_title}" + (f" · {script.book_author}" if script.book_author else "")
    ab = draw.textbbox((0, 0), attr[:58], font=f_book)
    draw.text(((WIDTH - (ab[2] - ab[0])) // 2, 1745), attr[:58], font=f_book, fill=(180, 172, 160, 230))

    out_png.parent.mkdir(parents=True, exist_ok=True)
    hud.save(out_png)
    return out_png


def _render_infographic_bg(script: VideoScript, infographic_png: Path, out_jpg: Path) -> Path:
    """Crea un plano dedicado 9:16 para la infografía de la lección sin tapar caras."""
    accent = _eje_color(script.eje)
    bg = Image.new("RGB", (WIDTH, HEIGHT), "#080808")
    _draw_glow(bg, accent)
    draw = ImageDraw.Draw(bg)

    f_sub = _font("Outfit-Regular.ttf", 28, 700)
    lbl = "EL ESQUEMA CLAVE"
    lb = draw.textbbox((0, 0), lbl, font=f_sub)
    draw.text(((WIDTH - (lb[2] - lb[0])) // 2, 410), lbl, font=f_sub, fill="#e8c56a")

    with Image.open(infographic_png) as raw_info:
        info = raw_info.convert("RGB")
        info.thumbnail((940, 680), Image.Resampling.LANCZOS)
        iw, ih = info.size
        ix = (WIDTH - iw) // 2
        iy = 480 + (720 - ih) // 2
        mask = Image.new("L", (iw, ih), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw, ih], radius=24, fill=255)
        bg.paste(info, (ix, iy), mask)
        draw.rounded_rectangle([ix - 2, iy - 2, ix + iw + 2, iy + ih + 2], radius=26, outline=accent, width=2)

    out_jpg.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out_jpg, quality=94)
    return out_jpg


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
    scene_timings: list[tuple[float, list[WordTiming], str]],
) -> list[tuple[float, float, list[tuple[str, float, float]]]]:
    """Agrupa en bloques de 3-4 palabras restaurando puntuación y conservando tiempos por palabra."""
    chunks_out: list[tuple[float, float, list[tuple[str, float, float]]]] = []
    offset_s = 0.0
    for scene_dur, words, narration in scene_timings:
        if not words:
            offset_s += scene_dur
            continue

        orig_tokens = [
            t for t in narration.split()
            if any(ch.isalnum() for ch in t)
        ]
        aligned: list[tuple[str, float, float]] = []
        for idx, wt in enumerate(words):
            label = orig_tokens[idx] if (len(orig_tokens) == len(words)) else wt.text
            aligned.append((label, offset_s + wt.start_s, offset_s + wt.end_s))

        grouped: list[list[tuple[str, float, float]]] = []
        cur: list[tuple[str, float, float]] = []
        cur_chars = 0
        for item in aligned:
            wlen = len(item[0]) + 1
            if cur and (len(cur) >= 4 or cur_chars + wlen > 26):
                grouped.append(cur)
                cur = [item]
                cur_chars = len(item[0])
            else:
                cur.append(item)
                cur_chars += wlen
            if item[0].rstrip("\"'»”)").endswith((".", "!", "?", "…")):
                grouped.append(cur)
                cur = []
                cur_chars = 0
        if cur:
            grouped.append(cur)

        for idx, ch in enumerate(grouped):
            start = ch[0][1]
            if idx + 1 < len(grouped):
                end = grouped[idx + 1][0][1]
            else:
                end = offset_s + min(scene_dur, ch[-1][2] - offset_s + 0.25)
            end = max(start + 0.25, end)
            chunks_out.append((round(start, 3), round(end, 3), ch))

        offset_s += scene_dur
    return chunks_out


def write_srt_subtitles(chunks: list[tuple[float, float, list[tuple[str, float, float]]]], out_srt: Path) -> Path:
    lines: list[str] = []
    for i, (start, end, word_items) in enumerate(chunks, start=1):
        txt = " ".join(w[0] for w in word_items)
        lines.extend([str(i), f"{_fmt_srt_time(start)} --> {_fmt_srt_time(end)}", txt, ""])
    out_srt.write_text("\n".join(lines), encoding="utf-8")
    return out_srt


def _render_subtitle_overlay_track(
    chunks: list[tuple[float, float, list[tuple[str, float, float]]]],
    total_duration: float,
    work_dir: Path,
) -> Path:
    """Genera subtítulos estilo karaoke (palabra activa en dorado #e8c56a) con Pillow + concat."""
    sub_dir = work_dir / "subs"
    sub_dir.mkdir(parents=True, exist_ok=True)
    sub_h = 260
    f_sub = _font("Outfit-Regular.ttf", 54, 700)

    blank_png = sub_dir / "blank.png"
    Image.new("RGBA", (WIDTH, sub_h), (0, 0, 0, 0)).save(blank_png)

    entries: list[tuple[Path, float]] = []
    cursor = 0.0
    frame_counter = 0

    for start, end, word_items in chunks:
        if start > cursor + 0.04:
            entries.append((blank_png, start - cursor))
            cursor = start

        # Calcular ancho total de la línea centrada
        full_text = " ".join(w[0] for w in word_items)
        draw_tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
        tb = draw_tmp.textbbox((0, 0), full_text, font=f_sub)
        total_w = tb[2] - tb[0]
        text_h = tb[3] - tb[1]

        box_w = min(WIDTH - 80, total_w + 68)
        box_h = max(86, text_h + 40)
        bx0 = (WIDTH - box_w) // 2
        by0 = (sub_h - box_h) // 2

        for w_idx, (w_text, w_start, w_end) in enumerate(word_items):
            seg_start = max(cursor, w_start if w_idx > 0 else cursor)
            seg_end = word_items[w_idx + 1][1] if (w_idx + 1 < len(word_items)) else end
            seg_dur = max(0.08, seg_end - seg_start)

            frame_counter += 1
            png_path = sub_dir / f"sub_{frame_counter:04d}.png"
            im = Image.new("RGBA", (WIDTH, sub_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(im)
            draw.rounded_rectangle(
                [bx0, by0, bx0 + box_w, by0 + box_h],
                radius=24,
                fill=(10, 10, 10, 238),
                outline=(62, 62, 62, 255),
                width=2,
            )

            # Dibujar palabra por palabra con la activa en dorado (#e8c56a)
            x_cur = (WIDTH - total_w) // 2
            y_text = by0 + (box_h - 56) // 2 - 4
            for j, (tok, _, _) in enumerate(word_items):
                col = (232, 197, 106, 255) if j == w_idx else (237, 232, 223, 255)
                draw.text((x_cur, y_text), tok, font=f_sub, fill=col)
                adv = draw.textbbox((0, 0), tok + " ", font=f_sub)[2]
                x_cur += adv

            im.save(png_path)
            entries.append((png_path, seg_dur))
            cursor += seg_dur

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
    """Renderiza las escenas en formato historia cinematográfica 9:16 con xfade y subtítulos karaoke."""
    hud_dir = work_dir / "hud"
    clips_dir = work_dir / "clips"
    hud_dir.mkdir(parents=True, exist_ok=True)
    clips_dir.mkdir(parents=True, exist_ok=True)

    fallback_bg = _render_fallback_bg(script, work_dir / "fallback_bg.jpg")
    info_bg = (
        _render_infographic_bg(script, infographic_png, work_dir / "infographic_bg.jpg")
        if (infographic_png and infographic_png.exists())
        else None
    )

    clip_meta: list[tuple[Path, float]] = []
    audio_paths: list[Path] = []
    scene_timings: list[tuple[float, list[WordTiming], str]] = []
    xfade_d = 0.35

    shots_per_scene = scene_shots or [[] for _ in script.scenes]
    for scene, tts_res, shots in zip(script.scenes, tts_results, shots_per_scene):
        hud_png = hud_dir / f"hud_{scene.index:02d}.png"
        render_story_hud(
            scene=scene,
            script=script,
            total_scenes=len(script.scenes),
            out_png=hud_png,
        )

        dur = tts_res.duration_s
        usable_shots = [p for p in shots if p.exists()] or [fallback_bg]
        if scene.show_infographic and info_bg is not None:
            usable_shots = [usable_shots[0], info_bg]

        if len(usable_shots) == 1:
            sub_segs = [(usable_shots[0], dur, 0)]
        else:
            d1 = round(dur * 0.48, 3)
            d2 = max(0.6, round(dur - d1, 3))
            sub_segs = [(usable_shots[0], d1, 0), (usable_shots[1], d2, 1)]

        for sub_idx, (bg_img, sub_dur, dir_mode) in enumerate(sub_segs, start=1):
            # Añadir xfade_d al clip (se solapará con el siguiente) para mantener sincronía exacta
            clip_dur = sub_dur + xfade_d
            n_frames = max(15, int(round(clip_dur * FPS)))
            clip_mp4 = clips_dir / f"clip_{scene.index:02d}_{sub_idx}.mp4"
            if dir_mode == 0:
                zoom_expr = "min(zoom+0.00055,1.08)"
            else:
                zoom_expr = "if(eq(on,1),1.08,max(zoom-0.00055,1.0))"

            vf_bg = (
                f"zoompan=z='{zoom_expr}':"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                f"d={n_frames}:s={WIDTH}x{HEIGHT}:fps={FPS}"
            )
            fc = f"[0:v]{vf_bg}[bg];[bg][1:v]overlay=0:0:shortest=1[v]"
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", str(bg_img),
                    "-loop", "1", "-i", str(hud_png),
                    "-filter_complex", fc,
                    "-map", "[v]",
                    "-t", f"{clip_dur:.3f}",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
                    str(clip_mp4),
                ],
                capture_output=True,
                check=True,
            )
            clip_meta.append((clip_mp4, sub_dur))

        audio_paths.append(tts_res.audio_path)
        scene_timings.append((dur, tts_res.word_timings, scene.narration))

    # Encadenar clips con xfade suave (sin pantallazos negros)
    raw_video = work_dir / "raw_video.mp4"
    if len(clip_meta) == 1:
        raw_video.write_bytes(clip_meta[0][0].read_bytes())
    else:
        v_inputs: list[str] = []
        xf_filters: list[str] = []
        for idx, (cp, _) in enumerate(clip_meta):
            v_inputs.extend(["-i", str(cp)])
        prev = "[0:v]"
        offset_acc = clip_meta[0][1]
        for idx in range(1, len(clip_meta)):
            out_lbl = "[vout]" if idx == len(clip_meta) - 1 else f"[vx{idx}]"
            xf_filters.append(
                f"{prev}[{idx}:v]xfade=transition=fade:duration={xfade_d}:offset={offset_acc:.3f}{out_lbl}"
            )
            prev = out_lbl
            offset_acc += clip_meta[idx][1]
        subprocess.run(
            ["ffmpeg", "-y", *v_inputs, "-filter_complex", ";".join(xf_filters), "-map", "[vout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), str(raw_video)],
            capture_output=True,
            check=True,
        )

    voiceover = work_dir / "voiceover.mp3"
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

    # Subtítulos karaoke + normalización de volumen (-16 LUFS) + mux final
    total_dur = sum(d for d, _, _ in scene_timings)
    chunks = _build_subtitle_chunks(scene_timings)
    write_srt_subtitles(chunks, out_mp4.with_suffix(".srt"))
    subs_concat = _render_subtitle_overlay_track(chunks, total_dur, work_dir)

    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-f", "concat", "-safe", "0", "-i", str(subs_concat),
            "-i", str(voiceover),
            "-filter_complex", "[0:v][1:v]overlay=0:1390:shortest=1[v];[2:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]",
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
            str(out_mp4),
        ],
        capture_output=True,
        check=True,
    )
    return out_mp4
