"""Control de calidad del guion antes de renderizar. Un episodio con errores no se renderiza.

Lo importante es la fidelidad: cada tramo de locución que dice venir del corpus tiene que estar,
literal, en el campo del que dice venir. Así un cambio futuro del guionista no puede colar texto
que no esté en la biblioteca.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import text as T
from .corpus import Book
from .frames import _STAGES
from .scriptwriter import Episode

REPO_ROOT = Path(__file__).resolve().parents[2]

# Duración razonable de cada tipo de episodio (segundos estimados).
LIMITES = {"clase": (75, 600), "corto": (40, 115), "presentacion": (25, 300), "repaso": (45, 900)}


@dataclass
class Issue:
    level: str  # "error" | "aviso"
    where: str
    message: str

    def __str__(self) -> str:
        return f"[{self.level}] {self.where}: {self.message}"


# Escenas cuyo contenido es una frase ancla (no una lista ni una pregunta con opciones).
SOLO_ANCLA = ("idea", "puente", "texto", "cierre", "gancho", "libro")
MAX_PALABRAS_EN_PANTALLA = 32


def _sources(book: Book, episode: Episode) -> dict[str, str]:
    """Texto de referencia de cada origen que puede declarar un tramo de locución."""
    src: dict[str, str] = {"libro.descripcion": book.descripcion}
    mapa = book.mapa or {}
    src["mapa.cierre"] = T.clean(mapa.get("cierre"))
    src["mapa.nodos"] = " ".join(f"{T.clean(n.get('etiqueta'))}. {T.clean(n.get('texto'))}." for n in (mapa.get("nodos") or []) if isinstance(n, dict))
    preguntas = [q for lec in book.lessons for q in lec.preguntas] + list(book.loose_questions)
    src["pregunta.texto"] = " ¶ ".join(q.texto for q in preguntas)
    src["pregunta.opcion"] = " ¶ ".join(o for q in preguntas for o in q.opciones)
    src["pregunta.explicacion"] = " ¶ ".join(q.explicacion for q in preguntas)

    def campos(prefijo: str, lec) -> None:
        for campo in ("cuerpo", "idea_clave", "cita_memorable", "autocorreccion", "aplicacion_practica", "titulo"):
            src[f"{prefijo}.{campo}"] = T.clean(getattr(lec, campo))

    for i, lec in enumerate(book.lessons):
        campos(f"leccion[{i + 1}]", lec)
        if lec.id == episode.lesson_id:
            campos("leccion", lec)
            if i > 0:
                campos("leccion_anterior", book.lessons[i - 1])
            src["esquema.datos"] = " ¶ ".join(_strings([d.get("datos") for d in lec.diagramas if isinstance(d, dict)]))
            src["esquema.pie"] = " ¶ ".join(T.clean(d.get("pie")) for d in lec.diagramas if isinstance(d, dict))
            src["esquema.titulo"] = " ¶ ".join(T.clean(d.get("titulo")) for d in lec.diagramas if isinstance(d, dict))
    return src


def _strings(o) -> list[str]:
    """Todos los textos de un esquema (rótulos), en orden."""
    if isinstance(o, str):
        return [T.clean(o)]
    if isinstance(o, dict):
        return [x for v in o.values() for x in _strings(v)]
    if isinstance(o, list):
        return [x for v in o for x in _strings(v)]
    return []


def _contained(part: str, source: str) -> bool:
    a = " ".join(part.split())
    b = " ".join(source.split())
    return bool(a) and (a in b or a.rstrip(".") in b)


def _check_diagrams(specs: list[dict]) -> list[bool] | None:
    """¿Sabe dibujar el motor de la app cada esquema? Usa Node si está; si no, devuelve None (sin comprobar)."""
    node = shutil.which("node")
    if not node or not specs:
        return None
    script = (
        "const D=require(process.argv[1]);let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(s).map(x=>!!D.svg(x))))})"
    )
    try:
        res = subprocess.run(
            [node, "-e", script, str(REPO_ROOT / "lib" / "diagram.js")],
            input=json.dumps(specs),
            capture_output=True,
            text=True,
            timeout=30,
        )
        return list(json.loads(res.stdout)) if res.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def lint_episode(episode: Episode, book: Book) -> list[Issue]:
    issues: list[Issue] = []
    src = _sources(book, episode)

    if not episode.scenes:
        return [Issue("error", episode.key, "el episodio no tiene escenas")]

    specs: list[dict] = []
    donde_spec: list[str] = []
    for i, scene in enumerate(episode.scenes, start=1):
        donde = f"{episode.key} · escena {i} ({scene.kind})"
        if scene.kind not in _STAGES:
            issues.append(Issue("error", donde, "plantilla visual desconocida"))
        if not scene.narration and scene.hold_s <= 0 and scene.pause_after_s <= 0:
            issues.append(Issue("error", donde, "escena sin voz ni duración"))
        for part in scene.parts:
            if not part.text.strip():
                issues.append(Issue("error", donde, "tramo de locución vacío"))
                continue
            if part.origin.startswith("plantilla"):
                continue
            ref = src.get(part.origin)
            if ref is None:
                issues.append(Issue("error", donde, f"origen desconocido: {part.origin}"))
            elif not _contained(part.text, ref):
                issues.append(Issue("error", donde, f"la locución no es literal de «{part.origin}»: {part.text[:70]!r}"))
            for frase in T.split_sentences(part.text):
                if T.n_words(frase) > 70:
                    issues.append(Issue("aviso", donde, f"frase de {T.n_words(frase)} palabras: difícil de seguir de oído"))
        if scene.kind == "pregunta":
            opts = scene.view.get("options") or []
            if len(opts) < 2 or not (0 <= int(scene.view.get("correct", -1)) < len(opts)):
                issues.append(Issue("error", donde, "pregunta sin opciones válidas o sin respuesta correcta"))
        if scene.kind == "esquema":
            specs.append(scene.view.get("spec") or {})
            donde_spec.append(donde)
        if scene.kind == "gancho" and not str(scene.view.get("question") or "").strip():
            issues.append(Issue("error", donde, "gancho sin pregunta"))
        if scene.kind in SOLO_ANCLA and scene.screen_words > MAX_PALABRAS_EN_PANTALLA:
            issues.append(
                Issue("aviso", donde, f"{scene.screen_words} palabras en pantalla (máximo orientativo {MAX_PALABRAS_EN_PANTALLA}): el texto largo debe oírse, no leerse")
            )
        if scene.kind in ("idea", "puente", "texto") and not str(scene.view.get("text") or "").strip():
            issues.append(Issue("error", donde, "no hay texto que mostrar"))
        for beat in scene.beats:
            if beat.at_word is None and beat.at_s is None:
                issues.append(Issue("error", donde, "cambio en pantalla sin momento asignado"))

    dibujables = _check_diagrams(specs)
    if dibujables is not None:
        for ok, donde in zip(dibujables, donde_spec):
            if not ok:
                issues.append(Issue("error", donde, "el motor de esquemas no sabe dibujar esta figura"))

    clave = episode.format if episode.kind == "leccion" else episode.kind
    minimo, maximo = LIMITES.get(clave, (0, 10**6))
    est = episode.estimated_seconds
    if est < minimo:
        issues.append(Issue("aviso", episode.key, f"dura ~{est:.0f} s: corto para un episodio «{clave}» (mínimo orientativo {minimo} s)"))
    if est > maximo:
        issues.append(Issue("aviso", episode.key, f"dura ~{est:.0f} s: largo para un episodio «{clave}» (máximo orientativo {maximo} s)"))
    if episode.kind == "leccion" and "Esquema" not in episode.sections:
        issues.append(Issue("aviso", episode.key, "la lección no tiene esquema en datos/diagramas.json: el vídeo va sin figura"))
    return issues


def has_errors(issues: list[Issue]) -> bool:
    return any(i.level == "error" for i in issues)


# ───────────────────────── piezas compartibles ─────────────────────────

def _formulas_permitidas(pieza, book: Book) -> set[str]:
    """Las únicas frases que una pieza puede decir sin que estén en el corpus: `compartir.FORMULAS` con los datos del libro."""
    from . import compartir as K

    titulos = {""}
    for lec in book.lessons:
        if lec.id == pieza.lesson_id:
            titulos |= {T.clean(d.get("titulo")).rstrip(".") for d in lec.diagramas if isinstance(d, dict)}
    nodos = len([n for n in ((book.mapa or {}).get("nodos") or []) if isinstance(n, dict) and T.clean(n.get("etiqueta"))])
    permitidas: set[str] = set()
    for plantilla in K.FORMULAS.values():
        for titulo in titulos:
            permitidas.add(plantilla.format(libro=K.titulo_corto(book.titulo), autor=book.autor, n=nodos, titulo=titulo))
    return permitidas


def lint_pieza(pieza, book: Book) -> list[Issue]:
    """Control de una pieza compartible: fidelidad literal, fórmulas declaradas, nada que ancle a la web y texto breve."""
    from . import compartir as K
    from . import compartir_frames as CF

    issues: list[Issue] = []
    if not pieza.scenes:
        return [Issue("error", pieza.key, "la pieza no tiene escenas")]
    src = _sources(book, pieza)
    permitidas = _formulas_permitidas(pieza, book)
    specs: list[dict] = []
    donde_spec: list[str] = []
    con_figura = False
    for i, scene in enumerate(pieza.scenes, start=1):
        donde = f"{pieza.key} · escena {i} ({scene.kind})"
        if scene.kind not in CF.STAGES:
            issues.append(Issue("error", donde, "plantilla visual desconocida"))
            continue
        if not scene.narration and scene.hold_s <= 0:
            issues.append(Issue("error", donde, "escena sin voz ni duración"))
        for part in scene.parts:
            if not part.text.strip():
                issues.append(Issue("error", donde, "tramo de locución vacío"))
                continue
            if part.origin.startswith("plantilla"):
                if part.text not in permitidas:
                    issues.append(Issue("error", donde, f"fórmula no declarada en compartir.FORMULAS: {part.text[:70]!r}"))
                elif K.ANCLA_WEB.search(part.text):
                    # La fórmula es de las declaradas: lo que alude a «la lección» es el título del esquema que lleva dentro.
                    issues.append(Issue("aviso", donde, f"el texto del corpus alude a la lección o a la web: {part.text[:60]!r}"))
                continue
            ref = src.get(part.origin)
            if ref is None:
                issues.append(Issue("error", donde, f"origen desconocido: {part.origin}"))
            elif not _contained(part.text, ref):
                issues.append(Issue("error", donde, f"la locución no es literal de «{part.origin}»: {part.text[:70]!r}"))
            if K.ANCLA_WEB.search(part.text):
                issues.append(Issue("aviso", donde, f"el texto del corpus alude a la lección o a la web: {part.text[:60]!r}"))
            if K.parece_ingles(part.text):
                issues.append(Issue("aviso", donde, f"tramo que parece estar en otro idioma: {part.text[:60]!r}"))
            for frase in T.split_sentences(part.text):
                if T.n_words(frase) > 60:
                    issues.append(Issue("aviso", donde, f"frase de {T.n_words(frase)} palabras: difícil de seguir en una pieza corta"))
        # Todo lo que se oye se ve: en el texto cinético, las palabras en pantalla son las de la locución.
        if scene.kind == "c-frase":
            dichas = scene.narration.split()
            vistas = scene.view.get("words") or []
            if vistas != dichas[len(dichas) - len(vistas):] or not vistas:
                issues.append(Issue("error", donde, "el texto en pantalla no coincide con la locución"))
        for vista in CF.estados(scene):
            n = CF.palabras_en_pantalla(scene.kind, vista)
            if n > MAX_PALABRAS_EN_PANTALLA:
                issues.append(Issue("aviso", donde, f"{n} palabras en pantalla a la vez (máximo orientativo {MAX_PALABRAS_EN_PANTALLA})"))
                break
        if scene.kind == "c-figura" and scene.view.get("patron") == "silueta":
            specs.append(scene.view.get("spec") or {})
            donde_spec.append(donde)
        if scene.kind == "c-figura":
            con_figura = True
        # Lo que el cierre deja escrito para llevarse es un arranque literal de algo que la pieza ya dijo.
        recuerda = str(scene.view.get("recuerda") or "").rstrip("…").strip() if scene.kind == "c-cierre" else ""
        if recuerda and not any(_contained(recuerda, ref) for ref in src.values() if ref):
            issues.append(Issue("error", donde, f"el mensaje de cierre no es literal del corpus: {recuerda[:60]!r}"))
        for beat in scene.beats:
            if beat.at_word is None and beat.at_s is None:
                issues.append(Issue("error", donde, "cambio en pantalla sin momento asignado"))

    for rotulo in [*K.ROTULOS.values(), *K.FORMULAS.values()]:
        if K.ANCLA_WEB.search(rotulo):
            issues.append(Issue("error", pieza.key, f"rótulo o fórmula que ancla a la web: {rotulo!r}"))
    # Toda pieza de una lección lleva su matiz (si la lección lo tiene) y todas dicen de qué libro salen.
    if not any(s.kind == "c-credito" for s in pieza.scenes):
        issues.append(Issue("error", pieza.key, "la pieza no dice de qué libro sale"))
    if pieza.lesson_id:
        lec = next((l for l in book.lessons if l.id == pieza.lesson_id), None)
        if lec and T.clean(lec.autocorreccion) and not any(p.origin == "leccion.autocorreccion" for s in pieza.scenes for p in s.parts):
            issues.append(Issue("error", pieza.key, "la lección tiene matiz y la pieza no lo lleva"))
        if pieza.tipo == "idea" and not con_figura:
            issues.append(Issue("aviso", pieza.key, "la figura de la lección no se puede recorrer por piezas: la pieza va sin esquema"))
    if not T.clean(pieza.gancho):
        issues.append(Issue("error", pieza.key, "pieza sin gancho"))

    dibujables = _check_diagrams(specs[:1])
    if dibujables is not None and specs and not dibujables[0]:
        issues.append(Issue("error", donde_spec[0], "el motor de esquemas no sabe dibujar esta figura"))

    minimo, maximo = K.LIMITES.get(pieza.tipo, (0, 10**6))
    est = pieza.estimated_seconds
    if est < minimo:
        issues.append(Issue("aviso", pieza.key, f"dura ~{est:.0f} s: corta para una pieza «{pieza.tipo}» (mínimo orientativo {minimo} s)"))
    if est > maximo:
        issues.append(Issue("aviso", pieza.key, f"dura ~{est:.0f} s: larga para una pieza «{pieza.tipo}» (máximo orientativo {maximo} s)"))
    return issues
