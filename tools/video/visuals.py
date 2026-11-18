"""Fondo fotográfico opcional (Wikimedia Commons) para portadas y cierres. Se activa con --photos."""

from __future__ import annotations

from pathlib import Path

import requests
from PIL import Image, ImageEnhance, ImageOps

HEADERS = {"User-Agent": "MenteFriaVideo/1.0 (https://github.com/AFC1204-coder/Mf)"}

# Mapeo semántico español -> consultas visuales cinematográficas (sin texto)
KEYWORD_VISUALS: list[tuple[tuple[str, ...], list[str]]] = [
    (("felicidad", "bienestar", "alegría"), ["sunlight forest path", "person looking at horizon sunset"]),
    (("flujo", "absorción", "concentración", "atención"), ["person reading quiet library", "artisan hands crafting workshop"]),
    (("cirujano", "médico", "operación"), ["surgeon operating room focus", "medical hands precision"]),
    (("escalador", "montaña", "cima", "reto"), ["rock climber cliff", "mountain climber ridge"]),
    (("músico", "piano", "violín", "improvisación"), ["pianist hands grand piano", "violinist concert hall dark"]),
    (("ajedrez", "estrategia", "partida", "juego"), ["chess pieces wooden board", "chess player thinking"]),
    (("programador", "código", "algoritmo"), ["software developer dark desk", "laptop coding night"]),
    (("tiempo", "horas", "reloj", "minuto"), ["hourglass sand close up", "antique pocket watch"]),
    (("investigación", "entrevista", "estudio", "datos"), ["researcher desk notebook", "vintage university library"]),
    (("esfuerzo", "paradoja", "dificultad", "límite"), ["runner mountain trail mist", "athlete training focus"]),
    (("poder", "corte", "rey", "jerarquía"), ["chess king shadow", "classical architecture columns"]),
    (("decisión", "camino", "elección", "futuro"), ["fork in forest path", "compass map wooden table"]),
    (("hábito", "rutina", "práctica", "semana"), ["open notebook fountain pen", "morning coffee desk sunlight"]),
    (("persuasión", "influencia", "retórica", "discurso"), ["vintage microphone dark stage", "orator podium hall"]),
    (("sesgo", "ilusión", "error", "mente", "cerebro"), ["optical illusion shadow light", "mirror reflection dark"]),
    (("inversión", "dinero", "capital", "mercado", "riqueza"), ["gold coins dark table", "architectural vault stone"]),
    (("riesgo", "incertidumbre", "azar", "probabilidad"), ["dice wooden table shadow", "stormy sea lighthouse"]),
    (("estoicismo", "virtud", "calma", "templanza", "filosofía"), ["marble bust roman statue", "quiet stone courtyard"]),
    (("historia", "imperio", "guerra", "antiguo"), ["roman ruins columns dusk", "ancient parchment scroll"]),
    (("liderazgo", "equipo", "mando", "autoridad"), ["rowing crew synchronization", "ship helm captain"]),
    (("emoción", "miedo", "ira", "ansiedad", "calma"), ["still lake reflection mist", "silhouette window rain"]),
]

FALLBACK_STORY_SHOTS = [
    ["misty mountain landscape dawn", "person walking quiet forest"],
    ["vintage library books", "sunlight through window dust"],
    ["calm ocean waves dusk", "lighthouse beam night"],
    ["antique compass wooden desk", "open journal pen"],
]


def backdrop_queries(text: str, position: int = 0) -> list[str]:
    """Consultas de fotografía para un texto: por palabras clave y, si no hay, un fondo neutro."""
    low = text.lower()
    queries: list[str] = []
    for keywords, q_list in KEYWORD_VISUALS:
        if any(k in low for k in keywords):
            queries.extend(q for q in q_list if q not in queries)
    queries.extend(q for q in FALLBACK_STORY_SHOTS[position % len(FALLBACK_STORY_SHOTS)] if q not in queries)
    return queries


SKIP_TITLE_WORDS = (
    "diagram", "chart", "graph", "map", "logo", "icon", "flag",
    "coat_of_arms", "signature", "stamp", "text", "page", "scan", "pdf",
)


def _search_wikimedia_image(query: str, used_urls: set[str]) -> str | None:
    try:
        resp = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": f"filetype:bitmap {query}",
                "gsrnamespace": 6,
                "gsrlimit": 12,
                "prop": "imageinfo",
                "iiprop": "url|size|mime",
                "iiurlwidth": 1280,
                "format": "json",
            },
            headers=HEADERS,
            timeout=15,
        )
        if not resp.ok:
            return None
        pages = resp.json().get("query", {}).get("pages", {}).values()
        # Preferir fotografías nítidas y evitar escaneos/diagramas/mapas
        candidates: list[tuple[int, str]] = []
        for p in pages:
            title_low = (p.get("title") or "").lower()
            if any(bad in title_low for bad in SKIP_TITLE_WORDS):
                continue
            ii = (p.get("imageinfo") or [{}])[0]
            mime = ii.get("mime", "")
            w = ii.get("width") or 0
            h = ii.get("height") or 0
            url = ii.get("thumburl") or ii.get("url") or ""
            if not url or url in used_urls:
                continue
            if mime not in ("image/jpeg", "image/png", "image/webp"):
                continue
            if w < 700 or h < 500:
                continue
            score = (2000 if h >= w else 1000) + min(w, 2000)
            candidates.append((score, url))

        if not candidates:
            return None
        candidates.sort(key=lambda x: x[0], reverse=True)
        chosen = candidates[0][1]
        used_urls.add(chosen)
        return chosen
    except Exception:
        return None


def _grade_vertical_cinema(src_path: Path, dst_path: Path, width: int = 1080, height: int = 1920) -> Path:
    """Recorta a 9:16 y aplica gradación oscura editorial Mente Fría (contraste + viñeta)."""
    with Image.open(src_path) as im:
        rgb = im.convert("RGB")
        fitted = ImageOps.fit(rgb, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))
        # Ligera desaturación y contraste cinematográfico oscuro
        fitted = ImageEnhance.Color(fitted).enhance(0.75)
        fitted = ImageEnhance.Contrast(fitted).enhance(1.12)
        fitted = ImageEnhance.Brightness(fitted).enhance(0.62)

        # Viñeta vertical (arriba y abajo más oscuros para legibilidad total de texto y subtítulos)
        grad = Image.new("RGBA", (width, height), (8, 8, 8, 0))
        px = grad.load()
        for y in range(height):
            if y < 560:
                a = max(45, int(215 * (1.0 - y / 560.0)))
            elif y > height - 680:
                t = (y - (height - 680)) / 680.0
                a = max(45, int(235 * (t ** 1.1)))
            else:
                a = 45
            for x in range(width):
                px[x, y] = (8, 8, 8, a)

        out = Image.alpha_composite(fitted.convert("RGBA"), grad).convert("RGB")
        out.save(dst_path, quality=92)
    return dst_path


def fetch_backdrop(text: str, out_jpg: Path, used_urls: set[str] | None = None, position: int = 0) -> Path | None:
    """Fotografía libre (Wikimedia Commons) recortada a 9:16 y oscurecida, para el fondo de portadas y cierres.

    Es ambiente, no contenido: nunca sustituye al esquema ni al texto. Devuelve None si no hay red o no hay foto.
    """
    out_jpg.parent.mkdir(parents=True, exist_ok=True)
    if out_jpg.exists() and out_jpg.stat().st_size > 15_000:
        return out_jpg
    usados = used_urls if used_urls is not None else set()
    for query in backdrop_queries(text, position)[:3]:
        img_url = _search_wikimedia_image(query, usados)
        if not img_url:
            continue
        try:
            r = requests.get(img_url, headers=HEADERS, timeout=25)
            if r.ok and len(r.content) > 10_000:
                raw_dl = out_jpg.with_suffix(".raw")
                raw_dl.write_bytes(r.content)
                _grade_vertical_cinema(raw_dl, out_jpg)
                raw_dl.unlink(missing_ok=True)
                return out_jpg
        except Exception as exc:
            print(f"[visuals] Error descargando imagen ({query}): {exc}")
    return None
