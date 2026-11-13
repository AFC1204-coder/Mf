"""Extractor y renderizador de infografías, SVG y diagramas de Mente Fría a PNG."""

from __future__ import annotations

import base64
import html
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote

import requests
from PIL import Image, ImageDraw, ImageFont

from .supabase_client import LessonData

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONTS_DIR = Path(__file__).resolve().parent / "assets" / "fonts"


def _chrome_available() -> bool:
    return Path(CHROME_BIN).exists() or bool(shutil.which("google-chrome") or shutil.which("chromium"))


def _chrome_cmd() -> str:
    if Path(CHROME_BIN).exists():
        return CHROME_BIN
    return shutil.which("google-chrome") or shutil.which("chromium") or CHROME_BIN


def _decode_svg_data_uri(uri: str) -> str | None:
    if not uri.startswith("data:image/svg+xml"):
        return None
    header, _, payload = uri.partition(",")
    if ";base64" in header:
        return base64.b64decode(payload).decode("utf-8", errors="replace")
    return unquote(payload)


def _rasterize_html_to_png(html_content: str, out_png: Path, width: int = 920, height: int = 620) -> bool:
    if not _chrome_available():
        return False
    with tempfile.TemporaryDirectory() as tmpdir:
        html_file = Path(tmpdir) / "card.html"
        html_file.write_text(html_content, encoding="utf-8")
        cmd = [
            _chrome_cmd(),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--window-size={width},{height}",
            f"--screenshot={out_png}",
            html_file.as_uri(),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        return res.returncode == 0 and out_png.exists()


def _render_diagram_pillow(diagram: dict, out_png: Path, width: int = 920, height: int = 560) -> Path:
    img = Image.new("RGB", (width, height), "#111111")
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([2, 2, width - 3, height - 3], radius=24, outline="#2e2e2e", width=3)

    font_title = ImageFont.truetype(str(FONTS_DIR / "PlayfairDisplay-Bold.ttf"), 34)
    font_title.set_variation_by_axes([700])
    font_body = ImageFont.truetype(str(FONTS_DIR / "Outfit-Regular.ttf"), 25)
    font_sub = ImageFont.truetype(str(FONTS_DIR / "Outfit-Regular.ttf"), 20)

    title = str(diagram.get("titulo") or "Esquema clave")
    draw.text((40, 34), title[:54], font=font_title, fill="#e8c56a")

    datos = diagram.get("datos") or {}
    y = 104
    if "izq" in datos and "der" in datos:
        col_w = (width - 104) // 2
        for idx, side_key in enumerate(["izq", "der"]):
            side = datos[side_key] or {}
            x0 = 40 + idx * (col_w + 24)
            color = "#c9a84c" if idx == 0 else "#5dade2"
            draw.rounded_rectangle([x0, y, x0 + col_w, height - 76], radius=16, fill="#161616", outline=color, width=2)
            draw.text((x0 + 20, y + 18), str(side.get("t") or "")[:28], font=font_body, fill=color)
            iy = y + 66
            for item in (side.get("items") or [])[:5]:
                draw.text((x0 + 20, iy), f"• {str(item)[:36]}", font=font_sub, fill="#ede8df")
                iy += 46
    else:
        raw_items = datos.get("pasos") or datos.get("nodos") or datos.get("items") or []
        for item in raw_items[:6]:
            label = item.get("t") or item.get("titulo") or item.get("label") or str(item) if isinstance(item, dict) else str(item)
            draw.rounded_rectangle([40, y, width - 40, y + 58], radius=12, fill="#161616", outline="#2e2e2e", width=2)
            draw.text((60, y + 15), f"• {label[:62]}", font=font_sub, fill="#ede8df")
            y += 70

    pie = str(diagram.get("pie") or "")
    if pie:
        draw.text((40, height - 44), pie[:78], font=font_sub, fill="#a8a094")

    img.save(out_png)
    return out_png


def prepare_infographic(lesson: LessonData, out_png: Path) -> Path | None:
    """Si la lección tiene SVG, imagen o diagrama, lo renderiza a PNG en out_png."""
    out_png.parent.mkdir(parents=True, exist_ok=True)

    # 1) SVG en imagen_principal
    if lesson.imagen_principal and lesson.imagen_principal.startswith("data:image/svg+xml"):
        svg = _decode_svg_data_uri(lesson.imagen_principal)
        if svg:
            caption = html.escape(lesson.imagen_caption or "")
            doc = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 920px; height: 620px; background: #111111; color: #ede8df;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 28px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    border: 2px solid #2e2e2e; border-radius: 24px;
  }}
  svg {{ max-width: 100%; max-height: 510px; width: auto; height: auto; }}
  .cap {{ margin-top: 12px; font-size: 16px; color: #a8a094; text-align: center; }}
</style></head>
<body>{svg}{f'<div class="cap">{caption}</div>' if caption else ''}</body></html>"""
            if _rasterize_html_to_png(doc, out_png):
                return out_png

    # 2) URL de imagen (imagen_principal o infografia_url del libro)
    img_url = None
    if lesson.imagen_principal and lesson.imagen_principal.startswith("http"):
        img_url = lesson.imagen_principal
    elif lesson.infografia_url and lesson.infografia_url.startswith("http"):
        img_url = lesson.infografia_url

    if img_url:
        try:
            resp = requests.get(img_url, timeout=20)
            if resp.ok:
                tmp = out_png.with_suffix(".dl")
                tmp.write_bytes(resp.content)
                with Image.open(tmp) as im:
                    im = im.convert("RGB")
                    im.thumbnail((920, 620))
                    im.save(out_png)
                tmp.unlink(missing_ok=True)
                return out_png
        except Exception:
            pass

    # 3) Diagrama estructurado en datos/diagramas.json
    if lesson.diagramas:
        return _render_diagram_pillow(lesson.diagramas[0], out_png)

    return None
