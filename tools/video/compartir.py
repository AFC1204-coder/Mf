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
import os
import json
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any

from . import guia as G
from . import text as T
from .corpus import Book, Lesson, Question
from .scriptwriter import Beat, Episode, Part, Scene

COMPARTIR_VERSION = 7

TIPOS = ("idea", "pregunta", "practica", "caso", "libro", "fondo")
ASPECTOS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}

# La voz de las piezas (motor Edge, gratuito): la que el dueño del proyecto eligió de oído entre once, sin tocarle
# ritmo ni tono. Es multilingüe: pronuncia bien los títulos en inglés; su acento en español no es peninsular.
VOZ_EDGE = "fr-FR-RemyMultilingualNeural"
RITMO_EDGE, TONO_EDGE = "+0%", "+0Hz"
FACTOR_VOZ = 0.87  # lo que tarda esa voz respecto a la que sirvió para ajustar `segundos_locucion` (la misma locución: 34,5 s frente a 39,8 s)

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
    "caso": "UN CASO",
    "libro": "UN LIBRO EN {n} IDEAS",
    "matiz": "EL MATIZ",
    "pensar": "PIÉNSALO",
    "respuesta": "LA RESPUESTA",
    "idea_detras": "LA IDEA DETRÁS",
    "figura": "EN UNA IMAGEN",
    "explica": "LA EXPLICACIÓN",
    "fondo": "A FONDO",
    "credito": "DEL LIBRO",
    "libro_frase": "EL LIBRO EN UNA FRASE",
    "une": "LA IDEA QUE LAS UNE",
    "marca": "MENTE FRÍA",
    "lema": "Biblioteca de ideas",
    "seguir": "Sigue para más ideas con su matiz",
    "recuerda": "QUÉDATE CON ESTO",
    "conexion": "CONECTA CON",
    "comprueba": "COMPRUÉBALO",
}

# Iconos (los 18 de la biblioteca, `lib/mapa.js`). Señalan **qué tipo de momento o de figura** es, igual que los
# rótulos: nunca qué significa el contenido. Asignar un icono a un concepto sería interpretarlo; aquí no se hace.
ICONOS = {
    "idea": "bombilla", "pregunta": "pregunta", "explica": "lupa", "matiz": "escudo", "practica": "diana",
    "caso": "ojo", "respuesta": "llave", "credito": "libro", "pensar": "reloj", "conexion": "red", "nombres": "grupo",
    # por la forma de la figura
    "contraste": "balanza", "cadena": "camino", "ciclo": "ciclo", "radial": "red", "matriz": "brujula",
    "espectro": "grafico", "cifra": "grafico", "iceberg": "lupa", "silueta": "red",
}

# Iconos por concepto: SOLO los que una persona ha aprobado en `tools/video/iconos/<libro>.json`. Qué icono va con
# qué pieza de un esquema es una interpretación, así que no la decide el generador: se propone en ese archivo
# (`"aprobado": false`) y no sale en ningún vídeo hasta que alguien lo revisa y lo pone a true.
ICONOS_DIR = Path(__file__).resolve().parent / "iconos"
ICONOS_BIBLIOTECA = frozenset(
    "bombilla diana ojo balanza dado ciclo red reloj escudo brujula libro grupo grafico pregunta bandera lupa llave camino".split()
)
_iconos_cache: dict[tuple[str, str], str] | None = None


def iconos_de_piezas(recargar: bool = False) -> dict[tuple[str, str], str]:
    """(id de lección, rótulo de la pieza) → icono aprobado. Con ICONOS_PROPUESTOS=1 entran también los propuestos
    (para previsualizarlos antes de aprobarlos). Un icono que no sea de la biblioteca se ignora."""
    global _iconos_cache
    if _iconos_cache is None or recargar:
        ver_propuestos = os.getenv("ICONOS_PROPUESTOS", "") not in ("", "0")
        tabla: dict[tuple[str, str], str] = {}
        for archivo in sorted(ICONOS_DIR.glob("*.json")) if ICONOS_DIR.is_dir() else []:
            try:
                datos = json.loads(archivo.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for e in datos.get("piezas") or []:
                if not isinstance(e, dict) or e.get("icono") not in ICONOS_BIBLIOTECA:
                    continue
                if e.get("aprobado") is True or ver_propuestos:
                    tabla[(str(e.get("leccion_id")), T.clean(e.get("pieza")))] = e["icono"]
        _iconos_cache = tabla
    return _iconos_cache


# Prefijos fijos de los textos de publicación (título y descripción). Como las fórmulas: declarados y comprobados.
PREFIJOS_PUB = ("El matiz: ", "La respuesta: ", "La idea detrás: ", "Pruébalo: ", "Un caso: ", "A fondo: ")

# Presupuestos (palabras). El texto en pantalla va por páginas: nunca más de PAGINA a la vez.
PAGINA = 14
RAFAGA = 4
RECUERDA_PALABRAS = 40  # el mensaje de cierre: la idea entera en el 99 % de los casos
PORTADA_PALABRAS = 30  # la miniatura: la frase entera casi siempre
GIRO_PAGINA = 24
MATIZ_PALABRAS = 38
MATIZ_CORTO = 26
MATIZ_ENTERO = 70  # sin prisa por acabar en 60 s, el matiz va entero casi siempre
EXPLICA_PALABRAS = 150  # la explicación de la pieza «idea»: los primeros párrafos del cuerpo, enteros, hasta aquí
CASO_PARRAFO = 120  # el párrafo del caso que la pieza «idea» añade a su explicación, entero, hasta aquí
EXPLICACION_LARGA = 60  # el porqué de la respuesta, en la pieza «pregunta» sin prisa
FIGURA_FONDO = 140  # en la pieza «a fondo» la voz lee el esquema entero casi siempre
FIGURA_PALABRAS = 60  # la voz lee la tarjeta entera hasta aquí: con voz real, una tarjeta muda es aire muerto
PAUSA_TARJETA_MAX = 1.4  # lo que se deja, como mucho, para terminar de leer una tarjeta que la voz no lee entera
PRACTICA_PALABRAS = 60
ARRANQUE_PALABRAS = 36
PRACTICA_MAX_FRASE = 75
EXPLICACION_PALABRAS = 35
PAUSA_PENSAR_S = 3.0
LECTURA_PPS = 3.6  # palabras por segundo leyendo en silencio una tarjeta

# Duración que se intenta no pasar SOLO en la versión breve (`breve=True`, `--breve`). Nunca cortando frases: se lee
# menos del esquema en voz alta (sigue entero en pantalla), se deja el matiz en su primera frase o se acorta la
# práctica por frases enteras. Por defecto la pieza dura lo que su explicación pida: explicar bien va antes que los 60 s.
OBJETIVO_S = 60.0
PRACTICA_BREVE = 40

# Duración razonable de cada tipo (segundos estimados): fuera de ahí, aviso.
LIMITES = {"idea": (22, 210), "pregunta": (20, 90), "practica": (22, 90), "caso": (20, 90), "libro": (22, 90), "fondo": (75, 360)}

# Texto que solo tiene sentido dentro de la web (o delante de las opciones de un test).
ANCLA_WEB = re.compile(
    r"\blecci[oó]n(es)?\b|cap[ií]tulo anterior|como vimos|hemos visto|\bapp\b|en la web|esta ficha|este resumen|\bm[oó]dulo\b"
    r"|seg[uú]n el texto|seg[uú]n lo visto|el pasaje|el fragmento|(en|del) (el |este )?cap[ií]tulo|cap[ií]tulo \d",
    re.IGNORECASE,
)
# Lo que solo se entiende dentro de la serie de la web. «La lección es que…» o «en el capítulo 3» se entienden fuera;
# «como vimos» o «la lección anterior», no: la explicación del cuerpo se detiene antes del párrafo que lo diga.
ANCLA_SERIE = re.compile(
    r"como vimos|hemos visto|ya vimos|veremos|cap[ií]tulo anterior|\bapp\b|en la web|esta ficha|este resumen|\bm[oó]dulo\b"
    r"|lecci[oó]n(es)? (anterior|siguiente|previa|pasada)|(anterior|siguiente|pr[oó]xima|[uú]ltima|primera|segunda|tercera) lecci[oó]n|(otras|dem[aá]s|pr[oó]ximas|siguientes) lecciones",
    re.IGNORECASE,
)
ALUDE_OPCIONES = re.compile(
    r"\bopci[oó]n\b|\bopciones\b|distractor|las dem[aá]s|las otras|los otros|el resto|\balternativas?\b|\blecci[oó]n\b|el texto|anteriores",
    re.IGNORECASE,
)
# Preguntas cuya respuesta correcta es una afirmación FALSA («¿cuál es falsa?», «todas EXCEPTO…») o que dependen de
# la lista («¿cuál de las siguientes…?»): sin las opciones delante, la «respuesta» sería un error bien rotulado.
PREGUNTA_INVERSA = re.compile(
    r"\b(?:fals[ao]s?|incorrect[ao]s?|err[oó]ne[ao]s?|excepto|equivocad[ao]s?|siguientes|mito)\b|\bcu[aá]l(?:es)?\s+(?:de\s+[^?]{0,50})?no\b",
    re.IGNORECASE,
)
_NO_MAYUSCULAS = re.compile(r"\bNO\b")
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
# Cómo introduce el corpus un caso concreto. Solo estos arranques explícitos: no se adivina qué es un ejemplo.
ARRANQUE_CASO = re.compile(
    r"^(?:por ejemplo|un ejemplo|imagina|imagine|piensa en|pensemos en|supongamos|supón|considera el caso|el caso de|"
    r"el ejemplo (?:clásico|más)|en un experimento|en un estudio|en el experimento|un experimento)\b",
    re.IGNORECASE,
)
CASO_PALABRAS = 45
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

    @property
    def estimated_seconds(self) -> float:
        """Duración estimada con el modelo ajustado a la voz real (ver `segundos_locucion`)."""
        total = 0.0
        for s in self.scenes:
            total += (segundos_locucion(s.narration) if s.narration else s.hold_s) + s.pause_after_s
        return round(total + 0.15, 1)


@dataclass
class Omitida:
    """Una pieza que no sale, y por qué (para el manifiesto: nada desaparece en silencio)."""

    tipo: str
    leccion_n: int
    titulo: str
    motivo: str


def segundos_locucion(texto: str) -> float:
    """Lo que tarda la voz en decir un texto, con el silencio final ya recortado.

    Ajustado sobre 43 locuciones reales de Edge (es-ES-AlvaroNeural, -8 %): letras, finales de frase y
    comas explican la duración con un 6,5 % de error medio. Contar solo palabras se quedaba hasta un 40 %
    corto en las piezas con muchas frases breves (el mapa de un libro, las piezas de un esquema).
    """
    tokens = T.for_speech(texto).split()
    letras = sum(len(t.strip(".,;:«»\"()¿?¡!—–")) for t in tokens)
    finales = sum(1 for t in tokens if re.search(r"[.!?…:][\"»”)]*$", t))
    comas = sum(1 for t in tokens if re.search(r"[,;][\"»”)]*$", t))
    return max(0.6, FACTOR_VOZ * (0.0638 * letras + 0.7358 * finales + 0.3309 * comas - 0.0678))


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
    if not t.startswith(corto.rstrip("…")):  # shorten_clause cerró una comilla o quitó un paréntesis
        corto = " ".join(t.split()[:max_words]).rstrip(" ,;:—–(") + "…"
    return corto


def tema(lesson: Lesson) -> str:
    """El tema de la pieza: el título de la lección hasta los dos puntos (rótulo, no se lee)."""
    return arranque_literal(titulo_corto(lesson.titulo), 9)


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


def caso_partes(lesson: Lesson, max_words: int = CASO_PALABRAS) -> list[Part]:
    """El caso concreto que la propia lección cuenta: la frase que lo introduce («Un ejemplo:», «Imagina que…»)
    y las que la siguen en su párrafo, enteras, mientras quepan. [] si la lección no trae uno."""
    for parrafo in T.paragraphs(lesson.cuerpo):
        frases = T.split_sentences(parrafo)
        for i, f in enumerate(frases):
            if not ARRANQUE_CASO.search(f) or not (8 <= T.n_words(f) <= max_words) or ANCLA_WEB.search(f) or parece_ingles(f):
                continue
            # «Un ejemplo cotidiano ayuda a verlo.» solo lo anuncia: el caso está en lo que sigue, y sin eso no hay pieza.
            anuncia = bool(re.match(r"(?:un|por|el) ejemplo", f, re.IGNORECASE)) and not re.search(r":\s+\S+(?:\s+\S+){5,}", f)
            tope = max_words + 15 if anuncia else max_words
            elegidas, total = [f], T.n_words(f)
            for g in frases[i + 1 :]:
                if total + T.n_words(g) > tope or ANCLA_WEB.search(g):
                    break
                elegidas.append(g)
                total += T.n_words(g)
            if anuncia and len(elegidas) < 2:
                continue
            return [Part(" ".join(elegidas), "leccion.cuerpo")]
    return []


def explicacion_partes(lesson: Lesson, max_words: int | None = EXPLICA_PALABRAS, ya_dicho: tuple[str, ...] = ()) -> list[Part]:
    """La explicación de la lección, tal cual está escrita: su cuerpo **desde el principio y por párrafos enteros**.

    No se eligen frases sueltas ni se salta nada: una frase sacada de en medio puede quedarse sin la salvedad que
    la sigue («Un estudio mostró… Pero no se ha replicado»). El párrafo es la unidad: el primero va siempre y los
    siguientes mientras quepan en `max_words` (None = el cuerpo entero). Cada párrafo es un tramo, con sus propias
    marcas («Fuera del libro:», «Lectura nuestra:»), que dicen de quién es lo que se afirma.

    `ya_dicho` son las frases con que la pieza ya abrió: si son el arranque del cuerpo, no se repiten.
    Se detiene antes de un párrafo que solo se entiende dentro de la serie de la web o que está en otro idioma.
    Las salvedades de seguridad de los párrafos que no entran se añaden siempre.
    """
    parrafos = T.paragraphs(lesson.cuerpo)
    dichas = {T.norm(f).rstrip(".") for d in ya_dicho for f in T.split_sentences(d)}
    partes: list[Part] = []
    total = 0
    fuera: list[str] = []
    for i, parrafo in enumerate(parrafos):
        if fuera:
            fuera.append(parrafo)
            continue
        if ANCLA_SERIE.search(parrafo) or parece_ingles(parrafo):
            fuera.append(parrafo)
            continue
        texto = parrafo
        if i == 0 and dichas:
            frases = T.split_sentences(parrafo)
            n = 0
            while n < len(frases) and T.norm(frases[n]).rstrip(".") in dichas:
                n += 1
            texto = " ".join(frases[n:])
            if not texto:
                continue
        w = T.n_words(texto)
        if max_words is not None and partes and total + w > max_words:
            fuera.append(parrafo)
            continue
        partes.append(Part(texto, "leccion.cuerpo"))
        total += w
    if not partes:
        return []
    for parrafo in fuera:
        for f in T.split_sentences(parrafo):
            if SALVEDAD.search(f) and not ANCLA_SERIE.search(f):
                partes.append(Part(f, "leccion.cuerpo"))
    return partes


def caso_parrafo(lesson: Lesson, ya: list[Part], max_words: int = CASO_PARRAFO) -> Part | None:
    """El párrafo del cuerpo que cuenta un caso y que la explicación no ha llegado a decir.

    Solo vale un párrafo que **empieza** presentándose como caso («Por ejemplo», «Un ejemplo:», «Imagina», «En un
    experimento»…): así se entiende aunque se hayan saltado los párrafos de en medio, y va entero, con las salvedades
    que traiga. No se busca «el mejor ejemplo»: el primero que la lección marca así y cabe. None si no hay.
    """
    dichos = {T.clean(p.text) for p in ya}
    for parrafo in T.paragraphs(lesson.cuerpo)[1:]:
        if parrafo in dichos or any(parrafo.endswith(d) or d in parrafo for d in dichos if len(d) > 40):
            continue
        frases = T.split_sentences(parrafo)
        if not frases or not ARRANQUE_CASO.search(frases[0]):
            continue
        if T.n_words(parrafo) > max_words or len(frases) < 2 or ANCLA_SERIE.search(parrafo) or parece_ingles(parrafo):
            continue
        return Part(parrafo, "leccion.cuerpo")
    return None


def escenas_explicacion(lesson: Lesson, max_words: int | None = EXPLICA_PALABRAS, ya_dicho: tuple[str, ...] = ()) -> list[Scene]:
    """Una escena de texto cinético por párrafo de la explicación: la pausa entre párrafos es la del texto."""
    return [
        escena_frase("Explicación", "explica", ROTULOS["explica"], [parte], tema_txt=tema(lesson), pause_after_s=0.55)
        for parte in explicacion_partes(lesson, max_words, ya_dicho)
    ]


_VACIAS = frozenset("el la los las un una unos unas de del al a en y o que se su sus lo por para con es".split())


def _raiz(palabra: str) -> str:
    for sufijo in ("es", "s"):
        if len(palabra) > 4 and palabra.endswith(sufijo):
            return palabra[: -len(sufijo)]
    return palabra


def _limpias(tokens: list[str]) -> list[str]:
    return [_raiz(T.norm(t).strip(".,;:«»\"'()¿?¡!—–[]")) for t in tokens]


_CLITICO = re.compile(r"(?<=[aei]r)(?:se|lo|la|le|los|las|les|nos|me|te)$|(?<=ndo)(?:se|lo|la|le|los|las|les)$")
_CORTA_VENTANA = re.compile(r"[.;:?!…)\]—–]$|[.;:?!…][»\"”]$")
_ABRE_INCISO = re.compile(r"[(\[—–]")


def _afines(a: str, b: str) -> bool:
    """¿Son la misma palabra en otra forma? («sobrestimado» / «sobrestimaban», «reinvertir» / «reinvertirlo»,
    «creciente» / «crecientes»). Comparten casi todo el arranque; no basta con parecerse («organismo» / «organización»)."""
    if a == b:
        return True
    a, b = _CLITICO.sub("", a), _CLITICO.sub("", b)
    if a == b:
        return True
    corta = min(len(a), len(b))
    c = 0
    while c < corta and a[c] == b[c]:
        c += 1
    return (c >= 5 and c >= 0.72 * max(len(a), len(b))) or (c >= 4 and c >= corta - 1 and abs(len(a) - len(b)) <= 2)


def _nombra_estricto(buscadas: list[str], limpias: list[str]) -> int | None:
    for i, w in enumerate(limpias):
        if w != buscadas[0]:
            continue
        k = i
        for b in buscadas[1:]:
            k = next((j for j in range(k + 1, min(k + 4, len(limpias))) if limpias[j] == b), -1)
            if k < 0:
                break
        else:
            return i
    return None


def donde_nombra(titulo: str, tokens: list[str]) -> int | None:
    """En qué palabra de `tokens` se nombra el rótulo `titulo`. None si no se nombra. No interpreta.

    Dos reglas, de la más segura a la más amplia:
      1. Las palabras con contenido del rótulo, en su orden y casi seguidas («marco estrecho» en «el marco estrecho»).
      2. Solo si el rótulo tiene **dos o más** palabras con contenido: todas ellas, en cualquier orden y en otra forma
         de la misma palabra, dentro de un tramo corto que no cruza un punto, dos puntos, paréntesis ni raya
         («Control sobrestimado» en «sobrestimaban su control»; «Reinvertir en el negocio» en «reinvertirlo en el negocio»).
         Ninguna palabra del rótulo puede faltar, y con palabras de una o dos letras («X causa Y») el orden se respeta.

    Un rótulo de una sola palabra solo casa por la regla 1: con la 2, «El plan» encendía «plano» y «Lo que funciona»,
    «la función» (6 errores en 100 coincidencias revisadas a mano; con el límite, ninguno de esos seis).
    """
    crudas = [T.norm(t).strip(".,;:«»\"'()¿?¡!—–[]") for t in titulo.split()]
    con_contenido = [w for w in crudas if w and w not in _VACIAS]
    if not con_contenido:
        return None
    estricto = _nombra_estricto([_raiz(w) for w in con_contenido], _limpias(tokens))
    if estricto is not None or len(con_contenido) < 2:
        return estricto
    llanas = [T.norm(t).strip(".,;:«»\"'()¿?¡!—–[]") for t in tokens]
    libre = all(len(b) >= 3 for b in con_contenido)
    for i, w in enumerate(llanas):
        if not any(_afines(w, b) for b in con_contenido):
            continue
        fin = i
        while fin < len(llanas) - 1 and fin - i < len(con_contenido) + 1 and not _CORTA_VENTANA.search(tokens[fin]) and not _ABRE_INCISO.match(tokens[fin + 1]):
            fin += 1
        tramo = llanas[i : fin + 1]
        usadas: list[int] = []
        for b in con_contenido:
            k = next((n for n, x in enumerate(tramo) if n not in usadas and _afines(x, b) and (libre or not usadas or n > usadas[-1])), None)
            if k is None:
                break
            usadas.append(k)
        else:
            return i
    return None


def acompanar(explicacion: list[Scene], figura: list[Scene]) -> bool:
    """Pone el esquema de la lección junto a la explicación: sus rótulos (literales) a la vista mientras se explica,
    y cada uno se enciende **en el momento en que la voz lo nombra**. Lo que se oye se ve dos veces: escrito y
    situado en la estructura. No añade ni cambia texto; solo decide cuándo se ilumina un rótulo que ya es del esquema.

    Devuelve True si la explicación ha nombrado todas las piezas: entonces recorrerlas después, una a una, sería repetir.
    """
    if not explicacion or not figura:
        return False
    base = figura[0].view
    piezas = [{k: p.get(k) for k in ("t", "tone", "icon") if p.get(k) is not None} for p in base.get("pieces") or []]
    if not (2 <= len(piezas) <= 7) or sum(T.n_words(str(p["t"])) for p in piezas) > 26:
        return False  # demasiados rótulos (o demasiado largos) para tenerlos a la vista junto al texto
    marco = base.get("marco") or {}
    fig = {"title": base.get("title"), "pieces": piezas, "patron": base.get("patron")}
    if base.get("patron") in ("radial", "ciclo") and marco.get("centro") and T.n_words(str(marco.get("centro"))) <= 6 and len(piezas) <= 4:
        fig["centro"] = marco.get("centro")  # de dónde cuelgan las piezas (o alrededor de qué giran)
    if base.get("patron") == "espectro" and len(marco.get("polos") or []) == 2:
        fig["polos"] = list(marco.get("polos"))
    encendidas: list[int] = []
    for scene in explicacion:
        tokens = scene.view.get("words") or []
        scene.view.update({"fig": fig, "fig_on": list(encendidas), "fig_act": -1})
        hallazgos = sorted((i, j) for j, p in enumerate(piezas) if j not in encendidas for i in [donde_nombra(str(p["t"]), tokens)] if i is not None)
        for i, j in hallazgos:
            encendidas.append(j)
            cambio = {"fig_on": list(encendidas), "fig_act": j}
            # Entra con la ráfaga de texto que contiene la palabra: un solo cambio en pantalla, no dos.
            antes = [b for b in scene.beats if b.at_word is not None and b.at_word <= i]
            (antes[-1].patch if antes else scene.view).update(cambio)
    return len(encendidas) == len(piezas)


CONEXION_PALABRAS = (12, 160)  # el campo va entero o no va: su salvedad («es lectura nuestra…») suele estar al final


def _apellido(nombre: str) -> str:
    palabras = [T.norm(w).strip(".,;:«»\"'()") for w in nombre.split()]
    return next((w for w in reversed(palabras) if len(w) >= 3), "")


def escena_conexion(lesson: Lesson) -> Scene | None:
    """Con qué otros autores conecta la idea: el campo `conexion_cruzada` de la lección, **entero y literal**.

    Junto al texto, los nombres de `autores_relacionados` que el propio texto menciona; cada uno se enciende cuando
    la voz lo nombra (por su apellido, tal cual). Un autor de la lista que el texto no menciona no se muestra.
    """
    texto = T.clean(lesson.conexion_cruzada)
    if not (CONEXION_PALABRAS[0] <= T.n_words(texto) <= CONEXION_PALABRAS[1]) or ANCLA_SERIE.search(texto):
        return None
    scene = escena_frase("Conexiones", "conexion", ROTULOS["conexion"], [Part(texto, "leccion.conexion_cruzada")], pause_after_s=0.5)
    tokens = [T.norm(w).strip(".,;:«»\"'()¿?¡!—–[]") for w in scene.view.get("words") or []]
    nombrados: list[tuple[int, str]] = []
    for nombre in dict.fromkeys(T.clean(a) for a in lesson.autores_relacionados):
        ap = _apellido(nombre)
        if not ap or T.n_words(nombre) > 4:
            continue
        i = next((k for k, w in enumerate(tokens) if w == ap), None)
        if i is not None and not any(_apellido(n) == ap for _, n in nombrados):
            nombrados.append((i, nombre))
    if 2 <= len(nombrados) <= 6:
        nombrados.sort()
        fig = {"pieces": [{"t": n, "tone": "info", "icon": ICONOS["nombres"]} for _, n in nombrados], "patron": "nombres"}
        encendidas: list[int] = []
        scene.view.update({"fig": fig, "fig_on": [], "fig_act": -1})
        for j, (i, _) in enumerate(nombrados):
            encendidas.append(j)
            cambio = {"fig_on": list(encendidas), "fig_act": j}
            antes = [b for b in scene.beats if b.at_word is not None and b.at_word <= i]
            (antes[-1].patch if antes else scene.view).update(cambio)
    return scene


def escenas_comprueba(lesson: Lesson, breve: bool = False, rotulo: str | None = None) -> list[Scene]:
    """Pregunta → pausa para pensar → respuesta y su porqué. Vacío si la lección no tiene una pregunta que se entienda sola."""
    q = pregunta_autonoma(lesson)
    if not q:
        return []
    correcta = _punto(q.opciones[q.correcta])
    explic = explicacion_autonoma(q, EXPLICACION_PALABRAS if breve else EXPLICACION_LARGA)
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
    return [
        escena_frase("Pregunta", "pregunta", rotulo or ROTULOS["pregunta"], [Part(q.texto, "pregunta.texto")], tema_txt=tema(lesson) if not rotulo else "", pause_after_s=0.15),
        pensar,
        escena_frase("Respuesta", "respuesta", ROTULOS["respuesta"], respuesta, skip_parts=1, pause_after_s=0.5),
    ]


def cubre(texto: str, otro: str, umbral: float = 0.75) -> bool:
    """¿Dice `otro` casi todo lo que dice `texto`? (palabras con contenido de `texto` que están en `otro`)."""
    a, b = set(T.content_tokens(texto)), set(T.content_tokens(otro))
    return bool(a) and len(a & b) / len(a) >= umbral


def pregunta_autonoma(lesson: Lesson) -> Question | None:
    """Una pregunta de la lección que se entiende sin la lección delante (y sin ver las demás opciones)."""
    candidatas = []
    for q in lesson.preguntas:
        if not q.valid:
            continue
        correcta = q.opciones[q.correcta]
        if ANCLA_WEB.search(q.texto) or ALUDE_OPCIONES.search(correcta) or ANCLA_WEB.search(correcta):
            continue
        if PREGUNTA_INVERSA.search(q.texto) or _NO_MAYUSCULAS.search(q.texto):
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


def no_sino(tokens: list[str]) -> tuple[int, int, int] | None:
    """«no X, sino Y» dentro de una frase: (dónde está el «no», dónde está «sino», dónde acaba lo afirmado).

    Sirve para **señalar lo afirmado** (Y queda en color). Lo negado NO se marca: qué parte de la frase
    niega el «no» no se puede saber sin analizarla («no pierde fuerza por la edad, sino por el desuso» no
    niega que pierda fuerza), y apagar de más diría algo falso. Prudente: «no solo… sino también»,
    «no simplemente… sino» no niegan nada y no cuentan; ante la duda, None.
    """
    n = [T.norm(t).strip(".,;:«»\"()¿?¡!—–") for t in tokens]
    flojos = ("solo", "solamente", "unicamente", "tan", "obstante", "simplemente", "meramente", "exclusivamente", "necesariamente", "siempre", "apenas")
    for j, w in enumerate(n):
        if w != "sino" or n[j + 1 : j + 2] in (["tambien"], ["ademas"]) or n[j + 1 : j + 3] in (["que", "tambien"], ["que", "ademas"]):
            continue
        # el «no» más cercano hacia atrás, dentro de la misma frase
        if j == 0 or _cierra(tokens[j - 1], _FIN_FRASE):
            continue
        i = j - 2
        while i >= max(0, j - 15) and not _cierra(tokens[i], _FIN_FRASE):
            if n[i] == "no":
                break
            i -= 1
        else:
            continue
        if i < 0 or n[i] != "no" or any(x in flojos for x in n[i + 1 : i + 4]):
            continue
        k = j + 1
        while k < len(n) and not _cierra(tokens[k], (*_FIN_FRASE, ";", ":")):
            k += 1
        return i, j, min(k + 1, len(n))
    return None


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
    giro = no_sino(visibles) if estilo == "idea" else None
    # Un «no X, sino Y» breve va en una sola página: el contraste se ve entero, con lo negado apagado junto a lo afirmado.
    paginas = [(0, len(visibles))] if (giro and len(visibles) <= GIRO_PAGINA) else paginar(visibles)
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
    if giro:
        view["afi"] = [giro[1], giro[2]]
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


def escena_cierre(book: Book, clave: str = "cta", recuerda: str = "", antes: str = "") -> Scene:
    """La marca y, encima, el gancho otra vez (literal, sin voz): la pieza cierra con lo que abrió, un solo mensaje para llevarse."""
    return Scene(
        "c-cierre",
        "",
        {
            "brand": ROTULOS["marca"], "lema": ROTULOS["lema"], "said": FORMULAS[clave], "cta": ROTULOS["seguir"],
            "title": book.titulo, "author": book.autor,
            # Entero siempre que quepa: cortar una idea a media frase puede dejar fuera justo su salvedad.
            "recuerda": arranque_literal(recuerda, RECUERDA_PALABRAS) if recuerda else "", "recuerda_rotulo": ROTULOS["recuerda"],
            "recuerda_antes": T.clean(antes),
        },
        [_fixed(clave)],
        pause_after_s=1.1,
    )


# Qué forma visual cuenta mejor cada tipo de figura. Todas usan los rótulos literales, en su orden.
PATRONES = {
    "comparar": "contraste",  # dos paneles enfrentados: la idea está en la diferencia
    "pasos": "cadena",  # eslabones que se van encadenando: la idea está en el orden (causa → efecto, antes → después)
    "piramide": "cadena",
    "tiempo": "cadena",  # cada eslabón, una fecha
    "ciclo": "ciclo",  # una cadena que vuelve al principio, alrededor de su centro
    "mapa": "radial",  # un centro y lo que sale de él
    "matriz": "matriz",  # dos ejes, cuatro cuadrantes
    "espectro": "espectro",  # dos polos y posiciones entre ellos
    "cifras": "cifra",  # el número, enorme, y qué mide
    "escalera": "cadena",
    "capas": "cadena",
    "embudo": "cadena",
    "balanza": "contraste",
    "bucle": "ciclo",
    "jerarquia": "radial",
    "iceberg": "iceberg",  # lo que se ve y, bajo la línea de flotación, lo que lo sostiene
}


PATRONES_EN_LISTA = ("contraste", "cadena", "ciclo", "radial", "iceberg")  # los que se pintan como paneles (ver compartir_frames.LISTAS)
ENTRADA_PRIMERA_S = 0.7  # cuándo entra la primera pieza de un esquema que se construye
ENTRADA_PIEZA_S = 0.55  # cada cuánto entra la siguiente


def patron_visual(spec: dict[str, Any]) -> str:
    """El patrón que cuenta la figura, o «silueta» (la forma dibujada por la app, con insignias) si no hay uno propio."""
    patron = PATRONES.get(str(spec.get("plantilla")), "silueta")
    datos = spec.get("datos") if isinstance(spec.get("datos"), dict) else {}
    if patron == "matriz" and len(datos.get("celdas") or []) != 4:
        return "silueta"
    return patron


def piezas_figura(spec: dict[str, Any] | None) -> list[G.Piece]:
    """Las piezas de una figura en orden de lectura, siempre con sus rótulos literales.

    Las de cajas las da `guia.pieces`; aquí se añaden las que ese módulo no recorre: las marcas de un
    espectro, los eventos de una línea de tiempo (fecha y hecho) y las cifras (número y qué mide).
    """
    ps = G.pieces(spec)
    if ps or not spec:
        return ps
    d = spec.get("datos") if isinstance(spec.get("datos"), dict) else {}

    s_ = _txt

    out: list[G.Piece] = []
    plantilla = spec.get("plantilla")
    if plantilla == "espectro":
        polos = [s_(x) for x in (d.get("polos") or [])]
        if len(polos) != 2 or not all(polos):
            return []
        for i, x in enumerate(sorted((m for m in d.get("marcas") or [] if isinstance(m, dict)), key=_pos)):
            out.append(G.Piece(s_(x.get("t")), s_(x.get("d")), tone=x.get("tono") or "a", dom=i))
    elif plantilla == "tiempo":
        for i, x in enumerate(d.get("eventos") or []):
            if isinstance(x, dict):
                out.append(G.Piece(s_(x.get("f")), s_(x.get("t")), items=[s_(x.get("d"))] if s_(x.get("d")) else [], tone=x.get("tono") or "a", dom=i))
    elif plantilla == "cifras":
        for i, x in enumerate(d.get("items") or []):
            if isinstance(x, dict):
                out.append(G.Piece(s_(x.get("n")), s_(x.get("t")), tone=x.get("tono") or "a", dom=i))
    elif plantilla in ("escalera", "capas", "embudo"):  # niveles o etapas en orden: una cadena
        clave = {"escalera": "escalones", "capas": "capas", "embudo": "etapas"}[plantilla]
        if any(isinstance(x, dict) and (x.get("v") is not None or x.get("unidad")) for x in d.get(clave) or []):
            return []  # un embudo con cantidades: aquí no se verían, mejor sin esquema
        for i, x in enumerate(d.get(clave) or []):
            if isinstance(x, dict):
                out.append(G.Piece(s_(x.get("t")), s_(x.get("d")), tone=x.get("tono") or "a", dom=i))
    elif plantilla == "balanza":  # dos platos: un contraste
        if d.get("inclina"):
            return []  # hacia dónde cae la balanza es parte del mensaje y un contraste no lo enseña
        for i, k in enumerate(("izq", "der")):
            col = d.get(k) if isinstance(d.get(k), dict) else {}
            out.append(G.Piece(s_(col.get("t")), items=[s_(x) for x in col.get("items") or [] if s_(x)], tone=col.get("tono") or "a", dom=i))
    elif plantilla == "bucle":  # un ciclo con nombre; solo si todos sus pasos refuerzan (un «−» cambia el sentido y aquí no se vería)
        if all(str(x).strip() == "+" for x in d.get("signos") or []):
            for i, x in enumerate(d.get("nodos") or []):
                if isinstance(x, dict):
                    out.append(G.Piece(s_(x.get("t")), s_(x.get("d")), tone=x.get("tono") or "a", dom=i))
    elif plantilla == "iceberg":
        for i, x in enumerate([*(d.get("visibles") or []), *(d.get("ocultos") or [])]):
            if isinstance(x, dict):
                out.append(G.Piece(s_(x.get("t")), s_(x.get("d")), tone=x.get("tono") or "a", dom=i))
        if not (d.get("visibles") and d.get("ocultos")):
            return []
    elif plantilla == "jerarquia":  # una raíz y sus ramas, cada una con sus hijos (solo dos niveles y sin descripciones que perder)
        ramas = [r for r in d.get("ramas") or [] if isinstance(r, dict)]
        plano = all(isinstance(h, dict) and not h.get("d") and not h.get("hijos") for r in ramas for h in r.get("hijos") or [])
        if plano and all(not r.get("d") for r in ramas):
            for i, r in enumerate(ramas):
                out.append(G.Piece(s_(r.get("t")), items=[s_(h.get("t")) for h in r.get("hijos") or [] if s_(h.get("t"))], tone=r.get("tono") or "a", dom=i))
    minimo = 1 if plantilla == "cifras" else 2
    if not (minimo <= len(out) <= G.MAX_PIECES) or any(not p.t for p in out):
        return []
    return out


def _pos(m: dict[str, Any]) -> float:
    """La posición de una marca en el espectro; sin posición válida, al centro (como `lib/diagram.js`)."""
    try:
        return min(1.0, max(0.0, float(m.get("pos"))))
    except (TypeError, ValueError):
        return 0.5


def _txt(v: Any) -> str:
    """Solo cadenas: un dato con otra forma (un número, un objeto) no se convierte en texto a ojo."""
    return T.clean(v) if isinstance(v, str) else ""


def marco_figura(spec: dict[str, Any]) -> dict[str, Any]:
    """Lo que enmarca las piezas y también es parte de la figura: el centro de un mapa o un ciclo, los polos, los ejes."""
    d = spec.get("datos") if isinstance(spec.get("datos"), dict) else {}
    plantilla = spec.get("plantilla")
    marco: dict[str, Any] = {}
    centro = d.get("centro") or (d.get("nombre") if plantilla == "bucle" else "") or (d.get("raiz") if plantilla == "jerarquia" else "")
    if _txt(centro):
        marco["centro"] = _txt(centro)
        marco["centro_sub"] = _txt(d.get("centroSub"))
    if plantilla == "espectro":
        marcas = sorted((m for m in d.get("marcas") or [] if isinstance(m, dict)), key=_pos)
        marco["polos"] = [_txt(x) for x in (d.get("polos") or [])][:2]
        marco["pos"] = [_pos(m) for m in marcas]
    if plantilla == "iceberg":
        marco["superficie"] = _txt(d.get("etiquetaVisible"))
        marco["fondo"] = _txt(d.get("etiquetaOculto"))
        marco["corte"] = len([x for x in d.get("visibles") or [] if isinstance(x, dict)])
    if plantilla == "matriz":
        ex = d.get("ejeX") if isinstance(d.get("ejeX"), dict) else {}
        ey = d.get("ejeY") if isinstance(d.get("ejeY"), dict) else {}
        marco["ejes"] = {
            "x": [_txt(ex.get("izq")), _txt(ex.get("der"))], "x_nombre": _txt(ex.get("nombre")),
            "y": [_txt(ey.get("arriba")), _txt(ey.get("abajo"))], "y_nombre": _txt(ey.get("nombre")),
        }
    return marco


def _con_icono(vista: dict[str, Any], lesson: Lesson) -> dict[str, Any]:
    icono = iconos_de_piezas().get((str(lesson.id), T.clean(vista.get("t"))))
    return dict(vista, icon=icono) if icono else vista


def _lectura(p: G.Piece, nivel: int) -> list[str]:
    """Qué se lee de una pieza del esquema: todo, título + su primer rótulo, o solo el título."""
    if nivel == 0:
        return p.lines
    if nivel == 1:
        return p.lines[:2]
    return [p.t]


def escenas_figura(lesson: Lesson, nivel_min: int = 0, max_words: int = FIGURA_PALABRAS) -> list[Scene]:
    """El esquema verificado en formato legible: silueta sin texto + tarjeta grande de cada pieza.

    La tarjeta enseña la pieza **entera y literal**; la voz la lee entera si el esquema es breve y,
    si no, solo su título (y su primer rótulo). Cada tarjeta dura lo que se tarda en leerla.
    """
    specs = lesson.main_diagrams()[:1]
    try:
        ps = piezas_figura(specs[0]) if specs else []
        marco = marco_figura(specs[0]) if ps else {}
    except (AttributeError, TypeError, ValueError, KeyError):
        ps, marco = [], {}  # una figura con datos de forma inesperada: la pieza sale sin esquema, no revienta el libro
    if not ps:
        return []
    spec = specs[0]
    titulo = T.clean(spec.get("titulo"))
    pie = T.clean(spec.get("pie"))
    base = {
        "spec": spec, "pieces": [_con_icono(p.to_view(), lesson) for p in ps], "order": G.order(ps), "n": len(ps), "title": titulo,
        "kicker": ROTULOS["figura"], "patron": patron_visual(spec), "marco": marco,
    }
    nivel = next((nv for nv in (0, 1, 2) if nv >= nivel_min and sum(T.n_words(x) for p in ps for x in _lectura(p, nv)) <= max_words), 2)

    intro = _fixed("figura", "plantilla+esquema.titulo", titulo=titulo.rstrip(".")) if titulo else None
    scenes = [Scene("c-figura", "Esquema", dict(base, mode="titulo", active=-1, shown=len(ps)), [intro] if intro else [], hold_s=0.0 if intro else 1.2, pause_after_s=0.35)]
    if base["patron"] != "silueta":
        # La estructura no aparece hecha: se construye pieza a pieza (cada una se dibuja al entrar) mientras se dice su título.
        primera = scenes[0]
        primera.view["shown"] = 0
        primera.beats = [Beat({"shown": j + 1}, at_s=round(ENTRADA_PRIMERA_S + j * ENTRADA_PIEZA_S, 2)) for j in range(len(ps))]
        pasos = len(ps)
        if base["patron"] == "ciclo":
            # Lo último que se dibuja en un ciclo es la flecha que vuelve al principio: es lo que lo hace ciclo.
            primera.view["vuelta"] = 0
            primera.beats.append(Beat({"vuelta": 1}, at_s=round(ENTRADA_PRIMERA_S + pasos * ENTRADA_PIEZA_S, 2)))
            pasos += 1
        construir = ENTRADA_PRIMERA_S + pasos * ENTRADA_PIEZA_S + 0.5
        if intro:
            primera.pause_after_s = round(max(0.35, construir - segundos_locucion(intro.text)), 2)
        else:
            primera.hold_s = round(max(1.2, construir), 2)
    for j, p in enumerate(ps):
        partes = [Part(_punto(x), "esquema.datos") for x in _lectura(p, nivel)]
        hablado = segundos_locucion(" ".join(x.text for x in partes))
        leer = sum(T.n_words(x) for x in p.lines) / LECTURA_PPS + 0.5
        scenes.append(
            Scene("c-figura", "Esquema", dict(base, mode="pieza", active=j, shown=j + 1), partes, pause_after_s=round(min(PAUSA_TARJETA_MAX, max(0.35, leer - hablado)), 2))
        )
    if pie:
        scenes.append(Scene("c-figura", "Esquema", dict(base, mode="pie", active=-1, shown=len(ps), pie=pie), [Part(_punto(pie), "esquema.pie")], pause_after_s=0.6))
    return scenes


# ───────────────────────── las cuatro piezas ─────────────────────────

def _sin_recorrido(figura: list[Scene]) -> list[Scene]:
    """El esquema como recapitulación: la estructura entera (y su pie), sin recorrer las piezas una a una."""
    return [s for s in figura if s.view.get("mode") != "pieza"]


def _sin_pie_repetido(figura: list[Scene], lesson: Lesson) -> list[Scene]:
    """Si el pie del esquema dice lo mismo que el matiz que viene justo después, se queda el matiz (que es obligatorio
    y va entero): oír dos veces seguidas la misma salvedad no la refuerza, cansa."""
    return [s for s in figura if not (s.view.get("mode") == "pie" and cubre(str(s.view.get("pie") or ""), lesson.autocorreccion))]


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


def pieza_idea(book: Book, index: int, breve: bool = False) -> Pieza | None:
    """La pieza principal, con arco: tensión (la idea en frío, o la pregunta que la lección se hace) →
    de dónde sale → **la explicación** (los primeros párrafos del cuerpo, enteros) → el esquema, que la resume a la
    vista → giro (el matiz) → cierre que retoma el gancho.

    Dura lo que la explicación pida (lo normal, 70-130 s): una idea afirmada sin su porqué se recuerda peor y se
    malinterpreta mejor. `breve=True` da la versión de antes: sin explicación y apretada para no pasar de 60 s.

    Si la lección no da para ese arco, no se fuerza:
      · sin figura recorrible → idea y matiz («sin_esquema»);
      · sin idea redactada y con un arranque que solo habla del libro → abre el esquema («esquema_primero»);
      · sin ninguna de las dos cosas → no hay pieza.
    """
    if not breve:
        return _pieza_idea(book, index, explicar=True)
    pieza = None
    for apretar in (0, 1, 2, 3):  # 0: como sale · 1: matiz breve · 2 y 3: el esquema se lee menos en voz alta
        pieza = _pieza_idea(book, index, apretar)
        if pieza is None or pieza.estimated_seconds <= OBJETIVO_S:
            break
    return pieza


def _pieza_idea(book: Book, index: int, apretar: int = 0, explicar: bool = False) -> Pieza | None:
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
        scenes += [*figura, escena_credito(book), *(escenas_explicacion(lesson) if explicar else [])]
        recuerda = T.clean(figura[-1].view.get("pie")) or gancho
    else:
        arco = "completo" if figura else "sin_esquema"
        gancho, gancho_origen = idea, f"leccion.{origen}"
        abre = pregunta_del_cuerpo(lesson) if origen != "cuerpo" else ""
        if abre:
            scenes.append(escena_frase("Pregunta", "pregunta", ROTULOS["idea"], [Part(abre, "leccion.cuerpo")], tema_txt=tema(lesson), pause_after_s=0.7))
            gancho, gancho_origen = abre, "leccion.cuerpo"
        explicacion = escenas_explicacion(lesson, ya_dicho=(abre, idea)) if explicar else []
        if acompanar(explicacion, figura):
            figura = _sin_recorrido(figura)  # la explicación ya nombró cada pieza con el esquema delante
        # Lo concreto, si la lección lo trae: el párrafo que cuenta un caso, aunque la explicación no haya llegado a él.
        caso = caso_parrafo(lesson, [p for e in explicacion for p in e.parts]) if explicacion else None
        if caso:
            explicacion.append(escena_frase("Caso", "caso", ROTULOS["caso"], [caso], pause_after_s=0.55))
        scenes += [
            escena_frase("Idea", "idea", ROTULOS["idea"], [Part(idea, f"leccion.{origen}")], tema_txt=tema(lesson), pause_after_s=0.4),
            escena_credito(book),
            *explicacion,
            *figura,
        ]
        recuerda = idea
    if explicar and arco != "esquema_primero":
        figura_sin_pie = _sin_pie_repetido(figura, lesson)
        scenes = [s for s in scenes if s not in figura or s in figura_sin_pie]
    practica: list[Part] = []
    if explicar:
        matiz = escena_matiz(lesson, MATIZ_ENTERO)
        practica = practica_partes(lesson, PRACTICA_BREVE)  # y qué hacer con la idea: la pieza no acaba en la teoría
    else:
        matiz = escena_matiz(lesson, MATIZ_CORTO if (largo_figura > 16 or apretar) else MATIZ_PALABRAS)
    if matiz:
        scenes.append(matiz)
    if practica:
        scenes.append(escena_frase("Práctica", "practica", ROTULOS["practica"], practica, pause_after_s=0.5))
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
        titulo_pub=arranque_literal(lesson.titulo, 16),
        descripcion_pub=_descripcion(book, [gancho if flojo else idea, _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["idea"], "text": arranque_literal(gancho, PORTADA_PALABRAS), "tema": tema(lesson)},
    )


def pieza_pregunta(book: Book, index: int, breve: bool = False) -> Pieza | None:
    """Pregunta → pausa → respuesta y su porqué. Sin las opciones falsas: sueltas en una captura, desinforman."""
    lesson = book.lessons[index]
    q = pregunta_autonoma(lesson)
    if not q:
        return None
    k = index + 1
    correcta = _punto(q.opciones[q.correcta])
    scenes: list[Scene] = [*escenas_comprueba(lesson, breve), escena_credito(book)]
    matiz = escena_matiz(lesson, MATIZ_CORTO if breve else MATIZ_ENTERO)
    if matiz:
        scenes.append(matiz)
    scenes.append(escena_cierre(book, recuerda=correcta, antes=q.texto))  # cierra con la pregunta y su respuesta, juntas: la respuesta sola no dice de qué
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
        titulo_pub=arranque_literal(q.texto, 18),
        descripcion_pub=_descripcion(book, [q.texto, f"La respuesta: {correcta}", _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["pregunta"], "text": arranque_literal(q.texto, PORTADA_PALABRAS), "tema": tema(lesson)},
    )


def pieza_practica(book: Book, index: int, breve: bool = False) -> Pieza | None:
    """Qué probar → la idea que hay detrás → el matiz."""
    if not breve:
        return _pieza_practica(book, index, PRACTICA_PALABRAS, MATIZ_ENTERO)
    pieza = _pieza_practica(book, index, PRACTICA_PALABRAS)
    if pieza is not None and pieza.estimated_seconds > OBJETIVO_S:
        pieza = _pieza_practica(book, index, PRACTICA_BREVE)
    return pieza


def _pieza_practica(book: Book, index: int, max_words: int, matiz_words: int = MATIZ_CORTO) -> Pieza | None:
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
    matiz = escena_matiz(lesson, matiz_words)
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
        titulo_pub=arranque_literal(f"Pruébalo: {titulo_corto(lesson.titulo)}", 16),
        descripcion_pub=_descripcion(book, [partes[0].text, f"La idea detrás: {idea}", _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["practica"], "text": arranque_literal(gancho, PORTADA_PALABRAS), "tema": tema(lesson)},
    )


def pieza_caso(book: Book, index: int, breve: bool = False) -> Pieza | None:
    """Lo concreto antes que lo abstracto: el caso que cuenta la lección → la idea que hay detrás → el matiz."""
    lesson = book.lessons[index]
    partes = caso_partes(lesson)
    if not partes:
        return None
    k = index + 1
    idea, origen = hilo(lesson)
    if origen in ("cuerpo", "titulo"):
        return None  # sin idea redactada, el caso se quedaría sin la idea que ilustra (y el arranque del cuerpo puede ser el propio caso)
    gancho = T.split_sentences(partes[0].text)[0]
    scenes: list[Scene] = [
        escena_frase("Caso", "caso", ROTULOS["caso"], partes, tema_txt=tema(lesson), pause_after_s=0.6),
        escena_frase("Idea", "idea", ROTULOS["idea_detras"], [_fixed("idea_detras"), Part(idea, f"leccion.{origen}")], skip_parts=1, pause_after_s=0.4),
        escena_credito(book),
    ]
    matiz = escena_matiz(lesson, MATIZ_CORTO if breve else MATIZ_ENTERO)
    if matiz:
        scenes.append(matiz)
    scenes.append(escena_cierre(book, recuerda=idea))  # el caso abre; lo que se lleva uno es la idea
    return _base(
        book,
        key=_clave("caso", k, lesson),
        format="caso",
        tipo="caso",
        title=lesson.titulo,
        lesson_id=lesson.id,
        leccion_n=k,
        scenes=scenes,
        summary=partes[0].text,
        gancho=gancho,
        gancho_origen="leccion.cuerpo",
        titulo_pub=arranque_literal(f"Un caso: {titulo_corto(lesson.titulo)}", 16),
        descripcion_pub=_descripcion(book, [partes[0].text, f"La idea detrás: {idea}", _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["caso"], "text": arranque_literal(gancho, PORTADA_PALABRAS), "tema": tema(lesson)},
    )


def pieza_fondo(book: Book, index: int, breve: bool = False) -> Pieza | None:
    """La lección entera, suelta: la idea → de dónde sale → **todo el cuerpo**, párrafo a párrafo → el esquema leído
    entero → el matiz completo → qué probar → cierre. De dos a cuatro minutos; para YouTube, LinkedIn o quien quiera
    entender la idea y no solo oírla. No resume ni elige: lo que la lección explica, en su orden."""
    lesson = book.lessons[index]
    k = index + 1
    idea, origen = hilo(lesson)
    if origen == "titulo":
        return None  # sin cuerpo no hay nada que contar a fondo
    explicacion = escenas_explicacion(lesson, None, ya_dicho=(idea,))
    if sum(T.n_words(s.narration) for s in explicacion) < 60:
        return None  # con tan poco cuerpo, la pieza «idea» ya lo dice todo
    figura = escenas_figura(lesson, max_words=FIGURA_FONDO)
    acompanar(explicacion, figura)  # el esquema, a la vista mientras se explica; después se recorre entero igualmente
    scenes: list[Scene] = [
        escena_frase("Idea", "idea", ROTULOS["fondo"], [Part(idea, f"leccion.{origen}")], tema_txt=tema(lesson), pause_after_s=0.4),
        escena_credito(book),
        *explicacion,
        *_sin_pie_repetido(figura, lesson),
        *escenas_comprueba(lesson, rotulo=ROTULOS["comprueba"]),  # antes de seguir: ¿se ha entendido? (recordar activamente fija la idea)
    ]
    conexion = escena_conexion(lesson)
    if conexion:
        scenes.append(conexion)  # la idea, situada entre otros autores, antes de su matiz
    matiz = escena_matiz(lesson, 10**6)
    if matiz:
        scenes.append(matiz)
    practica = practica_partes(lesson, 10**6)
    if practica:
        scenes.append(escena_frase("Práctica", "practica", ROTULOS["practica"], practica, pause_after_s=0.5))
    scenes.append(escena_cierre(book, recuerda=idea))
    return _base(
        book,
        key=_clave("fondo", k, lesson),
        format="fondo",
        tipo="fondo",
        title=lesson.titulo,
        lesson_id=lesson.id,
        leccion_n=k,
        scenes=scenes,
        summary=idea,
        gancho=idea,
        gancho_origen=f"leccion.{origen}",
        titulo_pub=arranque_literal(f"A fondo: {titulo_corto(lesson.titulo)}", 16),
        descripcion_pub=_descripcion(book, [idea, _matiz_pub(lesson)]),
        etiquetas_pub=_etiquetas(book, lesson),
        portada={"tag": ROTULOS["fondo"], "text": arranque_literal(idea, PORTADA_PALABRAS), "tema": tema(lesson)},
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
        titulo_pub=arranque_literal(f"{titulo_corto(book.titulo)} en {n} ideas", 16),
        descripcion_pub=_descripcion(book, [_punto(cierre), " · ".join(etiquetas)]),
        etiquetas_pub=_etiquetas(book),
        portada={"tag": rotulo, "text": arranque_literal(cierre, PORTADA_PALABRAS), "tema": ""},
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
    "caso": "la lección no cuenta un caso concreto («Un ejemplo:», «Imagina que…»), o no tiene idea redactada que ilustrar",
    "libro": "el libro no tiene mapa con frase de cierre en datos/mapas.json",
    "fondo": "la lección no tiene cuerpo suficiente (o solo se entiende dentro de la serie) para una pieza larga",
}


def _huella_gancho(texto: str) -> str:
    return " ".join(T.content_tokens(texto))


def plan_libro(book: Book, tipos: tuple[str, ...] | list[str] = TIPOS, solo_leccion: int | None = None, breve: bool = False) -> Plan:
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
    constructores = {"idea": pieza_idea, "pregunta": pieza_pregunta, "practica": pieza_practica, "caso": pieza_caso, "fondo": pieza_fondo}
    for i in indices:
        for tipo in constructores:
            if tipo not in tipos:
                continue
            p = constructores[tipo](book, i, breve)
            if p:
                piezas.append(p)
            else:
                omitidas.append(Omitida(tipo, i + 1, book.lessons[i].titulo, _MOTIVO[tipo]))

    # Dos piezas no pueden abrir igual: la segunda se cae (y queda anotada). La pieza «a fondo» es otra cosa
    # (la versión larga de la idea): abre como ella a propósito y solo se compara con las demás «a fondo».
    vistos: dict[str, str] = {}
    unicas: list[Pieza] = []
    for p in piezas:
        h = ("fondo·" if p.tipo == "fondo" else "") + _huella_gancho(p.gancho)
        if h.removeprefix("fondo·") and h in vistos:
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
    otras = sorted((p for p in piezas if p.tipo in ("pregunta", "practica", "caso", "fondo")), key=lambda p: (p.leccion_n, p.tipo))
    # Se alternan pregunta, práctica, caso y la versión a fondo en lo posible.
    colas = [[p for p in otras if p.tipo == t] for t in ("pregunta", "practica", "caso", "fondo")]
    cola: list[Pieza] = []
    while any(colas):
        for c in colas:
            if c:
                cola.append(c.pop(0))
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

def _rotulo_tipo(p: Pieza) -> str:
    return ROTULOS[p.tipo].format(n=sum(1 for s in p.scenes if s.kind == "c-nodo"))


def _recorta(texto: str, max_chars: int) -> str:
    """El texto si cabe; si no, su arranque literal hasta donde quepa, por palabras enteras, con «…»."""
    t = " ".join(str(texto).split())
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rsplit(" ", 1)[0].rstrip(" ,;:—–(") + "…"


def textos_por_red(p: Pieza) -> dict[str, dict[str, str]]:
    """El texto que acompaña al vídeo, a la medida de cada red. Mismo material (título, descripción, etiquetas:
    corpus y `ROTULOS`), distinta longitud. No lleva enlaces: no caducan y cada cuenta pone el suyo."""
    etiquetas = p.etiquetas_pub
    parrafos = [x for x in p.descripcion_pub.split("\n\n") if x]
    credito = next((x for x in parrafos if x.startswith("Del libro «")), "")
    cuerpo = [x for x in parrafos if x != credito and not x.startswith(ROTULOS["marca"])]
    breve = " ".join(etiquetas[:4])
    # Donde el espacio es poco, el libro va con su título corto (un prefijo literal del título).
    credito_corto = f"Del libro «{titulo_corto(p.book_title)}»" + (f", de {p.book_author}." if p.book_author else ".")
    x_cola = f" {credito_corto} {' '.join(etiquetas[:2])}".rstrip()
    # La pieza larga no es un Short: va a YouTube como vídeo normal.
    youtube = ("youtube", _recorta(p.titulo_pub, 100)) if p.tipo == "fondo" else ("youtube_shorts", _recorta(p.titulo_pub, 92) + " #Shorts")
    return {
        youtube[0]: {
            "titulo": youtube[1],
            "descripcion": p.descripcion_pub + "\n\n" + " ".join(etiquetas),
        },
        "tiktok": {"texto": _recorta(f"{p.titulo_pub}. {credito_corto}", 150 - len(breve) - 1) + " " + breve},
        "instagram_reels": {"texto": "\n\n".join([p.titulo_pub, *cuerpo, credito, " ".join(etiquetas)])},
        "linkedin": {"texto": "\n\n".join([*cuerpo, credito, ROTULOS["marca"] + " · " + ROTULOS["lema"].lower(), " ".join(etiquetas[:5])])},
        "x": {"texto": _recorta(p.gancho, max(40, 280 - len(x_cola))) + x_cola},
        "whatsapp": {"texto": f"{_recorta(p.gancho, 220)}\n{credito_corto}"},
    }


def texto_publicacion(p: Pieza, duracion_s: float = 0.0) -> str:
    """Lo que acompaña al vídeo al subirlo: título, descripción y etiquetas, y debajo la versión de cada red."""
    lineas = [p.titulo_pub, "", p.descripcion_pub, "", " ".join(p.etiquetas_pub)]
    if duracion_s:
        lineas += ["", f"({_rotulo_tipo(p)} · {duracion_s:.0f} s)"]
    nombres = {"youtube": "YouTube", "youtube_shorts": "YouTube Shorts", "tiktok": "TikTok", "instagram_reels": "Instagram Reels", "linkedin": "LinkedIn", "x": "X", "whatsapp": "WhatsApp"}
    for red, campos in textos_por_red(p).items():
        lineas += ["", "", f"── {nombres[red]} " + "─" * 30]
        for campo, valor in campos.items():
            lineas += ["", f"[{campo}]", valor] if len(campos) > 1 else ["", valor]
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
