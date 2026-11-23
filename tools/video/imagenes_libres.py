"""Imágenes libres para los vídeos: buscarlas en Wikimedia Commons, con su licencia y su autor, y proponerlas.

Reglas:
  - Solo licencias que permiten reutilizar y adaptar sin condiciones sobre la obra resultante: dominio público,
    CC0 y CC BY. Se rechaza todo lo demás (NC, ND, «todos los derechos», y también BY-SA: su «compartir igual»
    podría alcanzar al vídeo). Sin licencia legible, no entra.
  - Cada imagen guarda título, autor, licencia y página de origen: el crédito sale en pantalla y en la descripción.
  - Ninguna imagen sale en un vídeo sin `"aprobado": true` en `tools/video/imagenes/<libro>.json`: qué imagen
    acompaña a qué idea es una interpretación (y un retrato puede ser de un homónimo), así que la decide una persona.
  - No se fuerza: una lección sin una imagen clara se queda sin imagen.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DIR = Path(__file__).resolve().parent / "imagenes"
ARCHIVOS = DIR / "archivos"
AGENTE = "MenteFriaVideo/1.0 (generador de videos educativos)"
COMMONS = "https://commons.wikimedia.org/w/api.php"
WIKIDATA = "https://www.wikidata.org/w/api.php"
ANCHO = 960  # la miniatura que se descarga: de sobra para media pantalla de 1080 px
ANCHO_MIN = 1000  # siempre mayor que ANCHO: así se pide la miniatura estándar y nunca el original
PAUSA_S = 1.0
_LIBRE = re.compile(r"^(?:public domain|pd\b|pd-|cc0|cc[ -]by[ -]\d|cc[ -]by$|no restrictions|attribution$)", re.I)
_NO = re.compile(r"\bsa\b|-sa|\bnc\b|-nc|\bnd\b|-nd|fair use|copyright", re.I)


def licencia_aceptada(nombre: str) -> bool:
    n = (nombre or "").strip()
    return bool(n) and bool(_LIBRE.search(n)) and not _NO.search(n)


def _contexto() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    for f in (os.getenv("SSL_CERT_FILE"), os.getenv("REQUESTS_CA_BUNDLE")):
        if f and os.path.isfile(f):
            ctx.load_verify_locations(cafile=f)
    return ctx


def _pedir(url: str) -> tuple[int, float, bytes]:
    """Una petición: (código HTTP, segundos de espera que pide el servidor, cuerpo). Con `curl` si está instalado:
    Wikimedia rechaza por su política de robots las peticiones de la biblioteca estándar de Python, no las de curl."""
    import shutil
    import subprocess
    import tempfile

    if shutil.which("curl"):
        with tempfile.TemporaryDirectory() as tmp:
            cuerpo, cab = Path(tmp) / "cuerpo", Path(tmp) / "cabeceras"
            r = subprocess.run(
                ["curl", "-s", "-L", "-m", "60", "-A", AGENTE, "-D", str(cab), "-o", str(cuerpo), "-w", "%{http_code}", url],
                capture_output=True, text=True,
            )
            codigo = int(r.stdout.strip() or 0) if r.stdout.strip().isdigit() else 0
            cabeceras = cab.read_text(encoding="utf-8", errors="ignore") if cab.exists() else ""
            m = re.findall(r"(?im)^retry-after:\s*(\d+)", cabeceras)
            return codigo, float(m[-1]) if m else 0.0, cuerpo.read_bytes() if cuerpo.exists() else b""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=60, context=_contexto()) as r:
            return 200, 0.0, r.read()
    except urllib.error.HTTPError as exc:
        try:
            espera = float(exc.headers.get("Retry-After") or 0)
        except (TypeError, ValueError):
            espera = 0.0
        return exc.code, espera, b""
    except OSError:
        return 0, 0.0, b""


def _get(url: str, params: dict[str, Any] | None = None, binario: bool = False, intentos: int = 8):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    codigo = 0
    for k in range(intentos):
        time.sleep(PAUSA_S)  # Wikimedia limita a los clientes que piden muy seguido
        codigo, espera, datos = _pedir(url)
        if codigo == 200 and datos:
            return datos if binario else json.loads(datos.decode("utf-8"))
        # 429: el servidor dice cuánto esperar y se le hace caso (con un tope). Otro fallo: espera creciente.
        time.sleep(min(espera or 30.0, 30.0) + 2 if codigo == 429 else 1.5 * (k + 1))
    raise RuntimeError(f"No se pudo leer {url[:90]} (HTTP {codigo})")


def _limpio(v: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", v or "")).split())


def _ficha(pagina: dict[str, Any]) -> dict[str, Any] | None:
    info = (pagina.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata") or {}
    lic = _limpio((meta.get("LicenseShortName") or {}).get("value", ""))
    if info.get("mime") not in ("image/jpeg", "image/png") or int(info.get("width") or 0) < ANCHO_MIN or not licencia_aceptada(lic):
        return None
    autor = _limpio((meta.get("Artist") or {}).get("value", ""))[:80] or _limpio((meta.get("Credit") or {}).get("value", ""))[:80]
    if not autor and not re.match(r"public domain|pd|cc0|no restrictions", lic, re.I):
        return None  # una licencia que pide atribución, sin a quién atribuir
    return {
        "titulo": pagina.get("title", ""),
        "pagina": info.get("descriptionurl", ""),
        # Wikimedia solo sirve miniaturas de unos anchos fijos: si el original es más estrecho que el pedido, se usa tal cual.
        "miniatura": info.get("thumburl") if int(info.get("width") or 0) > ANCHO and info.get("thumburl") else info.get("url", ""),
        "original": info.get("url", ""), "bytes": int(info.get("size") or 0),
        "ancho": int(info.get("width") or 0), "alto": int(info.get("height") or 0),
        "autor": autor, "licencia": lic, "licencia_url": _limpio((meta.get("LicenseUrl") or {}).get("value", "")),
        "descripcion": _limpio((meta.get("ImageDescription") or {}).get("value", ""))[:160],
    }


_PROPS = {"prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": ANCHO,
          "iiextmetadatafilter": "LicenseShortName|Artist|LicenseUrl|Credit|ImageDescription"}


def buscar(consulta: str, cuantas: int = 8) -> list[dict[str, Any]]:
    """Imágenes de Commons para una consulta, ya filtradas por licencia, en el orden de relevancia de Commons."""
    d = _get(COMMONS, {"action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 40,
                       "gsrsearch": f"{consulta} filetype:bitmap haslicense:unrestricted|attribution", **_PROPS})
    paginas = sorted((d.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    return [f for f in (_ficha(p) for p in paginas) if f][:cuantas]


def retrato(nombre: str) -> dict[str, Any] | None:
    """El retrato que Wikidata da para una persona con ese nombre (propiedad P18), si su licencia vale.

    Devuelve también la descripción de Wikidata («American psychologist»): es lo que permite a quien aprueba
    comprobar que es la persona y no un homónimo."""
    for idioma in ("es", "en"):
        s = _get(WIKIDATA, {"action": "wbsearchentities", "format": "json", "language": idioma, "uselang": "es", "type": "item", "limit": 5, "search": nombre})
        for cand in s.get("search") or []:
            e = _get(WIKIDATA, {"action": "wbgetentities", "format": "json", "ids": cand["id"], "props": "claims|descriptions"})["entities"][cand["id"]]
            claims = e.get("claims") or {}
            humano = any((c.get("mainsnak", {}).get("datavalue", {}).get("value", {}) or {}).get("id") == "Q5" for c in claims.get("P31", []))
            fotos = [c["mainsnak"]["datavalue"]["value"] for c in claims.get("P18", []) if c.get("mainsnak", {}).get("datavalue")]
            if not humano or not fotos:
                continue
            d = _get(COMMONS, {"action": "query", "format": "json", "titles": f"File:{fotos[0]}", **_PROPS})
            for p in (d.get("query") or {}).get("pages", {}).values():
                f = _ficha(p)
                if f:
                    desc = e.get("descriptions") or {}
                    f.update({"wikidata": cand["id"], "quien": (desc.get("es") or desc.get("en") or {}).get("value", ""), "nombre": cand.get("label", nombre)})
                    return f
            return None  # es la persona, pero su foto no tiene una licencia que valga
    return None


def _en_upload(url: str) -> str:
    """Las miniaturas se anuncian en thumb.wikimedia.org; la misma ruta se sirve en upload.wikimedia.org, que es
    la dirección que hay que tener permitida para los originales."""
    return re.sub(r"^https://thumb\.wikimedia\.org/", "https://upload.wikimedia.org/", url)




def descargar(ficha: dict[str, Any]) -> str:
    """Baja la imagen a ANCHO px y la guarda como JPEG en `imagenes/archivos/`. Devuelve su nombre (estable: sale
    del título)."""
    import io

    from PIL import Image

    ARCHIVOS.mkdir(parents=True, exist_ok=True)
    nombre = hashlib.sha1(ficha["titulo"].encode("utf-8")).hexdigest()[:14] + ".jpg"
    destino = ARCHIVOS / nombre
    if not destino.exists():
        # La miniatura de ANCHO px (un tamaño de los que Wikimedia sirve a clientes automáticos); el original solo
        # si es más estrecho que eso.
        img = Image.open(io.BytesIO(_get(_en_upload(ficha["miniatura"]), binario=True)))
        img = img.convert("RGB")
        if img.width > ANCHO:
            img = img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)
        img.save(destino, "JPEG", quality=84, optimize=True)
    return nombre


def credito(e: dict[str, Any]) -> str:
    """El crédito que se ve junto a la imagen: «Foto: Autor · CC BY 4.0» (o solo la licencia si es dominio público)."""
    autor = (e.get("autor") or "").strip()
    return f"Foto: {autor} · {e.get('licencia')}" if autor else f"Foto: {e.get('licencia')}"


def credito_largo(e: dict[str, Any]) -> str:
    """El crédito de la descripción: título del archivo, autor, licencia y de dónde sale."""
    titulo = re.sub(r"^File:|\.(?:jpe?g|png)$", "", str(e.get("titulo") or ""), flags=re.I)
    autor = (e.get("autor") or "").strip()
    return f"«{titulo}»" + (f", de {autor}" if autor else "") + f" ({e.get('licencia')}, Wikimedia Commons)"


_cache: dict[tuple[str, str], dict[str, Any]] | None = None


def catalogo(recargar: bool = False) -> dict[tuple[str, str], dict[str, Any]]:
    """("autor", id del libro) o ("leccion", id de la lección) → imagen aprobada. Con IMAGENES_PROPUESTAS=1 entran
    también las propuestas, para verlas antes de aprobarlas. Una entrada sin archivo o sin licencia aceptada no entra."""
    global _cache
    if _cache is None or recargar:
        ver = os.getenv("IMAGENES_PROPUESTAS", "") not in ("", "0")
        tabla: dict[tuple[str, str], dict[str, Any]] = {}
        for archivo in sorted(DIR.glob("*.json")) if DIR.is_dir() else []:
            try:
                datos = json.loads(archivo.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            entradas = [("autor", str(datos.get("libro_id")), datos.get("retrato"))] + [("leccion", str(x.get("leccion_id")), x) for x in datos.get("lecciones") or [] if isinstance(x, dict)]
            for tipo, ident, e in entradas:
                if not isinstance(e, dict) or not e.get("archivo") or not licencia_aceptada(str(e.get("licencia"))):
                    continue
                if not (ARCHIVOS / str(e["archivo"])).is_file():
                    continue
                if e.get("aprobado") is True or ver:
                    tabla[(tipo, ident)] = e
        _cache = tabla
    return _cache
