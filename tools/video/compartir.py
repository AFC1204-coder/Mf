"""Piezas compartibles: el mismo corpus, contado para verse fuera de la web.

El formato «clase» es una serie: numeración, índice, «venimos de…». Una pieza compartible es lo
contrario: **una sola idea que se entiende sin haber visto nada más**. Cuatro tipos, todos
montados automáticamente con campos del corpus:

    idea       gancho (la idea, en frío) → crédito → el esquema pieza a pieza → el matiz → marca
    pregunta   una pregunta → 3 s para pensar → la respuesta y su porqué → crédito → el matiz → marca
    practica   qué probar → la idea que hay detrás → crédito → el matiz → marca
    libro      el libro en una frase → sus ideas centrales (el mapa) → la frase que las une → marca

Tres reglas propias de este formato (las del generador siguen valiendo: la voz solo dice corpus):

1. **Todo lo que se oye se ve**, en grande y a la vez que se dice (texto cinético por ráfagas de
   2-4 palabras). No hay barra de subtítulos aparte: la pantalla *es* el subtítulo, así que la
   pieza se entiende sin sonido.
2. **Toda pieza de una lección lleva su matiz y su crédito.** La idea sin su límite exagera; el
   libro y el autor acompañan en el pie desde el primer fotograma y se dicen una vez.
3. **Nada ancla a la web.** Ni «lección 3 de 8», ni «la anterior», ni «en la app». Las fórmulas
   que el guion añade están todas en `FORMULAS` y el control de calidad rechaza cualquier otra.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from . import guia as G
from . import text as T
from .corpus import Book, Lesson, Question
from .scriptwriter import Beat, Episode, Part, Scene

COMPARTIR_VERSION = 1

TIPOS = ("idea", "pregunta", "practica", "libro")
ASPECTOS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}

# Fórmulas fijas: lo ÚNICO que la voz dice sin venir del corpus. `lint_pieza` rechaza cualquier otra.
FORMULAS = {
    "credito": "Del libro {libro}, de {autor}.",
    "credito_sin_autor": "Del libro {libro}.",
    "figura": "En una imagen: {titulo}.",
    "matiz": "El matiz.",
    "respuesta": "La respuesta:",
    "idea_detras": "La idea detrás.",
    "libro": "{libro}, de {autor}, en {n} ideas.",
    "libro_sin_autor": "{libro}, en {n} ideas.",
    "une": "Y la idea que las une.",
    "cta": "Más ideas como esta, en Mente Fría.",
    "cta_libro": "Cada idea, con su matiz, en Mente Fría.",
}

# Rótulos fijos de pantalla (no se leen). Son etiquetas de formato, nunca contenido.
ROTULOS = {
    "idea": "UNA IDEA",
    "pregunta": "¿LO SABRÍAS?",
    "practica": "PRUÉBALO",
    "libro": "UN LIBRO EN {n} IDEAS",
    "matiz": "EL MATIZ",
    "pensar": "PIÉNSALO",
    "respuesta": "LA RESPUESTA",
    "idea_detras": "LA IDEA DETRÁS",
    "figura": "EN UNA IMAGEN",
    "credito": "DEL LIBRO",
    "libro_frase": "EL LIBRO EN UNA FRASE",
    "une": "LA IDEA QUE LAS UNE",
    "marca": "MENTE FRÍA",
    "lema": "Biblioteca de ideas",
    "seguir": "Sigue para más ideas con su matiz",
    "recuerda": "QUÉDATE CON ESTO",
}

# Presupuestos (palabras). El texto en pantalla va por páginas: nunca más de PAGINA a la vez.
PAGINA = 14
RAFAGA = 4
MATIZ_PALABRAS = 38
MATIZ_CORTO = 26
FIGURA_PALABRAS = 36
PRACTICA_PALABRAS = 60
ARRANQUE_PALABRAS = 36
PRACTICA_MAX_FRASE = 75
EXPLICACION_PALABRAS = 35
PAUSA_PENSAR_S = 3.0
LECTURA_PPS = 3.6  # palabras por segundo leyendo en silencio una tarjeta

# Duración razonable de cada tipo (segundos estimados): fuera de ahí, aviso.
# Duración que se intenta no pasar. Nunca cortando frases: se lee menos del esquema en voz alta (sigue entero en
# pantalla), se deja el matiz en su primera frase o se acorta la práctica por frases enteras.
OBJETIVO_S = 60.0
PRACTICA_BREVE = 40

LIMITES = {"idea": (22, 75), "pregunta": (20, 70), "practica": (22, 75), "libro": (22, 90)}

# Texto que solo tiene sentido dentro de la web (o delante de las opciones de un test).
ANCLA_WEB = re.compile(
    r"\blecci[oó]n(es)?\b|cap[ií]tulo anterior|como vimos|hemos visto|\bapp\b|en la web|esta ficha|este resumen|\bm[oó]dulo\b"
    r"|seg[uú]n el texto|seg[uú]n lo visto|el pasaje|el fragmento|(en|del) (el |este )?cap[ií]tulo|cap[ií]tulo \d",
    re.IGNORECASE,
)
ALUDE_OPCIONES = re.compile(
    r"\bopci[oó]n\b|\bopciones\b|distractor|las dem[aá]s|las otras|los otros|el resto|\balternativas?\b|\blecci[oó]n\b|el texto|anteriores",
    re.IGNORECASE,
)
# Una salvedad de seguridad no se recorta nunca: si la lección la trae, la pieza también.
SALVEDAD = re.compile(
    r"no sustituye|no reemplaza|profesional(es)? (sanitari|de la salud|m[eé]dic|cualificad)|consulta (con|a) (un|tu|su)|"
    r"consejo (m[eé]dico|financiero|legal|personalizado)|asesor(a|amiento)? (financier|m[eé]dic|legal|profesional)|"
    r"atenci[oó]n m[eé]dica|tu m[eé]dico|un m[eé]dico|no es (un )?(consejo|diagn[oó]stico|tratamiento)",
    re.IGNORECASE,
)
# Arranques que hablan del libro en vez de decir algo («Newport dedica una sección…»): no sirven de gancho.
ARRANQUE_META = re.compile(
    r"^(?:(?:el|la|este|esta) (?:libro|autor|autora|cap[ií]tulo|secci[oó]n|obra|ensayo)|[A-ZÁÉÍÓÚÑ][\wáéíóúüñ'’-]+(?: [A-ZÁÉÍÓÚÑ][\wáéíóúüñ'’-]+)?)"
    r" (?:dedica|articula|presenta|desarrolla|aborda|introduce|cierra|abre|comienza|empieza|documenta|termina|concluye|ofrece|propone una|analiza|examina|explora|describe)\b"
    r"|^una de las (?:contribuciones|ideas|secciones|aportaciones|partes|claves)\b|^para entender\b|^en est[ea] (?:cap[ií]tulo|secci[oó]n|parte)\b",
    re.IGNORECASE,
)
_INGLES = re.compile(r"\b(the|of|and|is|to|that|in|with|for|not|you|it|are|was|this|have)\b", re.IGNORECASE)

# Etiquetas de publicación por eje (fijas y declaradas; el resto sale del libro y del autor).
ETIQUETAS_EJE = {
    "Psicología y Conducta": ["psicología", "comportamiento"],
    "Pensamiento y Civilización": ["filosofía", "historia"],
    "Economía y Mercados": ["economía", "finanzas"],
    "Neurociencia y Biología": ["neurociencia", "ciencia"],
    "Desarrollo Humano": ["desarrollopersonal", "aprendizaje"],
}


@dataclass
class Pieza(Episode):
    """Una pieza compartible. Es un `Episode` (se renderiza igual) con lo que hace falta para publicarla."""

    tipo: str = "idea"
    leccion_n: int = 0  # posición de la lección en el libro (solo para ordenar y nombrar; no sale en el vídeo)
    gancho: str = ""  # lo primero que se ve y se oye
    gancho_origen: str = ""
    arco: str = ""  # completo | sin_esquema | esquema_primero (idea) · vacío en los demás tipos
    titulo_pub: str = ""
    descripcion_pub: str = ""
    etiquetas_pub: list[str] = field(default_factory=list)
    portada: dict[str, Any] = field(default_factory=dict)  # vista de la miniatura

    def to_dict(self) -> dict[str, Any]:
        d = super().to_dict()
        d["compartir_version"] = COMPARTIR_VERSION
        return d


@dataclass
class Omitida:
    """Una pieza que no sale, y por qué (para el manifiesto: nada desaparece en silencio)."""

    tipo: str
    leccion_n: int
    titulo: str
    motivo: str


# ───────────────────────── selección de texto (siempre literal) ─────────────────────────

def titulo_corto(titulo: str) -> str:
    """El título como se cita de palabra: sin subtítulo ni paréntesis. Siempre un prefijo literal."""
    t = T.clean(titulo)
    for sep in (": ", " — ", " – ", " ("):
        pos = t.find(sep)
        if pos > 0:
            base = t[:pos].strip()
            if T.n_words(base) >= 2 or len(base) >= 8:
                return base
    return t


def parece_ingles(texto: str) -> bool:
    palabras = texto.split()
    return len(_INGLES.findall(texto)) >= max(3, len(palabras) * 0.18)


def hilo(lesson: Lesson) -> tuple[str, str]:
    """La idea de la lección en una frase y de qué campo sale.

    idea clave → idea redactada por la app (`cita_memorable`, que NO es una cita y nunca se entrecomilla)
    → arranque del cuerpo. Se salta lo que esté en otro idioma: una voz en español no debe leerlo.
    """
    candidatas: list[tuple[str, str]] = []
    for campo in ("idea_clave", "cita_memorable"):
        texto = T.clean(getattr(lesson, campo))
        if texto and not parece_ingles(texto):
            candidatas.append((texto, campo))
    frases = T.split_sentences(lesson.cuerpo.split("\n\n")[0] if lesson.cuerpo else "")
    if frases:
        # Sin idea redactada, el arranque del cuerpo: las primeras frases enteras (una sola suele ser solo el planteamiento).
        candidatas.append((T.take_sentences(" ".join(frases), ARRANQUE_PALABRAS), "cuerpo"))
    if not candidatas:
        return T.clean(lesson.titulo), "titulo"
    # Mejor una que no hable de «la lección»: la pieza se ve sin la lección delante.
    return next((c for c in candidatas if not ANCLA_WEB.search(c[0])), candidatas[0])


def arranque_literal(texto: str, max_words: int) -> str:
    """El texto entero si cabe; si no, su arranque hasta un límite de cláusula, con «…». Siempre un prefijo literal."""
    t = T.clean(texto)
    if T.n_words(t) <= max_words:
        return t
    corto = T.shorten_clause(t, max_words)
    if t.startswith(corto.rstrip("…")):
        return corto
    return " ".join(t.split()[:max_words]).rstrip(" ,;:—–(") + "…"  # shorten_clause cerró una comilla o quitó un paréntesis


def tema(lesson: Lesson) -> str:
    """El tema de la pieza: el título de la lección hasta los dos puntos (rótulo, no se lee)."""
    return T.shorten_clause(titulo_corto(lesson.titulo), 9)


def matiz_partes(lesson: Lesson, max_words: int = MATIZ_PALABRAS) -> list[Part]:
    """El matiz por frases enteras desde el principio, más cualquier salvedad de seguridad que quedara fuera."""
    frases = T.split_sentences(lesson.autocorreccion)
    if not frases:
        return []
    cabeza = T.take_sentences(lesson.autocorreccion, max_words)
    n_cabeza = len(T.split_sentences(cabeza))
    partes = [Part(cabeza, "leccion.autocorreccion")]
    for f in frases[n_cabeza:]:
        if SALVEDAD.search(f):
            partes.append(Part(f, "leccion.autocorreccion"))
    return partes


def practica_partes(lesson: Lesson, max_words: int = PRACTICA_PALABRAS) -> list[Part]:
    """La aplicación práctica: entera si cabe; si no, sus primeras frases y sus salvedades. [] si no hay pieza."""
    frases = T.split_sentences(lesson.aplicacion_practica)
    if not frases or T.n_words(frases[0]) > PRACTICA_MAX_FRASE or parece_ingles(frases[0]):
        return []
    cabeza = T.take_sentences(lesson.aplicacion_practica, max_words)
    n_cabeza = len(T.split_sentences(cabeza))
    partes = [Part(cabeza, "leccion.aplicacion_practica")]
    for f in frases[n_cabeza:]:
        if SALVEDAD.search(f):
            partes.append(Part(f, "leccion.aplicacion_practica"))
    return partes


def pregunta_autonoma(lesson: Lesson) -> Question | None:
    """Una pregunta de la lección que se entiende sin la lección delante (y sin ver las demás opciones)."""
    candidatas = []
    for q in lesson.preguntas:
        if not q.valid:
            continue
        correcta = q.opciones[q.correcta]
        if ANCLA_WEB.search(q.texto) or ALUDE_OPCIONES.search(correcta) or ANCLA_WEB.search(correcta):
            continue
        if re.search(r"\b(todas|ninguna|ambas|a y b|b y c)\b", T.norm(correcta)) and T.n_words(correcta) <= 6:
            continue
        candidatas.append(q)
    if not candidatas:
        return None
    return sorted(candidatas, key=lambda q: (q.dificultad, len(q.texto), q.id))[0]


def explicacion_autonoma(q: Question, max_words: int = EXPLICACION_PALABRAS) -> str:
    """Las primeras frases de la explicación que no hablan de «las otras opciones» ni de «la lección»."""
    elegidas: list[str] = []
    total = 0
    for f in T.split_sentences(q.explicacion):
        if ALUDE_OPCIONES.search(f) or ANCLA_WEB.search(f):
            break  # solo el tramo inicial: saltar una frase puede dejar colgada la siguiente
        if elegidas and total + T.n_words(f) > max_words:
            break
        elegidas.append(f)
        total += T.n_words(f)
    return " ".join(elegidas)


def _punto(texto: str) -> str:
    t = T.clean(texto).rstrip()
    return t if t.endswith((".", "!", "?", "…", ":")) else t + "."


# ───────────────────────── texto cinético: páginas y ráfagas ─────────────────────────

_FIN_FRASE = (".", "!", "?", "…")
_FIN_CLAUSULA = (",", ";", ":", "—", "–")


def _cierra(tok: str, signos: tuple[str, ...]) -> bool:
    return tok.rstrip("\"'»”)]").endswith(signos)


def paginar(tokens: list[str], max_words: int = PAGINA) -> list[tuple[int, int]]:
    """Reparte el texto en páginas [a, b) de como mucho `max_words` palabras, parecidas entre sí.

    Cada corte busca, cerca del reparto ideal, un final de frase; si no lo hay, un límite de cláusula;
    si tampoco, corta donde toca. Así no queda una página con dos palabras sueltas.
    """
    n = len(tokens)
    if n <= max_words:
        return [(0, n)] if n else []
    paginas: list[tuple[int, int]] = []
    a = 0
    while n - a > max_words:
        quedan = -(-(n - a) // max_words)  # páginas que faltan, contando esta
        ideal = a + round((n - a) / quedan)
        desde, hasta = max(a + 3, ideal - 4), min(a + max_words, n - 3)
        corte = 0
        for signos in (_FIN_FRASE, _FIN_CLAUSULA):
            candidatos = [i + 1 for i in range(desde - 1, hasta) if _cierra(tokens[i], signos)]
            if candidatos:
                corte = min(candidatos, key=lambda c: abs(c - ideal))
                break
        corte = corte or min(max(ideal, a + 1), a + max_words)
        paginas.append((a, corte))
        a = corte
    paginas.append((a, n))
    return paginas


def rafagas(tokens: list[str], a: int, b: int, max_words: int = RAFAGA) -> list[tuple[int, int]]:
    """Ráfagas [i, j) dentro de una página: 2-4 palabras que entran juntas, cortadas por la puntuación."""
    out: list[tuple[int, int]] = []
    i = a
    for k in range(a, b):
        largo = k - i + 1
        chars = sum(len(t) + 1 for t in tokens[i : k + 1])
        fin = _cierra(tokens[k], _FIN_FRASE) or (largo >= 2 and _cierra(tokens[k], _FIN_CLAUSULA))
        if fin or largo >= max_words or chars >= 26:
            out.append((i, k + 1))
            i = k + 1
    if i < b:
        out.append((i, b))
    # Una palabra suelta al final se une a la ráfaga anterior.
    if len(out) >= 2 and out[-1][1] - out[-1][0] == 1 and out[-2][1] - out[-2][0] <= max_words:
        out[-2:] = [(out[-2][0], out[-1][1])]
    return out


def escena_frase(
    section: str,
    estilo: str,
    rotulo: str,
    parts: list[Part],
    skip_parts: int = 0,
    tema_txt: str = "",
    pause_after_s: float = 0.35,
) -> Scene:
    """Texto cinético: lo que dice la voz entra en pantalla por ráfagas, página a página.

    `skip_parts` son los tramos iniciales que no se escriben porque ya los dice el rótulo
    («El matiz.» → EL MATIZ). El resto de la locución se ve entero, literal.
    """
    narracion = " ".join(p.text for p in parts if p.text).strip()
    tokens = narracion.split()
    salto = sum(T.n_words(p.text) for p in parts[:skip_parts])
    visibles = tokens[salto:]
    paginas = paginar(visibles)
    cortes: list[tuple[int, int, int]] = []  # (página, inicio, fin) de cada ráfaga, sobre `visibles`
    for pi, (a, b) in enumerate(paginas):
        cortes += [(pi, i, j) for i, j in rafagas(visibles, a, b)]
    view: dict[str, Any] = {
        "style": estilo,
        "kicker": rotulo,
        "tema": tema_txt,
        "words": visibles,
        "pages": [list(p) for p in paginas],
        "page": 0,
        "shown": 0,
        "hot": [0, 0],
    }
    beats: list[Beat] = []
    for n, (pi, i, j) in enumerate(cortes):
        patch = {"page": pi, "shown": j, "hot": [i, j]}
        if n == 0 and salto == 0:
            view.update(patch)  # la primera ráfaga está desde el primer fotograma
        else:
            beats.append(Beat(patch, at_word=salto + i))
    return Scene("c-frase", section, view, list(parts), beats, pause_after_s=pause_after_s)


# ───────────────────────── escenas compartidas ─────────────────────────

def _fixed(clave: str, origen: str = "plantilla", **kw: Any) -> Part:
    return Part(FORMULAS[clave].format(**kw), origen)


def escena_credito(book: Book, clave: str = "credito", **kw: Any) -> Scene:
    clave = clave if book.autor else f"{clave}_sin_autor"
    parte = _fixed(clave, "plantilla+titulos", libro=titulo_corto(book.titulo), autor=book.autor, **kw)
    return Scene(
        "c-credito",
        "Libro",
        {"kicker": kw.get("rotulo") or ROTULOS["credito"], "title": titulo_corto(book.titulo), "author": book.autor, "eje": book.eje},
        [parte],
        pause_after_s=0.3,
    )


def escena_matiz(lesson: Lesson, max_words: int = MATIZ_PALABRAS) -> Scene | None:
    partes = matiz_partes(lesson, max_words)
    if not partes:
        return None
    return escena_frase("Matiz", "matiz", ROTULOS["matiz"], [_fixed("matiz"), *partes], skip_parts=1, pause_after_s=0.5)


def escena_cierre(book: Book, clave: str = "cta", recuerda: str = "") -> Scene:
    """La marca y, encima, el gancho otra vez (literal, sin voz): la pieza cierra con lo que abrió, un solo mensaje para llevarse."""
    return Scene(
        "c-cierre",
        "",
        {
            "brand": ROTULOS["marca"], "lema": ROTULOS["lema"], "said": FORMULAS[clave], "cta": ROTULOS["seguir"],
            "title": book.titulo, "author": book.autor,
            "recuerda": arranque_literal(recuerda, 18) if recuerda else "", "recuerda_rotulo": ROTULOS["recuerda"],
        },
        [_fixed(clave)],
        pause_after_s=1.1,
    )


# Qué forma visual cuenta mejor cada tipo de figura. Todas usan los rótulos literales, en su orden.
PATRONES = {
    "comparar": "contraste",  # dos paneles enfrentados: la idea está en la diferencia
    "pasos": "cadena",  # eslabones que se van encadenando: la idea está en el orden (causa → efecto, antes → después)
    "piramide": "cadena",
}


def patron_visual(spec: dict[str, Any]) -> str:
    """«contraste», «cadena» o «silueta» (la forma de la figura con insignias: ciclos, mapas, matrices)."""
    return PATRONES.get(str(spec.get("plantilla")), "silueta")


def _lectura(p: G.Piece, nivel: int) -> list[str]:
    """Qué se lee de una pieza del esquema: todo, título + su primer rótulo, o solo el título."""
    if nivel == 0:
        return p.lines
    if nivel == 1:
        return p.lines[:2]
    return [p.t]


def escenas_figura(lesson: Lesson, nivel_min: int = 0) -> list[Scene]:
    """El esquema verificado en formato legible: silueta sin texto + tarjeta grande de cada pieza.

    La tarjeta enseña la pieza **entera y literal**; la voz la lee entera si el esquema es breve y,
    si no, solo su título (y su primer rótulo). Cada tarjeta dura lo que se tarda en leerla.
    """
    specs = lesson.main_diagrams()[:1]
    ps = G.pieces(specs[0]) if specs else []
    if not ps:
        return []
    spec = specs[0]
    titulo = T.clean(spec.get("titulo"))
    pie = T.clean(spec.get("pie"))
    base = {
        "spec": spec, "pieces": [p.to_view() for p in ps], "order": G.order(ps), "n": len(ps), "title": titulo,
        "kicker": ROTULOS["figura"], "patron": patron_visual(spec),
    }
    nivel = next((nv for nv in (0, 1, 2) if nv >= nivel_min and sum(T.n_words(x) for p in ps for x in _lectura(p, nv)) <= FIGURA_PALABRAS), 2)

    intro = _fixed("figura", "plantilla+esquema.titulo", titulo=titulo.rstrip(".")) if titulo else None
    scenes = [Scene("c-figura", "Esquema", dict(base, mode="titulo", active=-1, shown=len(ps)), [intro] if intro else [], hold_s=0.0 if intro else 1.2, pause_after_s=0.35)]
    for j, p in enumerate(ps):
        partes = [Part(_punto(x), "esquema.datos") for x in _lectura(p, nivel)]
        hablado = sum(T.n_words(x.text) for x in partes) / 2.4
        leer = sum(T.n_words(x) for x in p.lines) / LECTURA_PPS + 0.5
        scenes.append(
            Scene("c-figura", "Esquema", dict(base, mode="pieza", active=j, shown=j + 1), partes, pause_after_s=round(max(0.3, leer - hablado), 2))
        )
    if pie:
        scenes.append(Scene("c-figura", "Esquema", dict(base, mode="pie", active=-1, shown=len(ps), pie=pie), [Part(_punto(pie), "esquema.pie")], pause_after_s=0.6))
    return scenes


# ───────────────────────── las cuatro piezas ─────────────────────────

def _base(book: Book, **kw: Any) -> Pieza:
    return Pieza(book_id=book.id, book_title=book.titulo, book_author=book.autor, eje=book.eje, total=len(book.lessons), kind="pieza", number=0, **kw)


def _clave(tipo: str, k: int, lesson: Lesson) -> str:
    return f"{tipo}-{k:02d}-{T.slugify(lesson.titulo, 44)}"


def _etiquetas(book: Book, lesson: Lesson | None = None) -> list[str]:
    """Etiquetas de publicación: marca, libros, eje, autor (si es uno) y hasta dos del dominio de la lección."""

    def tag(texto: str) -> str:
        return "#" + "".join(w[:1].upper() + w[1:] for w in re.split(r"[^\wáéíóúüñÁÉÍÓÚÜÑ]+", T.clean(texto)) if w)

    out = ["#MenteFría", "#libros"] + ["#" + e for e in ETIQUETAS_EJE.get(book.eje, [])]
    if book.autor and not re.search(r"\by\b|,|&| and ", book.autor) and T.n_words(book.autor) <= 4:
        out.append(tag(book.autor))
    for e in (lesson.etiquetas if lesson else [])[:2]:
        if 1 <= T.n_words(e) <= 3 and len(e) <= 28:
            out.append(tag(e).lower())
    vistos: list[str] = []
    for t in out:
        if len(t) > 1 and T.norm(t) not in [T.norm(v) for v in vistos]:
            vistos.append(t)
    return vistos[:8]


def _descripcion(book: Book, cuerpo: list[str]) -> str:
    credito = f"Del libro «{book.titulo}»" + (f", de {book.autor}." if book.autor else ".")
    return "\n\n".join([*[c for c in cuerpo if c], credito, f"{ROTULOS['marca']} · {ROTULOS['lema'].lower()}"])


def _matiz_pub(lesson: Lesson) -> str:
    frases = T.split_sentences(lesson.autocorreccion)
    return f"El matiz: {frases[0]}" if frases else ""


def pregunta_del_cuerpo(lesson: Lesson) -> str:
    """Si la propia lección arranca con una pregunta breve, esa pregunta (literal): es su tensión, y la idea la resuelve."""
    frases = T.split_sentences(lesson.cuerpo.split("\n\n")[0] if lesson.cuerpo else "")
    if frases and frases[0].endswith("?") and 4 <= T.n_words(frases[0]) <= 24 and not ANCLA_WEB.search(frases[0]):
        return frases[0]
    return ""


def pieza_idea(book: Book, index: int) -> Pieza | None:
    """La pieza principal, con arco: tensión (la idea en frío, o la pregunta que la lección se hace) →
    de dónde sale → desarrollo visible (el esquema, con el patrón que le va) → giro (el matiz) → cierre que retoma el gancho.

    Si la lección no da para ese arco, no se fuerza:
      · sin figura recorrible → idea y matiz («sin_esquema»);
      · sin idea redactada y con un arranque que solo habla del libro → abre el esquema («esquema_primero»);
      · sin ninguna de las dos cosas → no hay pieza.
    """
    pieza = None
    for apretar in (0, 1, 2, 3):  # 0: como sale · 1: matiz breve · 2 y 3: el esquema se lee menos en voz alta
        pieza = _pieza_idea(book, index, apretar)
        if pieza is None or pieza.estimated_seconds <= OBJETIVO_S:
            break
    return pieza


def _pieza_idea(book: Book, index: int, apretar: int = 0) -> Pieza | None:
    lesson = book.lessons[index]
    k = index + 1
    idea, origen = hilo(lesson)
    figura = escenas_figura(lesson, nivel_min=max(0, apretar - 1))
    largo_figura = sum(s.estimated_seconds for s in figura)
    flojo = origen in ("cuerpo", "titulo") and (origen == "titulo" or bool(ARRANQUE_META.search(idea)))
    if flojo and not figura:
        return None
    scenes: list[Scene] = []
    if flojo:
        arco = "esquema_primero"
        gancho, gancho_origen = T.clean(figura[0].view.get("title")), "esquema.titulo"
        figura[0].view["tema"] = tema(lesson)
        scenes += [*figura, escena_credito(book)]
        recuerda = T.clean(figura[-1].view.get("pie")) or gancho
    else:
        arco = "completo" if figura else "sin_esquema"
        gancho, gancho_origen = idea, f"leccion.{origen}"
        abre = pregunta_del_cuerpo(lesson) if origen != "cuerpo" else ""
        if abre:
            scenes.append(escena_frase("Pregunta", "pregunta", ROTULOS["idea"], [Part(abre, "leccion.cuerpo")], tema_txt=tema(lesson), pause_after_s=0.7))
            gancho, gancho_origen = abre, "leccion.cuerpo"
        scenes += [
            escena_frase("Idea", "idea", ROTULOS["idea"], [Part(idea, f"leccion.{origen}")], tema_txt=tema(lesson), pause_after_s=0.4),
            escena_credito(book),
            *figura,
        ]
        recuerda = idea
    matiz = escena_matiz(lesson, MATIZ_CORTO if (largo_figura > 16 or apretar) else MATIZ_PALABRAS)
    if matiz:
        scenes.append(matiz)
    scenes.append(escena_cierre(book, recuerda=recuerda))
    return _base(
        book,
        key=_clave("idea", k, lesson),
        format="idea",
        tipo="idea",
        title=lesson.titulo,
        lesson_id=lesson.id,
        leccion_n=k,
        scenes=scenes,
        summary=idea,
        gancho=gancho,
        gancho_origen=gancho_origen,
        arco=arco,
        titulo_pub=T.shorten_clause(lesson.titulo, 16),
        descripcion_pub=_descripcion(book, [gancho if flojo else idea, _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["idea"], "text": arranque_literal(gancho, 18), "tema": tema(lesson)},
    )


def pieza_pregunta(book: Book, index: int) -> Pieza | None:
    """Pregunta → pausa → respuesta. Sin las opciones falsas: sueltas en una captura, desinforman."""
    lesson = book.lessons[index]
    q = pregunta_autonoma(lesson)
    if not q:
        return None
    k = index + 1
    correcta = _punto(q.opciones[q.correcta])
    explic = explicacion_autonoma(q)
    respuesta = [_fixed("respuesta"), Part(correcta, "pregunta.opcion")] + ([Part(explic, "pregunta.explicacion")] if explic else [])
    pensar = Scene(
        "c-pausa",
        "Pregunta",
        {"kicker": ROTULOS["pensar"], "question": q.texto, "countdown": 3},
        [],
        [Beat({"countdown": c}, at_s=PAUSA_PENSAR_S * (3 - c) / 3) for c in (2, 1)],
        hold_s=PAUSA_PENSAR_S,
        pause_after_s=0.0,
    )
    scenes: list[Scene] = [
        escena_frase("Pregunta", "pregunta", ROTULOS["pregunta"], [Part(q.texto, "pregunta.texto")], tema_txt=tema(lesson), pause_after_s=0.15),
        pensar,
        escena_frase("Respuesta", "respuesta", ROTULOS["respuesta"], respuesta, skip_parts=1, pause_after_s=0.5),
        escena_credito(book),
    ]
    matiz = escena_matiz(lesson, MATIZ_CORTO)
    if matiz:
        scenes.append(matiz)
    scenes.append(escena_cierre(book, recuerda=correcta))  # cierra con la respuesta a la pregunta que abrió
    return _base(
        book,
        key=_clave("pregunta", k, lesson),
        format="pregunta",
        tipo="pregunta",
        title=lesson.titulo,
        lesson_id=lesson.id,
        leccion_n=k,
        scenes=scenes,
        summary=q.texto,
        gancho=q.texto,
        gancho_origen="pregunta.texto",
        titulo_pub=T.shorten_clause(q.texto, 18),
        descripcion_pub=_descripcion(book, [q.texto, f"La respuesta: {correcta}", _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["pregunta"], "text": arranque_literal(q.texto, 20), "tema": tema(lesson)},
    )


def pieza_practica(book: Book, index: int) -> Pieza | None:
    """Qué probar → la idea que hay detrás → el matiz."""
    pieza = _pieza_practica(book, index, PRACTICA_PALABRAS)
    if pieza is not None and pieza.estimated_seconds > OBJETIVO_S:
        pieza = _pieza_practica(book, index, PRACTICA_BREVE)
    return pieza


def _pieza_practica(book: Book, index: int, max_words: int) -> Pieza | None:
    lesson = book.lessons[index]
    partes = practica_partes(lesson, max_words)
    if not partes:
        return None
    k = index + 1
    idea, origen = hilo(lesson)
    if origen in ("cuerpo", "titulo") and (origen == "titulo" or ARRANQUE_META.search(idea)):
        return None  # sin una idea que decir, «la idea detrás» no se sostiene
    gancho = T.split_sentences(partes[0].text)[0]
    scenes: list[Scene] = [
        escena_frase("Práctica", "practica", ROTULOS["practica"], partes, tema_txt=tema(lesson), pause_after_s=0.45),
        escena_frase("Idea", "idea", ROTULOS["idea_detras"], [_fixed("idea_detras"), Part(idea, f"leccion.{origen}")], skip_parts=1, pause_after_s=0.4),
        escena_credito(book),
    ]
    matiz = escena_matiz(lesson, MATIZ_CORTO)
    if matiz:
        scenes.append(matiz)
    scenes.append(escena_cierre(book, recuerda=gancho))
    return _base(
        book,
        key=_clave("practica", k, lesson),
        format="practica",
        tipo="practica",
        title=lesson.titulo,
        lesson_id=lesson.id,
        leccion_n=k,
        scenes=scenes,
        summary=partes[0].text,
        gancho=gancho,
        gancho_origen="leccion.aplicacion_practica",
        titulo_pub=T.shorten_clause(f"Pruébalo: {titulo_corto(lesson.titulo)}", 16),
        descripcion_pub=_descripcion(book, [partes[0].text, f"La idea detrás: {idea}", _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["practica"], "text": arranque_literal(gancho, 18), "tema": tema(lesson)},
    )


def pieza_libro(book: Book) -> Pieza | None:
    """El libro en una frase y en sus ideas centrales: el mapa verificado de `datos/mapas.json`."""
    mapa = book.mapa or {}
    nodos = [n for n in (mapa.get("nodos") or []) if isinstance(n, dict) and T.clean(n.get("etiqueta"))]
    cierre = T.clean(mapa.get("cierre"))
    if len(nodos) < 3 or not cierre or parece_ingles(cierre):
        return None
    n = len(nodos)
    rotulo = ROTULOS["libro"].format(n=n)
    scenes: list[Scene] = [
        escena_frase("Libro", "idea", ROTULOS["libro_frase"], [Part(_punto(cierre), "mapa.cierre")], pause_after_s=0.4),
        escena_credito(book, "libro", n=n, rotulo=rotulo),
    ]
    etiquetas = [T.clean(x.get("etiqueta")) for x in nodos]
    for i, nodo in enumerate(nodos):
        etiqueta = etiquetas[i].rstrip(".")
        texto = T.clean(nodo.get("texto")).rstrip(".")
        scenes.append(
            Scene(
                "c-nodo",
                "Ideas",
                {"kicker": rotulo, "index": i, "n": n, "icon": nodo.get("icono"), "label": etiqueta, "text": texto},
                [Part(f"{etiqueta}." + (f" {texto}." if texto else ""), "mapa.nodos")],
                pause_after_s=0.3,
            )
        )
    scenes.append(escena_frase("Cierre", "idea", ROTULOS["une"], [_fixed("une"), Part(_punto(cierre), "mapa.cierre")], skip_parts=1, pause_after_s=0.5))
    scenes.append(escena_cierre(book, "cta_libro", recuerda=cierre))
    return _base(
        book,
        key="libro",
        format="libro",
        tipo="libro",
        title=book.titulo,
        scenes=scenes,
        summary=cierre,
        gancho=cierre,
        gancho_origen="mapa.cierre",
        titulo_pub=T.shorten_clause(f"{titulo_corto(book.titulo)} en {n} ideas", 16),
        descripcion_pub=_descripcion(book, [_punto(cierre), " · ".join(etiquetas)]),
        etiquetas_pub=_etiquetas(book),
        portada={"tag": rotulo, "text": arranque_literal(cierre, 20), "tema": ""},
    )


# ───────────────────────── el plan de un libro ─────────────────────────

@dataclass
class Plan:
    piezas: list[Pieza]
    omitidas: list[Omitida]
    orden: list[str]  # claves en el orden de publicación sugerido


_MOTIVO = {
    "idea": "la lección no tiene idea redactada, su arranque solo habla del libro y su figura no se puede recorrer: no hay arco que contar",
    "pregunta": "la lección no tiene una pregunta que se entienda sin la lección delante",
    "practica": "la aplicación práctica no cabe en una pieza, o la lección no tiene una idea que poner detrás",
    "libro": "el libro no tiene mapa con frase de cierre en datos/mapas.json",
}


def _huella_gancho(texto: str) -> str:
    return " ".join(T.content_tokens(texto))


def plan_libro(book: Book, tipos: tuple[str, ...] | list[str] = TIPOS, solo_leccion: int | None = None) -> Plan:
    """Todas las piezas de un libro, sin ganchos repetidos, y el orden en que conviene publicarlas."""
    piezas: list[Pieza] = []
    omitidas: list[Omitida] = []
    if "libro" in tipos and solo_leccion is None:
        p = pieza_libro(book)
        if p:
            piezas.append(p)
        else:
            omitidas.append(Omitida("libro", 0, book.titulo, _MOTIVO["libro"]))
    indices = range(len(book.lessons)) if solo_leccion is None else [solo_leccion]
    constructores = {"idea": pieza_idea, "pregunta": pieza_pregunta, "practica": pieza_practica}
    for i in indices:
        for tipo in ("idea", "pregunta", "practica"):
            if tipo not in tipos:
                continue
            p = constructores[tipo](book, i)
            if p:
                piezas.append(p)
            else:
                omitidas.append(Omitida(tipo, i + 1, book.lessons[i].titulo, _MOTIVO[tipo]))

    # Dos piezas no pueden abrir igual: la segunda se cae (y queda anotada).
    vistos: dict[str, str] = {}
    unicas: list[Pieza] = []
    for p in piezas:
        h = _huella_gancho(p.gancho)
        if h and h in vistos:
            omitidas.append(Omitida(p.tipo, p.leccion_n, p.title, f"abre igual que «{vistos[h]}»"))
            continue
        vistos[h] = p.key
        unicas.append(p)
    return Plan(unicas, omitidas, orden_sugerido(unicas))


def orden_sugerido(piezas: list[Pieza]) -> list[str]:
    """Orden de publicación: el libro primero; después dos ideas y una pieza de otro tipo de una lección ya vista.

    Así el formato cambia de un día a otro y dos piezas de la misma lección no salen seguidas.
    """
    libro = [p.key for p in piezas if p.tipo == "libro"]
    ideas = [p for p in piezas if p.tipo == "idea"]
    otras = sorted((p for p in piezas if p.tipo in ("pregunta", "practica")), key=lambda p: (p.leccion_n, p.tipo))
    # Se alternan pregunta y práctica en lo posible.
    preguntas = [p for p in otras if p.tipo == "pregunta"]
    practicas = [p for p in otras if p.tipo == "practica"]
    cola: list[Pieza] = []
    while preguntas or practicas:
        if preguntas:
            cola.append(preguntas.pop(0))
        if practicas:
            cola.append(practicas.pop(0))
    orden = list(libro)
    ultima_leccion = 0
    desde_otra = 0
    while ideas or cola:
        if ideas and (desde_otra < 2 or not cola):
            p = ideas.pop(0)
            desde_otra += 1
        else:
            # una pieza de una lección ya presentada y distinta de la que acaba de salir
            j = next((i for i, c in enumerate(cola) if c.leccion_n != ultima_leccion and (not ideas or c.leccion_n < ideas[0].leccion_n)), 0)
            p = cola.pop(j)
            desde_otra = 0
        orden.append(p.key)
        ultima_leccion = p.leccion_n
    return orden


def motivo_libro(book: Book) -> int:
    """Motivo gráfico del libro (0-3): con el acento del eje, hace reconocibles las piezas de un mismo libro."""
    return int(hashlib.sha256(book.id.encode("utf-8")).hexdigest(), 16) % 4


# ───────────────────────── publicación ─────────────────────────

def texto_publicacion(p: Pieza, duracion_s: float = 0.0) -> str:
    """Lo que acompaña al vídeo al subirlo: título, descripción y etiquetas. Todo sale del corpus y de `ROTULOS`."""
    lineas = [p.titulo_pub, "", p.descripcion_pub, "", " ".join(p.etiquetas_pub)]
    if duracion_s:
        lineas += ["", f"({ROTULOS[p.tipo].format(n=sum(1 for s in p.scenes if s.kind == 'c-nodo'))} · {duracion_s:.0f} s)"]
    return "\n".join(lineas).rstrip() + "\n"


def guion_markdown(p: Pieza) -> str:
    """Guion legible para revisar una pieza antes de renderizarla: qué se oye, qué se ve y de qué campo sale."""
    from .compartir_frames import estados, palabras_en_pantalla

    lineas = [
        f"# Pieza «{p.tipo}» · {p.title}",
        "",
        f"- **Libro:** {p.book_title}" + (f" — {p.book_author}" if p.book_author else ""),
        f"- **Gancho** ({p.gancho_origen}): {p.gancho}",
        f"- **Palabras:** {p.total_words} · **duración estimada:** ~{p.estimated_seconds:.0f} s",
        f"- **Título de publicación:** {p.titulo_pub}",
        "",
        "---",
        "",
    ]
    for i, s in enumerate(p.scenes, start=1):
        maximo = max((palabras_en_pantalla(s.kind, v) for v in estados(s)), default=0)
        lineas.append(f"## {i}. {s.view.get('kicker') or s.kind} · `{s.kind}` (~{s.estimated_seconds:.0f} s · hasta {maximo} palabras a la vista)")
        lineas.append("")
        if s.kind == "c-figura":
            spec = s.view.get("spec") or {}
            lineas.append(f"**En pantalla:** silueta del esquema «{spec.get('titulo', '')}» ({spec.get('plantilla', '?')}), modo {s.view.get('mode')}")
        elif s.kind == "c-pausa":
            lineas.append(f"*Silencio de {s.hold_s:.0f} s con la pregunta a la vista y cuenta atrás.*")
        for part in s.parts:
            lineas.append(f"> {part.text}  \n> <sub>{part.origin}</sub>")
        lineas.append("")
    return "\n".join(lineas)
