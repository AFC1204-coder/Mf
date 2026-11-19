"""Guionista: convierte un libro del corpus en una serie de episodios con estructura didáctica fija.

Tres decisiones de diseño:

1. **La voz solo dice texto del corpus.** El guion recorta por frases enteras la lección (cuerpo,
   idea, matiz, aplicación, pregunta) y lo une con las fórmulas fijas de `PHRASES`. No hay modelo
   que redacte: lo que se oye es lo que ya está verificado en la biblioteca.
2. **Cada lección sigue la misma secuencia**, visible en pantalla como índice: idea → desarrollo →
   esquema → matiz → práctica → repaso. Activar lo previo, explicar, sintetizar en una figura,
   matizar, transferir y recuperar.
3. **El libro es una serie.** La idea de cada lección en una frase (`Lesson.thread`) es el hilo:
   abre su lección, la cierra, enlaza con la siguiente («Venimos de…») y vuelve en el repaso final.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from . import text as T
from .corpus import Book, Lesson, Question

SCRIPT_VERSION = 2
WORDS_PER_SECOND = 2.4  # ritmo de explicación tranquila (~145 palabras/min)

FORMATS = ("clase", "corto")

# Presupuesto de texto en pantalla: el texto largo se oye, no se lee. Una frase ancla cabe de un vistazo.
ANCHOR_MAX_WORDS = 16
STEP_LABEL_WORDS = 7

# Fórmulas fijas que unen el texto del corpus. Son lo ÚNICO que el guion añade por su cuenta.
PHRASES = {
    "gancho": "Antes de empezar, una pregunta.",
    "gancho_cierre": "Quédate con ella: la contestas al final.",
    "pregunta_vuelve": "Volvemos a la pregunta del principio.",
    "respuesta_corta": "La respuesta:",
    "portada": "{libro}, de {autor}. Lección {k} de {n}: {titulo}.",
    "portada_sin_autor": "{libro}. Lección {k} de {n}: {titulo}.",
    "puente": "Venimos de la lección anterior, {titulo}.",
    "idea": "La idea de hoy.",
    "arranque": "El punto de partida.",
    "esquema": "Míralo en un esquema: {titulo}.",
    "esquema_extra": "Y en una figura más: {titulo}.",
    "matiz": "Ahora, el matiz.",
    "practica": "Llévalo a la práctica.",
    "pregunta": "Comprueba si te quedas con la idea.",
    "pensar": "",
    "respuesta": "La respuesta es la {letra}: {opcion}",
    "cierre": "Quédate con esto.",
    "siguiente": "En la siguiente lección: {titulo}.",
    "ultima": "Con esta lección termina el recorrido por {libro}.",
    "libro": "{libro}, de {autor}.",
    "libro_sin_autor": "{libro}.",
    "mapa_intro": "Estas son sus ideas centrales.",
    "mapa_cierre": "La idea que lo une todo.",
    "ruta": "Lo recorreremos en {n} lecciones.",
    "ruta_item": "Lección {k}: {titulo}.",
    "ruta_larga": "Empieza en {primera} y termina en {ultima}.",
    "empezamos": "Empezamos por la lección 1: {titulo}.",
    "repaso": "Repaso de {libro}, de {autor}: sus {n} lecciones, una idea cada una.",
    "repaso_sin_autor": "Repaso de {libro}: sus {n} lecciones, una idea cada una.",
    "repaso_idea": "Lección {k}, {titulo}.",
    "repaso_mapa": "En conjunto, el libro dice esto.",
    "repaso_preguntas": "Para terminar, compruébalo.",
    "repaso_cierre": "Has repasado {libro}. Vuelve a cualquier lección cuando quieras afianzar una idea.",
}

LETRAS = "ABCDEFGH"


@dataclass
class Part:
    """Un tramo de locución y de dónde sale: «plantilla» o un campo del corpus («leccion.cuerpo»…)."""

    text: str
    origin: str


@dataclass
class Beat:
    """Un cambio en pantalla dentro de una escena, anclado a una palabra de la locución o a un segundo."""

    patch: dict[str, Any]
    at_word: int | None = None
    at_s: float | None = None


@dataclass
class Scene:
    kind: str  # plantilla visual: portada · puente · idea · texto · esquema · pregunta · cierre · libro · ruta · mapa
    section: str  # entrada del índice de la clase que queda resaltada ("" = ninguna)
    view: dict[str, Any]
    parts: list[Part] = field(default_factory=list)
    beats: list[Beat] = field(default_factory=list)
    hold_s: float = 0.0  # duración de una escena sin voz
    pause_after_s: float = 0.35

    @property
    def narration(self) -> str:
        return " ".join(p.text for p in self.parts if p.text).strip()

    @property
    def speech(self) -> str:
        return T.for_speech(self.narration)

    @property
    def screen_words(self) -> int:
        """Palabras de contenido que se leen en pantalla (sin cabecera, rótulos ni subtítulos)."""
        v = self.view
        if self.kind == "esquema":
            return 0  # una figura no es un texto: se mira
        if self.kind == "pregunta":
            return T.n_words(str(v.get("question") or "")) + sum(T.n_words(o) for o in v.get("options") or []) + T.n_words(str(v.get("explanation") or ""))
        if self.kind == "mapa":
            nodos = v.get("nodes") or []
            activo = v.get("active", -1)
            total = sum(T.n_words(str(n.get("etiqueta") or "")) for n in nodos[: int(v.get("shown") or 0)])
            if isinstance(activo, int) and 0 <= activo < len(nodos):
                total += T.n_words(str(nodos[activo].get("texto") or ""))
            return total + (T.n_words(str(v.get("cierre") or "")) if v.get("show_cierre") else 0)
        if self.kind == "ruta":
            return sum(T.n_words(t) for t in (v.get("items") or [])[: max(int(v.get("shown") or 0), 1)])
        campos = ("text", "title", "description", "question", "next_title")
        return sum(T.n_words(str(v.get(c) or "")) for c in campos) + sum(T.n_words(c) for c in v.get("chips") or [])

    @property
    def estimated_seconds(self) -> float:
        if not self.narration:
            return round(self.hold_s + self.pause_after_s, 1)
        return round(T.n_words(self.narration) / WORDS_PER_SECOND + self.pause_after_s, 1)


@dataclass
class Episode:
    key: str  # nombre de carpeta: «00-presentacion», «03-el-no-como-herramienta», «99-repaso»
    kind: str  # presentacion | leccion | repaso
    format: str  # clase | corto
    title: str
    number: int  # nº de lección (0 en presentación y repaso)
    total: int  # lecciones del libro
    book_id: str
    book_title: str
    book_author: str
    eje: str
    lesson_id: str = ""
    sections: list[str] = field(default_factory=list)
    scenes: list[Scene] = field(default_factory=list)
    summary: str = ""  # texto de publicación (la idea de la lección o la descripción del libro)

    @property
    def total_words(self) -> int:
        return sum(T.n_words(s.narration) for s in self.scenes)

    @property
    def estimated_seconds(self) -> float:
        return round(sum(s.estimated_seconds for s in self.scenes), 1)

    @property
    def counter(self) -> str:
        if self.kind == "leccion":
            return f"LECCIÓN {self.number}/{self.total}"
        return "PRESENTACIÓN" if self.kind == "presentacion" else "REPASO"

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["script_version"] = SCRIPT_VERSION
        d["total_words"] = self.total_words
        d["estimated_seconds"] = self.estimated_seconds
        for sd, s in zip(d["scenes"], self.scenes):
            sd["narration"] = s.narration
        return d

    def fingerprint(self) -> str:
        """Huella del contenido: si no cambia, el episodio ya renderizado sigue valiendo."""
        raw = json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


# ───────────────────────── piezas ─────────────────────────

def _fixed(key: str, **kw: Any) -> Part:
    return Part(PHRASES[key].format(**kw), "plantilla")


def _hints(lesson: Lesson) -> list[str]:
    """Rótulos del esquema y etiquetas: lo que ya está señalado como importante en la lección."""
    out: list[str] = list(lesson.etiquetas)

    def walk(o: Any) -> None:
        if isinstance(o, str):
            out.append(o)
        elif isinstance(o, dict):
            for k, v in o.items():
                if k not in ("tono", "icono", "expr", "color"):
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for spec in lesson.main_diagrams():
        walk(spec.get("datos"))
    return out


def chunk_body(cuerpo: str, max_words: int = 95, target: int = 75) -> list[str]:
    """Bloques del cuerpo: un párrafo por bloque; los párrafos largos se parten por frases enteras."""
    bloques: list[str] = []
    for p in T.paragraphs(cuerpo):
        total = T.n_words(p)
        if total <= max_words:
            bloques.append(p)
            continue
        partes = max(2, round(total / target))
        objetivo = total / partes
        actual: list[str] = []
        acumulado = 0
        for f in T.split_sentences(p):
            w = T.n_words(f)
            if actual and partes > 1 and acumulado + w / 2 > objetivo:
                bloques.append(" ".join(actual))
                partes -= 1
                actual, acumulado = [], 0
            actual.append(f)
            acumulado += w
        if actual:
            bloques.append(" ".join(actual))
    return bloques


def anchor_sentence(block: str, max_words: int = ANCHOR_MAX_WORDS) -> str:
    """La frase ancla del bloque: un trozo corto y literal de su primera frase. El resto se oye."""
    frases = T.split_sentences(block)
    if not frases:
        return ""
    ancla = frases[0]
    if T.n_words(ancla) < 6 and len(frases) > 1 and T.n_words(ancla) + T.n_words(frases[1]) <= max_words:
        ancla = f"{ancla} {frases[1]}"
    return T.anchor_clause(ancla, max_words)


def thread_anchor(hilo: str) -> str:
    """El hilo de la lección tal como se ve en pantalla: siempre el mismo trozo, en la idea, el puente, el cierre y el repaso."""
    return T.anchor_clause(hilo, ANCHOR_MAX_WORDS + 4)


def step_label(block: str) -> str:
    """Rótulo mínimo de un paso ya explicado (para la escalera del desarrollo): arranque literal."""
    frases = T.split_sentences(block)
    return T.shorten_clause(frases[0], STEP_LABEL_WORDS) if frases else ""


def _text_scene(
    section: str,
    kicker: str,
    tone: str,
    intro: Part | None,
    body: str,
    origin: str,
    hints: list[str],
    step: tuple[int, int] | None = None,
    visible: list[str] | None = None,
    trail: list[str] | None = None,
) -> Scene:
    """Escena de texto: frase ancla fija y términos clave que aparecen cuando se nombran."""
    parts = ([intro] if intro else []) + [Part(body, origin)]
    desplazamiento = T.n_words(intro.text) if intro else 0
    ancla = anchor_sentence(body)
    terms = T.key_terms(body, hints, exclude=[ancla.rstrip("…"), *(visible or [])])
    view: dict[str, Any] = {
        "kicker": kicker,
        "tone": tone,
        "text": ancla,
        "chips": [t for t, _ in terms],
        "chips_on": 0,
    }
    if step:
        view["step"] = list(step)
    if trail is not None and step and step[1] > 1:
        # Escalera del desarrollo: los pasos ya dados quedan a la vista en pequeño; el actual, grande.
        view["trail"] = list(trail)
    beats = [Beat({"chips_on": i + 1}, at_word=desplazamiento + pos) for i, (_, pos) in enumerate(terms)]
    return Scene("texto", section, view, parts, beats)


_DEPENDIENTES = (
    "esto ", "esta ", "este ", "estos ", "estas ", "ese ", "esa ", "eso ", "ello ", "pero ", "sin embargo",
    "además", "ademas", "así ", "asi ", "también", "tambien", "y ", "por eso", "por tanto", "por ello", "en cambio",
    "es decir", "dicho ", "de ahí", "de ahi", "el segundo", "la segunda", "el tercero", "la tercera", "segundo,",
    "tercero,", "por último", "por ultimo", "finalmente", "a su vez", "lo anterior", "tal ", "aun así", "no obstante",
    "en ambos", "ambos ", "ambas ", "su ", "sus ",
)


def _is_self_contained(sentence: str) -> bool:
    """¿Se entiende la frase sin la anterior? (para el formato corto, que salta entre párrafos)."""
    s = sentence.strip().lower().lstrip("«\"“¿¡(")
    return not s.startswith(_DEPENDIENTES)


def _quiz_scenes(q: Question, section: str, intro: Part | None) -> list[Scene]:
    """Pregunta → tiempo para pensar (con cuenta atrás) → respuesta razonada. Práctica de recuperación."""
    base = {
        "kicker": "COMPRUEBA",
        "question": q.texto,
        "options": q.opciones,
        "countdown": None,
        "reveal": False,
        "correct": q.correcta,
        "explanation": "",
    }
    ask = Scene(
        "pregunta",
        section,
        dict(base),
        ([intro] if intro else []) + [Part(q.texto, "pregunta.texto")],
        pause_after_s=0.2,
    )
    palabras = sum(T.n_words(o) for o in q.opciones)
    hold = max(5.0, min(9.0, palabras / 5.0))
    think = Scene(
        "pregunta",
        section,
        dict(base, countdown=0),
        [],
        [Beat({"countdown": n}, at_s=hold - n) for n in (3, 2, 1)],
        hold_s=hold,
        pause_after_s=0.0,
    )
    explic = T.take_sentences(q.explicacion, 45)
    letra = LETRAS[q.correcta] if q.correcta < len(LETRAS) else str(q.correcta + 1)
    opcion = q.opciones[q.correcta].rstrip()
    if not opcion.endswith((".", "!", "?", "…")):
        opcion += "."
    # La fórmula fija y la opción (literal) van en tramos separados para poder comprobar la segunda.
    respuesta = [
        Part(PHRASES["respuesta"].split("{opcion}")[0].format(letra=letra).strip(), "plantilla"),
        Part(opcion, "pregunta.opcion"),
    ]
    if explic:
        respuesta.append(Part(explic, "pregunta.explicacion"))
    answer = Scene(
        "pregunta",
        section,
        dict(base, reveal=True, explanation=T.anchor_clause(T.take_sentences(q.explicacion, 1), ANCHOR_MAX_WORDS)),
        respuesta,
        pause_after_s=0.8,
    )
    return [ask, think, answer]


def _hook_scene(q: Question, k: int, n: int, titulo: str, clase: bool) -> Scene:
    """Gancho: la pregunta de la propia lección abre el episodio y queda pendiente hasta el final.

    Intentar contestar antes de aprender (aunque se falle) mejora lo que se retiene después, y da
    al episodio un arco: pregunta abierta → explicación → la misma pregunta, ya con respuesta.
    """
    parts = [Part(q.texto, "pregunta.texto")]
    if clase:
        parts = [_fixed("gancho"), *parts, _fixed("gancho_cierre")]
    return Scene(
        "gancho",
        "",
        {
            "kicker": "ANTES DE EMPEZAR" if clase else f"LECCIÓN {k} DE {n}",
            "question": q.texto,
            "note": "La contestas al final" if clase else titulo,
        },
        parts,
        pause_after_s=0.9,
    )


def _short_answer_scene(q: Question) -> Scene:
    """Formato corto: se cierra el gancho con la opción correcta, sin opciones ni cuenta atrás."""
    opcion = q.opciones[q.correcta].rstrip()
    if not opcion.endswith((".", "!", "?", "…")):
        opcion += "."
    return Scene(
        "gancho",
        "Respuesta",
        {"kicker": "LA RESPUESTA", "question": q.texto, "answer": T.anchor_clause(opcion, 22), "tone": "ok"},
        [_fixed("respuesta_corta"), Part(opcion, "pregunta.opcion")],
        pause_after_s=0.8,
    )


def _diagram_scenes(lesson: Lesson, section: str, limit: int) -> list[Scene]:
    """El esquema verificado de la lección, con su título y su pie leídos tal cual."""
    scenes: list[Scene] = []
    for i, spec in enumerate(lesson.main_diagrams()[:limit]):
        titulo = T.clean(spec.get("titulo")) or "el esquema de la lección"
        parts = [_fixed("esquema" if i == 0 else "esquema_extra", titulo=titulo.rstrip("."))]
        parts[0].origin = "plantilla+esquema.titulo"
        pie = T.clean(spec.get("pie"))
        if pie:
            parts.append(Part(pie if pie.endswith((".", "!", "?", "…")) else pie + ".", "esquema.pie"))
        scenes.append(
            Scene(
                "esquema",
                section,
                {"kicker": "EL ESQUEMA" if i == 0 else "UNA FIGURA MÁS", "spec": spec},
                parts,
                pause_after_s=2.6,  # tiempo para leer la figura en silencio
            )
        )
    return scenes


SHORT_MAX_S = 92.0


def _fit_short(scenes: list[Scene]) -> None:
    """Formato corto: si se pasa de tiempo, sobran frases de desarrollo (de la última a la primera)."""
    while sum(s.estimated_seconds for s in scenes) > SHORT_MAX_S:
        desarrollo = [s for s in scenes if s.section == "Desarrollo"]
        if len(desarrollo) <= 1:
            break
        scenes.remove(desarrollo[-1])
        for i, s in enumerate(desarrollo[:-1]):
            s.view["step"] = [i + 1, len(desarrollo) - 1]
            if len(desarrollo) - 1 < 2:
                s.view.pop("trail", None)


def _route(book: Book, current: int) -> dict[str, Any]:
    return {"n": len(book.lessons), "current": current}


# ───────────────────────── episodios ─────────────────────────

def _base_episode(book: Book, **kw: Any) -> Episode:
    return Episode(
        book_id=book.id,
        book_title=book.titulo,
        book_author=book.autor,
        eje=book.eje,
        total=len(book.lessons),
        **kw,
    )


def lesson_episode(book: Book, index: int, fmt: str = "clase", with_quiz: bool = True) -> Episode:
    """Episodio de una lección dentro de su serie. `index` es su posición (0…N-1) en el libro."""
    if fmt not in FORMATS:
        raise ValueError(f"Formato desconocido: {fmt!r} (usa {', '.join(FORMATS)})")
    lesson = book.lessons[index]
    k, n = index + 1, len(book.lessons)
    hilo, hilo_origen = lesson.thread()
    hints = _hints(lesson)
    visible = [book.titulo, book.autor, lesson.titulo]  # ya están en la cabecera: no se señalan otra vez
    bloques = chunk_body(lesson.cuerpo)
    scenes: list[Scene] = []
    clase = fmt == "clase"

    q = lesson.pick_question() if with_quiz else None

    # 0 · Gancho: la pregunta de la lección, antes de nada. Se contesta al final.
    if q:
        scenes.append(_hook_scene(q, k, n, lesson.titulo, clase))

    # 1 · Portada: sitúa la lección en el libro.
    clave = "portada" if book.autor else "portada_sin_autor"
    portada_view = {
        "kicker": f"LECCIÓN {k} DE {n}",
        "title": lesson.titulo,
        "book": book.titulo,
        "author": book.autor,
        "eje": book.eje,
        "route": _route(book, k),
    }
    if clase:
        scenes.append(
            Scene(
                "portada",
                "",
                portada_view,
                [_fixed(clave, libro=book.titulo, autor=book.autor, k=k, n=n, titulo=lesson.titulo.rstrip("."))],
            )
        )
        scenes[-1].parts[0].origin = "plantilla+titulos"

        # 2 · Puente: activa lo anterior antes de añadir lo nuevo.
        if index > 0:
            prev = book.lessons[index - 1]
            prev_hilo, prev_origen = prev.thread()
            scenes.append(
                Scene(
                    "puente",
                    "",
                    {
                        "kicker": "VENIMOS DE",
                        "number": k - 1,
                        "title": prev.titulo,
                        "text": thread_anchor(prev_hilo),
                        "route": _route(book, k),
                    },
                    [
                        Part(PHRASES["puente"].format(titulo=prev.titulo.rstrip(".")), "plantilla+titulos"),
                        Part(prev_hilo, f"leccion_anterior.{prev_origen}"),
                    ],
                )
            )

    # 3 · La idea: una sola frase, grande.
    # Si la lección no tiene idea redactada, el hilo es su primera frase: se rotula como lo que es.
    es_arranque = hilo_origen in ("cuerpo", "titulo")
    idea_parts = [Part(hilo, f"leccion.{hilo_origen}")]
    if clase:
        idea_parts.insert(0, _fixed("arranque" if es_arranque else "idea"))
    scenes.append(
        Scene(
            "idea",
            "Idea",
            {
                "kicker": ("EL PUNTO DE PARTIDA" if es_arranque else "LA IDEA") if (clase or q) else f"LECCIÓN {k} DE {n}",
                "text": thread_anchor(hilo),
                "title": "" if (clase or q) else lesson.titulo,
            },
            idea_parts,
            pause_after_s=0.6,
        )
    )

    # 4 · Desarrollo.
    if hilo_origen == "cuerpo" and bloques:
        # La idea ya era la primera frase del cuerpo: no se repite al empezar el desarrollo.
        resto = " ".join(T.split_sentences(bloques[0])[1:])
        if resto and len(bloques) > 1 and T.n_words(resto) < 30 and T.n_words(resto) + T.n_words(bloques[1]) <= 115:
            bloques = [f"{resto} {bloques[1]}"] + bloques[2:]  # un resto muy corto se une al bloque siguiente
        else:
            bloques = ([resto] if resto else []) + bloques[1:]
    if clase:
        rotulos = [step_label(b) for b in bloques]
        for i, bloque in enumerate(bloques):
            scenes.append(
                _text_scene("Desarrollo", "DESARROLLO", "a", None, bloque, "leccion.cuerpo", hints, (i + 1, len(bloques)), visible, rotulos[:i])
            )
    else:
        elegidos: list[str] = []
        for bloque in bloques:
            frases = T.split_sentences(bloque)
            if frases and _is_self_contained(frases[0]) and T.n_words(frases[0]) <= 45:
                elegidos.append(frases[0])
            if len(elegidos) == 3:
                break
        if not elegidos and bloques:
            elegidos = [T.split_sentences(bloques[0])[0]]
        rotulos = [step_label(f) for f in elegidos]
        for i, frase in enumerate(elegidos):
            scenes.append(
                _text_scene("Desarrollo", "DESARROLLO", "a", None, frase, "leccion.cuerpo", hints, (i + 1, len(elegidos)), visible, rotulos[:i])
            )

    # 5 · Esquema: la síntesis visual verificada de la lección.
    scenes.extend(_diagram_scenes(lesson, "Esquema", limit=2 if clase else 1))

    # 6 · Matiz: dónde falla o qué se le discute a la idea.
    matiz = T.take_sentences(lesson.autocorreccion, 90 if clase else 32)
    if matiz:
        scenes.append(_text_scene("Matiz", "EL MATIZ", "mal", _fixed("matiz"), matiz, "leccion.autocorreccion", hints, None, visible))

    # 7 · Práctica: transferencia.
    practica = T.take_sentences(lesson.aplicacion_practica, 90 if clase else 34)
    if practica:
        scenes.append(
            _text_scene("Práctica", "LLÉVALO A LA PRÁCTICA", "ok", _fixed("practica"), practica, "leccion.aplicacion_practica", hints, None, visible)
        )

    # 8 · Repaso: una pregunta de la propia lección.
    #     Es la misma del gancho: el episodio cierra lo que abrió.
    if q and clase:
        scenes.extend(_quiz_scenes(q, "Repaso", _fixed("pregunta_vuelve")))
    elif q:
        scenes.append(_short_answer_scene(q))

    # 9 · Cierre: la misma idea del principio y hacia dónde sigue el libro.
    es_ultima = index == n - 1
    cierre_view: dict[str, Any] = {
        "kicker": "QUÉDATE CON ESTO",
        "text": thread_anchor(hilo),
        "final": es_ultima,
        "book": book.titulo,
        "author": book.autor,
        "counter": f"Lección {k} de {n}",
        "related": lesson.autores_relacionados[:4],
    }
    cierre_parts: list[Part] = []
    if clase:
        cierre_parts = [_fixed("cierre"), Part(hilo, f"leccion.{hilo_origen}")]
    if es_ultima:
        cierre_parts.append(Part(PHRASES["ultima"].format(libro=book.titulo), "plantilla+titulos"))
    else:
        sig = book.lessons[index + 1]
        cierre_view.update({"next_number": k + 1, "next_title": sig.titulo})
        cierre_parts.append(Part(PHRASES["siguiente"].format(titulo=sig.titulo.rstrip(".")), "plantilla+titulos"))
    scenes.append(Scene("cierre", "", cierre_view, cierre_parts, pause_after_s=1.2))

    if not clase:
        _fit_short(scenes)

    orden = ["Idea", "Desarrollo", "Esquema", "Matiz", "Práctica", "Repaso", "Respuesta"]
    presentes = {s.section for s in scenes}
    return _base_episode(
        book,
        key=f"{k:02d}-{T.slugify(lesson.titulo, 48)}",
        kind="leccion",
        format=fmt,
        title=lesson.titulo,
        number=k,
        lesson_id=lesson.id,
        sections=[s for s in orden if s in presentes],
        scenes=scenes,
        summary=hilo,
    )


def _map_scenes(book: Book, section: str, intro: Part, narrate_nodes: bool) -> list[Scene]:
    mapa = book.mapa or {}
    nodos = [n for n in (mapa.get("nodos") or []) if isinstance(n, dict) and T.clean(n.get("etiqueta"))]
    if len(nodos) < 3:
        return []
    cierre = T.clean(mapa.get("cierre"))
    base = {"kicker": "EL MAPA DEL LIBRO", "nodes": nodos, "shown": 0, "active": -1, "cierre": cierre, "show_cierre": False}
    scenes: list[Scene] = []
    if narrate_nodes:
        for i, nodo in enumerate(nodos):
            etiqueta = T.clean(nodo.get("etiqueta")).rstrip(".")
            texto = T.clean(nodo.get("texto")).rstrip(".")
            parts = [intro] if i == 0 else []
            parts.append(Part(f"{etiqueta}." + (f" {texto}." if texto else ""), "mapa.nodos"))
            scenes.append(Scene("mapa", section, dict(base, shown=i + 1, active=i), parts, pause_after_s=0.25))
    if cierre:
        parts = [intro] if not narrate_nodes else [_fixed("mapa_cierre")]
        parts.append(Part(cierre if cierre.endswith((".", "!", "?", "…")) else cierre + ".", "mapa.cierre"))
        scenes.append(Scene("mapa", section, dict(base, shown=len(nodos), show_cierre=True), parts, pause_after_s=1.4))
    elif not narrate_nodes:
        scenes.append(Scene("mapa", section, dict(base, shown=len(nodos)), [intro], hold_s=0.0, pause_after_s=3.0))
    return scenes


def presentation_episode(book: Book, cover_path: str | None = None) -> Episode:
    """Episodio 0: qué libro es, sus ideas centrales (mapa) y el recorrido por lecciones."""
    n = len(book.lessons)
    titulos = [l.titulo for l in book.lessons]
    scenes: list[Scene] = []

    parts = [Part(PHRASES["libro" if book.autor else "libro_sin_autor"].format(libro=book.titulo, autor=book.autor), "plantilla+titulos")]
    descripcion = T.take_sentences(book.descripcion, 70)
    if descripcion:
        parts.append(Part(descripcion, "libro.descripcion"))
    scenes.append(
        Scene(
            "libro",
            "El libro",
            {
                "eje": book.eje,
                "sub_eje": book.sub_eje,
                "title": book.titulo,
                "author": book.autor,
                "description": T.anchor_clause(T.take_sentences(descripcion, 1), 24) if descripcion else "",
                "cover": cover_path,
                "n_lessons": n,
            },
            parts,
            pause_after_s=0.6,
        )
    )

    scenes.extend(_map_scenes(book, "Ideas", _fixed("mapa_intro"), narrate_nodes=True))

    # Recorrido: los títulos aparecen uno a uno. Con muchas lecciones se enseñan pero no se leen todos.
    base = {"kicker": "EL RECORRIDO", "items": titulos, "shown": 0, "active": -1}
    if n <= 8:
        for i, titulo in enumerate(titulos):
            parts = [_fixed("ruta", n=n)] if i == 0 else []
            parts.append(Part(PHRASES["ruta_item"].format(k=i + 1, titulo=titulo.rstrip(".")), "plantilla+titulos"))
            scenes.append(Scene("ruta", "Recorrido", dict(base, shown=i + 1, active=i), parts, pause_after_s=0.2))
    else:
        parts = [
            _fixed("ruta", n=n),
            Part(PHRASES["ruta_larga"].format(primera=titulos[0].rstrip("."), ultima=titulos[-1].rstrip(".")), "plantilla+titulos"),
        ]
        palabras = T.n_words(" ".join(p.text for p in parts))
        beats = [Beat({"shown": i + 1}, at_word=min(palabras - 1, int(i * palabras / n))) for i in range(n)]
        scenes.append(Scene("ruta", "Recorrido", dict(base), parts, beats, pause_after_s=2.5))

    scenes.append(
        Scene(
            "cierre",
            "",
            {
                "kicker": "EMPEZAMOS",
                "text": "",
                "final": False,
                "book": book.titulo,
                "author": book.autor,
                "counter": f"{n} lecciones",
                "related": [],
                "next_number": 1,
                "next_title": titulos[0],
            },
            [Part(PHRASES["empezamos"].format(titulo=titulos[0].rstrip(".")), "plantilla+titulos")],
            pause_after_s=1.2,
        )
    )
    presentes = {s.section for s in scenes}
    return _base_episode(
        book,
        key="00-presentacion",
        kind="presentacion",
        format="clase",
        title=f"{book.titulo} — presentación",
        number=0,
        sections=[s for s in ["El libro", "Ideas", "Recorrido"] if s in presentes],
        scenes=scenes,
        summary=book.descripcion,
    )


def _recap_questions(book: Book, limit: int = 3) -> list[Question]:
    """Hasta tres preguntas del libro repartidas por él (principio, mitad y final)."""
    pool: list[Question] = []
    for lec in book.lessons:
        q = lec.pick_question()
        if q:
            pool.append(q)
    if len(pool) < limit:
        vistos = {q.id for q in pool}
        sueltas = sorted((q for q in book.loose_questions if q.valid and q.id not in vistos), key=lambda q: (q.dificultad, q.id))
        pool.extend(sueltas[: limit - len(pool)])
    if len(pool) <= limit:
        return pool
    paso = (len(pool) - 1) / (limit - 1)
    return [pool[round(i * paso)] for i in range(limit)]


def recap_episode(book: Book) -> Episode:
    """Episodio final: la idea de cada lección (las mismas frases de la serie), el mapa y tres preguntas."""
    n = len(book.lessons)
    scenes: list[Scene] = []
    scenes.append(
        Scene(
            "portada",
            "",
            {
                "kicker": "REPASO DEL LIBRO",
                "title": book.titulo,
                "book": f"{n} lecciones",
                "author": book.autor,
                "eje": book.eje,
                "route": {"n": n, "current": n + 1},
            },
            [Part(PHRASES["repaso" if book.autor else "repaso_sin_autor"].format(libro=book.titulo, autor=book.autor, n=n), "plantilla+titulos")],
        )
    )
    for i, lec in enumerate(book.lessons):
        hilo, origen = lec.thread()
        scenes.append(
            Scene(
                "puente",
                "Lecciones",
                {"kicker": f"LECCIÓN {i + 1} DE {n}", "number": i + 1, "title": lec.titulo, "text": thread_anchor(hilo), "route": {"n": n, "current": i + 1}},
                [
                    Part(PHRASES["repaso_idea"].format(k=i + 1, titulo=lec.titulo.rstrip(".")), "plantilla+titulos"),
                    Part(hilo, f"leccion[{i + 1}].{origen}"),
                ],
                pause_after_s=0.5,
            )
        )
    scenes.extend(_map_scenes(book, "Mapa", _fixed("repaso_mapa"), narrate_nodes=False))
    for j, q in enumerate(_recap_questions(book)):
        scenes.extend(_quiz_scenes(q, "Comprueba", _fixed("repaso_preguntas") if j == 0 else None))
    scenes.append(
        Scene(
            "cierre",
            "",
            {
                "kicker": "LIBRO COMPLETADO",
                "text": T.clean((book.mapa or {}).get("cierre")),
                "final": True,
                "book": book.titulo,
                "author": book.autor,
                "counter": f"{n} lecciones",
                "related": [],
            },
            [Part(PHRASES["repaso_cierre"].format(libro=book.titulo), "plantilla+titulos")],
            pause_after_s=1.5,
        )
    )
    presentes = {s.section for s in scenes}
    return _base_episode(
        book,
        key="99-repaso",
        kind="repaso",
        format="clase",
        title=f"{book.titulo} — repaso",
        number=0,
        sections=[s for s in ["Lecciones", "Mapa", "Comprueba"] if s in presentes],
        scenes=scenes,
        summary=T.clean((book.mapa or {}).get("cierre")) or book.descripcion,
    )


def book_series(book: Book, fmt: str = "clase", with_quiz: bool = True, cover_path: str | None = None) -> list[Episode]:
    """La serie completa del libro: presentación, una lección por episodio y repaso final."""
    episodes = [presentation_episode(book, cover_path)]
    episodes.extend(lesson_episode(book, i, fmt, with_quiz) for i in range(len(book.lessons)))
    episodes.append(recap_episode(book))
    return episodes


# ───────────────────────── exportación ─────────────────────────

def export_script_markdown(episode: Episode, out_path: Path) -> Path:
    """Guion legible para revisar antes de renderizar: qué se oye, qué se ve y de dónde sale cada tramo."""
    lines = [
        f"# Guion · {episode.title}",
        "",
        f"- **Libro:** {episode.book_title}" + (f" — {episode.book_author}" if episode.book_author else ""),
        f"- **Episodio:** {episode.counter.capitalize()} · formato «{episode.format}»",
        f"- **Índice de la clase:** {' → '.join(episode.sections) or '—'}",
        f"- **Palabras:** {episode.total_words} · **duración estimada:** ~{episode.estimated_seconds / 60:.1f} min",
        f"- **Texto en pantalla:** como mucho {max((s.screen_words for s in episode.scenes if s.kind != 'pregunta'), default=0)} palabras a la vez (sin contar las preguntas con opciones)",
        "",
        "---",
        "",
    ]
    for i, s in enumerate(episode.scenes, start=1):
        titulo = s.section or s.kind
        lines.append(f"## {i}. {titulo} · `{s.kind}` (~{s.estimated_seconds:.0f} s)")
        lines.append("")
        en_pantalla = s.view.get("text") or s.view.get("title") or s.view.get("question") or ""
        if s.kind == "esquema":
            spec = s.view.get("spec") or {}
            en_pantalla = f"Esquema «{spec.get('titulo', '')}» (plantilla {spec.get('plantilla', '?')})"
        elif s.kind == "mapa":
            en_pantalla = "Mapa del libro: " + " · ".join(T.clean(nd.get("etiqueta")) for nd in s.view.get("nodes", [])[: s.view.get("shown", 0)])
        elif s.kind == "ruta":
            en_pantalla = "Recorrido del libro"
        if en_pantalla:
            lines.append(f"**En pantalla:** {en_pantalla}")
        if s.view.get("answer"):
            lines.append(f"**Respuesta en pantalla:** {s.view['answer']}")
        if s.view.get("trail"):
            lines.append(f"**Pasos ya dados (en pequeño):** {' → '.join(s.view['trail'])}")
        if s.view.get("chips"):
            lines.append(f"**Términos que se señalan:** {' · '.join(s.view['chips'])}")
        if s.kind == "pregunta" and not s.narration:
            lines.append(f"*Silencio de {s.hold_s:.0f} s para pensar la respuesta (cuenta atrás).*")
        if s.parts:
            lines.append("")
            for p in s.parts:
                lines.append(f"> {p.text}  \n> <sub>{p.origin}</sub>")
        lines.append("")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
