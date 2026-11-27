"""Lectura del corpus de Mente Fría: un libro con sus lecciones, preguntas, esquemas y mapa.

Solo lee. Usa la clave anónima pública de la app (la misma de `app.js`), que únicamente permite
lo que permiten las políticas RLS; se puede sustituir con SUPABASE_URL y SUPABASE_ANON_KEY.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

from . import text as T

REPO_ROOT = Path(__file__).resolve().parents[2]
DIAGRAMAS_PATH = REPO_ROOT / "datos" / "diagramas.json"
MAPAS_PATH = REPO_ROOT / "datos" / "mapas.json"

SB_URL_DEFAULT = "https://aduizdiiacrvpoavjmab.supabase.co"
# Clave anónima pública de la app (la misma que va en app.js); solo permite lo que permite RLS.
SB_ANON_DEFAULT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWl6ZGlpYWNydnBvYXZqbWFiIiwicm9sZSI6"
    "ImFub24iLCJpYXQiOjE3NzE1OTg5MDEsImV4cCI6MjA4NzE3NDkwMX0.US2sEhlSBJbcwg93txuL-9AdPKo2LLmdVX5dur7i5GQ"
)

UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


@dataclass
class Question:
    id: str
    texto: str
    opciones: list[str]
    correcta: int
    explicacion: str
    dificultad: int = 2

    @property
    def valid(self) -> bool:
        return bool(self.texto) and len(self.opciones) >= 2 and 0 <= self.correcta < len(self.opciones)


@dataclass
class Lesson:
    id: str
    titulo: str
    orden: int
    cuerpo: str
    idea_clave: str = ""
    cita_memorable: str = ""
    autocorreccion: str = ""
    aplicacion_practica: str = ""
    conexion_cruzada: str = ""
    autores_relacionados: list[str] = field(default_factory=list)
    etiquetas: list[str] = field(default_factory=list)
    # Apartados de ampliación que algunas lecciones traen: [{"titulo", "cuerpo"}], en su orden.
    detalles: list[dict[str, str]] = field(default_factory=list)
    diagramas: list[dict[str, Any]] = field(default_factory=list)
    preguntas: list[Question] = field(default_factory=list)

    def thread(self) -> tuple[str, str]:
        """La idea de la lección en una frase y su procedencia.

        Es el «hilo» de la serie: la misma frase abre la lección, la cierra, enlaza con la siguiente
        y vuelve en el repaso del libro. Sale siempre del corpus, nunca se redacta:
        idea clave → idea redactada por la app (`cita_memorable`) → primera frase del cuerpo.
        """
        if T.clean(self.idea_clave):
            return T.clean(self.idea_clave), "idea_clave"
        if T.clean(self.cita_memorable):
            return T.clean(self.cita_memorable), "cita_memorable"
        frases = T.split_sentences(self.cuerpo.split("\n\n")[0] if self.cuerpo else "")
        return (frases[0] if frases else T.clean(self.titulo)), ("cuerpo" if frases else "titulo")

    def main_diagrams(self) -> list[dict[str, Any]]:
        """Primero el esquema principal y después las figuras marcadas como adicionales."""
        ok = [d for d in self.diagramas if isinstance(d, dict) and d.get("tipo") == "diagrama" and d.get("datos")]
        return [d for d in ok if not d.get("adicional")] + [d for d in ok if d.get("adicional")]

    def pick_question(self) -> Question | None:
        """La pregunta de repaso: la más asequible de las de la lección (comprobar, no examinar)."""
        validas = [q for q in self.preguntas if q.valid]
        if not validas:
            return None
        return sorted(validas, key=lambda q: (q.dificultad, len(q.texto), q.id))[0]


@dataclass
class Book:
    id: str
    titulo: str
    autor: str
    eje: str
    sub_eje: str = ""
    descripcion: str = ""
    portada_url: str = ""
    lessons: list[Lesson] = field(default_factory=list)
    mapa: dict[str, Any] | None = None
    # Preguntas del libro que no están ligadas a una lección concreta: solo valen para el repaso final.
    loose_questions: list[Question] = field(default_factory=list)

    @property
    def slug(self) -> str:
        return T.slugify(self.titulo)


# ───────────────────────── construcción a partir de filas (pura, sin red) ─────────────────────────

def _detalles(v: Any) -> list[dict[str, str]]:
    """Los apartados de ampliación de una lección, solo los que traen título y cuerpo."""
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return []
    out = []
    for x in v if isinstance(v, list) else []:
        if isinstance(x, dict) and str(x.get("titulo") or "").strip() and str(x.get("cuerpo") or "").strip():
            out.append({"titulo": T.clean(x.get("titulo")), "cuerpo": str(x.get("cuerpo")).strip()})
    return out


def _as_list(v: Any) -> list[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return []


def book_from_rows(
    libro: dict[str, Any],
    lecciones: list[dict[str, Any]],
    preguntas: list[dict[str, Any]] | None = None,
    diagramas: dict[str, Any] | None = None,
    mapas: dict[str, Any] | None = None,
) -> Book:
    """Monta un `Book` desde filas de Supabase y los JSON de `datos/`. Ordena las lecciones por `orden`."""
    por_leccion: dict[str, list[Question]] = {}
    sueltas: list[Question] = []
    for p in preguntas or []:
        try:
            correcta = int(p.get("correcta"))
        except (TypeError, ValueError):
            continue
        q = Question(
            id=str(p.get("id") or ""),
            texto=T.clean(p.get("texto")),
            opciones=[T.clean(o) for o in (p.get("opciones") or [])],
            correcta=correcta,
            explicacion=T.clean(p.get("explicacion")),
            dificultad=int(p.get("dificultad") or 2),
        )
        if p.get("leccion_id"):
            por_leccion.setdefault(p["leccion_id"], []).append(q)
        elif q.valid:
            sueltas.append(q)

    filas = sorted(lecciones, key=lambda l: (l.get("orden") if l.get("orden") is not None else 9999, str(l.get("id"))))
    lessons: list[Lesson] = []
    for l in filas:
        specs = (diagramas or {}).get(l["id"], [])
        if isinstance(specs, dict):
            specs = [specs]
        lessons.append(
            Lesson(
                id=l["id"],
                titulo=T.clean(l.get("titulo")),
                orden=int(l.get("orden") or 0),
                cuerpo=str(l.get("cuerpo") or "").strip(),
                idea_clave=str(l.get("idea_clave") or "").strip(),
                cita_memorable=str(l.get("cita_memorable") or "").strip(),
                autocorreccion=str(l.get("autocorreccion") or "").strip(),
                aplicacion_practica=str(l.get("aplicacion_practica") or "").strip(),
                conexion_cruzada=str(l.get("conexion_cruzada") or "").strip(),
                autores_relacionados=_as_list(l.get("autores_relacionados")),
                etiquetas=_as_list(l.get("dominio_aplicacion")),
                detalles=_detalles(l.get("detalles")),
                diagramas=specs if isinstance(specs, list) else [],
                preguntas=por_leccion.get(l["id"], []),
            )
        )

    return Book(
        id=libro["id"],
        titulo=T.clean(libro.get("titulo")) or "Mente Fría",
        autor=T.clean(libro.get("autor")),
        eje=T.clean(libro.get("eje_principal") or libro.get("eje")) or "Biblioteca",
        sub_eje=T.clean(libro.get("sub_eje")),
        descripcion=T.clean(libro.get("descripcion_breve") or libro.get("descripcion")),
        portada_url=str(libro.get("portada_url") or libro.get("imagen_url") or "").strip(),
        lessons=lessons,
        mapa=(mapas or {}).get(libro["id"]),
        loose_questions=sueltas,
    )


# ───────────────────────── red ─────────────────────────

def _config() -> tuple[str, str]:
    url = (os.getenv("SUPABASE_URL") or SB_URL_DEFAULT).strip().rstrip("/")
    key = (os.getenv("SUPABASE_ANON_KEY") or SB_ANON_DEFAULT).strip()
    return url, key


def _sb_get(path: str) -> list[dict[str, Any]]:
    url, key = _config()
    resp = requests.get(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f"Error Supabase ({resp.status_code}): {resp.text[:300]}")
    return resp.json()


def _sb_get_all(path: str, page: int = 1000) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    sep = "&" if "?" in path else "?"
    while True:
        rows = _sb_get(f"{path}{sep}limit={page}&offset={len(out)}")
        out.extend(rows)
        if len(rows) < page:
            return out


def _load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _find_book_row(query: str) -> dict[str, Any]:
    q = query.strip()
    if not q:
        raise ValueError("Indica el título o el id de un libro.")
    if UUID_RE.match(q):
        rows = _sb_get(f"libros?id=eq.{q}&select=*&limit=1")
    else:
        rows = _sb_get(f"libros?titulo=eq.{quote(q, safe='')}&publico=eq.true&select=*&limit=1")
        if not rows:
            patron = quote(f"*{q}*", safe="")
            rows = _sb_get(f"libros?titulo=ilike.{patron}&publico=eq.true&select=*&order=titulo.asc&limit=6")
    if not rows:
        raise LookupError(f"No se encontró ningún libro público para: {query!r}")
    if len(rows) > 1:
        otros = ", ".join(repr(r["titulo"]) for r in rows[1:])
        print(f"[corpus] Varios libros coinciden con {query!r}; se usa {rows[0]['titulo']!r} (otros: {otros}).")
    return rows[0]


def load_book(query: str) -> Book:
    """Carga un libro completo (lecciones activas en orden, preguntas, esquemas y mapa) por título o id."""
    libro = _find_book_row(query)
    return load_book_by_row(libro)


def load_book_by_row(libro: dict[str, Any]) -> Book:
    lecciones = _sb_get_all(f"lecciones?libro_id=eq.{libro['id']}&activa=eq.true&select=*&order=orden.asc")
    if not lecciones:
        raise LookupError(f"El libro {libro.get('titulo')!r} no tiene lecciones activas.")
    preguntas = _sb_get_all(
        f"preguntas?libro_id=eq.{libro['id']}&activa=eq.true"
        "&select=id,leccion_id,texto,opciones,correcta,explicacion,dificultad"
    )
    return book_from_rows(libro, lecciones, preguntas, _load_json(DIAGRAMAS_PATH), _load_json(MAPAS_PATH))


def find_lesson(query: str) -> tuple[Book, int]:
    """Busca una lección por id o título y devuelve su libro completo y su posición (0…N-1) en él.

    Se carga el libro entero porque la lección se cuenta dentro de su serie: «lección 3 de 8»,
    de dónde viene y cuál es la siguiente.
    """
    q = query.strip()
    if not q:
        raise ValueError("Indica el título o el id de una lección.")
    if UUID_RE.match(q):
        rows = _sb_get(f"lecciones?id=eq.{q}&select=id,libro_id,titulo&limit=1")
    else:
        rows = _sb_get(f"lecciones?titulo=eq.{quote(q, safe='')}&activa=eq.true&select=id,libro_id,titulo&limit=1")
        if not rows:
            patron = quote(f"*{q}*", safe="")
            rows = _sb_get(
                f"lecciones?titulo=ilike.{patron}&activa=eq.true&select=id,libro_id,titulo&order=titulo.asc&limit=6"
            )
    if not rows:
        raise LookupError(f"No se encontró ninguna lección activa para: {query!r}")
    if len(rows) > 1:
        otros = ", ".join(repr(r["titulo"]) for r in rows[1:])
        print(f"[corpus] Varias lecciones coinciden con {query!r}; se usa {rows[0]['titulo']!r} (otras: {otros}).")
    book = load_book(rows[0]["libro_id"])
    for i, lec in enumerate(book.lessons):
        if lec.id == rows[0]["id"]:
            return book, i
    raise LookupError(f"La lección {rows[0]['titulo']!r} no está activa en su libro.")


def list_book_rows(eje: str | None = None) -> list[dict[str, Any]]:
    """Filas de todos los libros públicos (para recorrer la biblioteca), por eje y título."""
    rows = _sb_get_all("libros?publico=eq.true&select=*&order=eje_principal.asc,titulo.asc")
    if eje:
        clave = T.norm(eje)
        rows = [r for r in rows if clave in T.norm(str(r.get("eje_principal") or r.get("eje") or ""))]
    return rows
