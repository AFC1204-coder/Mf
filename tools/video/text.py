"""Utilidades de texto del generador de vídeo: limpieza, frases, texto para la voz y términos clave.

Regla de la casa: el generador **no redacta contenido**. Solo recorta el texto de la lección por
frases enteras y lo une con fórmulas fijas («Lección 3 de 8», «Venimos de…»). Todo lo de aquí
está pensado para recortar sin deformar.
"""

from __future__ import annotations

import re
import unicodedata

# Abreviaturas tras las que un punto NO cierra la frase.
_ABREV = (
    "p", "ej", "etc", "vs", "cf", "pág", "págs", "cap", "caps", "ed", "eds", "vol", "núm", "aprox",
    "dr", "dra", "sr", "sra", "srta", "prof", "st", "jr", "mr", "mrs", "ms", "ee", "uu", "a", "d",
    "c", "s", "n", "v", "ca", "art", "fig", "op", "cit", "al", "id", "ibid", "i", "e",
)
_ABREV_RE = re.compile(r"(?<![\wáéíóúüñ])(?:" + "|".join(re.escape(a) for a in _ABREV) + r")\.$", re.IGNORECASE)
_CIERRES = "\"'»”’)]"
_APERTURAS = "\"'«“‘(¿¡["


def clean(raw: str | None) -> str:
    """Texto plano en una línea: sin HTML ni marcas de Markdown, con los espacios normalizados."""
    if not raw:
        return ""
    t = re.sub(r"<[^>]+>", " ", str(raw))
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", t)
    t = re.sub(r"`(.+?)`", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"(?m)^\s*#{1,6}\s+", "", t)
    t = re.sub(r"(?m)^\s*[-•*]\s+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def paragraphs(raw: str | None) -> list[str]:
    """Párrafos del cuerpo (separados por línea en blanco), ya limpios y sin vacíos."""
    if not raw:
        return []
    out = [clean(p) for p in re.split(r"\n\s*\n", str(raw))]
    return [p for p in out if p]


def split_sentences(text: str | None) -> list[str]:
    """Parte un texto en frases completas. No corta en abreviaturas, iniciales, decimales ni dentro de comillas."""
    t = clean(text)
    if not t:
        return []
    out: list[str] = []
    start = 0
    depth = 0  # paréntesis abiertos
    comillas = 0  # « » abiertas
    i = 0
    n = len(t)
    while i < n:
        ch = t[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch in "«“":
            comillas += 1
        elif ch in "»”":
            comillas = max(0, comillas - 1)
        if ch in ".!?…":
            # Agrupa signos seguidos («?!», «...») y los cierres pegados («.»», «?)»).
            j = i
            while j + 1 < n and t[j + 1] in ".!?…":
                j += 1
            k = j
            while k + 1 < n and t[k + 1] in _CIERRES:
                k += 1
                if t[k] == ")":
                    depth = max(0, depth - 1)
                elif t[k] in "»”":
                    comillas = max(0, comillas - 1)
            fin = k + 1
            resto = t[fin:]
            es_final = fin >= n
            corta = False
            if es_final:
                corta = True
            elif resto[:1] == " " and depth == 0 and comillas == 0:
                sig = resto.lstrip()
                primera = sig[:1]
                while primera and primera in _APERTURAS and len(sig) > 1:
                    sig = sig[1:]
                    primera = sig[:1]
                empieza_frase = bool(primera) and (primera.isupper() or primera.isdigit())
                previo = t[start : j + 1]
                if ch == "." and j == i:
                    if _ABREV_RE.search(previo):
                        empieza_frase = False
                    elif re.search(r"(?<![\wáéíóúüñ])[A-ZÁÉÍÓÚÑ]\.$", previo):  # inicial: «B. F. Skinner»
                        empieza_frase = False
                    elif re.search(r"\d\.$", previo) and primera.isdigit():  # «3. 5» no; listas numeradas
                        empieza_frase = False
                corta = empieza_frase
            if corta:
                frase = t[start:fin].strip()
                if frase:
                    out.append(frase)
                start = fin
            i = k
        i += 1
    cola = t[start:].strip()
    if cola:
        out.append(cola)
    # Une restos diminutos («Sí.», «1.») a la frase anterior para no dejar frases sin contenido.
    unidas: list[str] = []
    for f in out:
        if unidas and len(f) < 12:
            unidas[-1] = f"{unidas[-1]} {f}"
        else:
            unidas.append(f)
    return unidas


def n_words(text: str) -> int:
    return len(text.split())


def take_sentences(text: str | None, max_words: int, min_sentences: int = 1) -> str:
    """Primeras frases enteras que caben en `max_words`. Siempre devuelve al menos `min_sentences`."""
    frases = split_sentences(text)
    elegido: list[str] = []
    total = 0
    for f in frases:
        w = n_words(f)
        if len(elegido) >= min_sentences and total + w > max_words:
            break
        elegido.append(f)
        total += w
    return " ".join(elegido)


def shorten_clause(sentence: str, max_words: int) -> str:
    """Para rótulos en pantalla: si la frase no cabe, corta en un límite de cláusula y añade «…».

    El resultado es siempre un prefijo literal de la frase (más «…»): nunca se reescribe.
    """
    s = clean(sentence)
    palabras = s.split()
    if len(palabras) <= max_words:
        return s
    prefijo = " ".join(palabras[:max_words])
    cortes = [m.start() for m in re.finditer(r"[,;:—–]\s|\s[—–]\s|\s\(", prefijo)]
    minimo = len(" ".join(palabras[: max(4, max_words // 2)]))
    validos = [c for c in cortes if c >= minimo]
    corte = validos[-1] if validos else len(prefijo)
    base = prefijo[:corte].rstrip(" ,;:—–(")
    # No dejar abierta una comilla o un paréntesis.
    if base.count("«") > base.count("»"):
        base += "»"
    if base.count("(") > base.count(")"):
        base = base[: base.rfind("(")].rstrip(" ,;:")
    return base + "…"


def for_speech(text: str) -> str:
    """Versión para la voz: mismos términos, sin signos que el motor lee mal.

    No añade ni quita palabras con significado: las flechas y rayas pasan a pausas.
    """
    t = clean(text)
    t = re.sub(r"\s*(?:→|->|⇒|=>)\s*", ", ", t)
    t = re.sub(r"\s+[—–]\s+", ", ", t)
    t = re.sub(r"(?<=\w)[—–](?=\w)", ", ", t)
    t = t.replace("—", ", ").replace("–", ", ")
    t = re.sub(r"\(\s*ej\.?\s*:\s*", "(por ejemplo, ", t, flags=re.IGNORECASE)
    t = re.sub(r"\bp\.\s?ej\.", "por ejemplo", t, flags=re.IGNORECASE)
    t = re.sub(r"\bvs\.?(?=\s)", "frente a", t)
    t = re.sub(r"\betc\.(?=\s+[a-záéíóúñ])", "etcétera,", t)
    t = t.replace("&", " y ")
    t = re.sub(r"[*_`#|]", " ", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    t = re.sub(r",\s*,", ",", t)
    t = re.sub(r"([¿¡(«]),\s*", r"\1", t)
    t = re.sub(r",\s*([.;:!?)»])", r"\1", t)
    return re.sub(r"\s+", " ", t).strip(" ,")


def norm(text: str) -> str:
    """Minúsculas sin tildes, para comparar."""
    t = unicodedata.normalize("NFD", text or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.lower()


def content_tokens(text: str) -> list[str]:
    """Palabras con significado (≥4 letras) normalizadas."""
    return [w for w in re.split(r"[^a-z0-9ñ]+", norm(text)) if len(w) >= 4]


_STOP_INICIO = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "en", "de", "del", "al", "y", "o", "pero", "si", "no",
    "es", "son", "para", "por", "con", "sin", "su", "sus", "lo", "se", "que", "como", "cuando", "esta", "este",
    "esto", "estos", "estas", "esa", "ese", "eso", "ademas", "sin", "segun", "mas", "tambien", "asi", "aunque",
    "cada", "todo", "toda", "todos", "todas", "hay", "tras", "ante", "desde", "hasta", "entre", "sobre", "ni",
    "ya", "solo", "the", "of", "and", "a", "to", "in", "ahi", "aqui", "hoy", "ahora", "primero", "segundo",
    "tercero", "quien", "quienes", "donde", "porque", "pues", "luego", "entonces", "nadie", "nada", "algo",
    "alguien", "otro", "otra", "otros", "otras", "mi", "tu", "nos", "yo", "el", "ella", "ellos",
}
_PARTICULAS = {"de", "del", "la", "las", "los", "el", "y", "von", "van", "der", "da", "di", "of", "the", "and", "in", "for"}


def _token_spans(text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]


def word_index_at(text: str, char_pos: int) -> int:
    """Índice de la palabra (separada por espacios) que contiene `char_pos`."""
    idx = 0
    for i, (a, b) in enumerate(_token_spans(text)):
        if a <= char_pos:
            idx = i
        else:
            break
    return idx


def key_terms(
    text: str,
    hints: list[str] | None = None,
    max_terms: int = 4,
    exclude: list[str] | None = None,
) -> list[tuple[str, int]]:
    """Términos que conviene señalar en pantalla mientras se oyen: (término literal, índice de palabra).

    Tres fuentes, todas literales del propio texto:
      1. expresiones entre comillas («…», "…") de hasta 5 palabras;
      2. nombres propios y títulos (mayúsculas seguidas que no abren frase);
      3. coincidencias con `hints` (rótulos del esquema, etiquetas de la lección).

    `exclude` son textos que ya están a la vista (la frase ancla, el autor, el título): no se repiten.
    """
    t = clean(text)
    encontrados: list[tuple[int, str]] = []

    for m in re.finditer(r"«([^»]{3,60})»|“([^”]{3,60})”|\"([^\"]{3,60})\"", t):
        inner = next(g for g in m.groups() if g)
        inner = inner.strip(" .,;:")
        una_palabra_floja = n_words(inner) == 1 and (len(inner) < 6 or norm(inner) in _STOP_INICIO)
        if 1 <= n_words(inner) <= 5 and not inner.startswith(("¿", "¡")) and not una_palabra_floja:
            encontrados.append((m.start(), inner))

    inicio_frase = {0}
    for m in re.finditer(r"[.!?…:][\"'»”)]*\s+[\"'«“(¿¡]*", t):
        inicio_frase.add(m.end())
    # Un nombre: palabra con mayúscula o abreviatura corta con punto («Dr.», «B.»), encadenadas con partículas.
    nombre = r"(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{0,2}\.(?=\s+[A-ZÁÉÍÓÚÑ])|[A-ZÁÉÍÓÚÑ][\wáéíóúüñ'’-]*)"
    patron = re.compile(nombre + r"(?:\s+(?:(?:de|del|la|las|los|von|van|der|of|the|and|y)\s+)*" + nombre + r")*")
    for m in patron.finditer(t):
        cand = m.group(0).rstrip(".,;:")
        inicio = m.start()
        palabras = cand.split()
        if inicio in inicio_frase:
            # La primera palabra de una frase lleva mayúscula por posición: se descarta si es un artículo
            # o conector («El Dr. Pérez» → «Dr. Pérez») y, si queda sola, no cuenta como nombre.
            while palabras and norm(palabras[0]).rstrip(".") in _STOP_INICIO:
                inicio += len(palabras[0]) + 1
                palabras = palabras[1:]
            if len(palabras) < 2:
                continue
            cand = " ".join(palabras)
        if all(norm(p) in _STOP_INICIO | _PARTICULAS for p in palabras):
            continue
        if len(cand) < 4 or len(palabras) > 5:
            continue
        encontrados.append((inicio, cand))

    tn = norm(t)
    for h in hints or []:
        hc = clean(h).strip(" .,;:")
        # Una palabra suelta («poder», «hábitos») no señala nada: solo valen expresiones de 2 a 4 palabras.
        if not (2 <= n_words(hc) <= 4) or len(hc) < 8:
            continue
        pos = tn.find(norm(hc))
        if pos >= 0 and (pos == 0 or not tn[pos - 1].isalnum()):
            fin = pos + len(norm(hc))
            if fin >= len(tn) or not tn[fin].isalnum():
                encontrados.append((pos, t[pos : pos + len(hc)]))

    encontrados.sort(key=lambda x: x[0])
    vistos: list[str] = []
    salida: list[tuple[str, int]] = []
    ya_visible = [norm(x) for x in (exclude or []) if x]
    for pos, term in encontrados:
        clave = norm(term)
        if any(clave in v or v in clave for v in vistos) or any(clave in x for x in ya_visible):
            continue
        vistos.append(clave)
        salida.append((term, word_index_at(t, pos)))
        if len(salida) >= max_terms:
            break
    return salida


def slugify(text: str, max_len: int = 60) -> str:
    base = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    return slug[:max_len].strip("-") or "sin-titulo"
