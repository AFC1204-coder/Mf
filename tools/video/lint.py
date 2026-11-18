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
            src["esquema.pie"] = " ¶ ".join(T.clean(d.get("pie")) for d in lec.diagramas if isinstance(d, dict))
    return src


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
