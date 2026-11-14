"""Cliente de solo lectura para obtener una lección, su libro y sus diagramas desde Supabase."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DIAGRAMAS_PATH = REPO_ROOT / "datos" / "diagramas.json"


@dataclass
class LessonData:
    id: str
    titulo: str
    cuerpo: str
    idea_clave: str
    cita_memorable: str
    aplicacion_practica: str
    conexion_cruzada: str
    imagen_principal: str | None
    imagen_caption: str | None
    libro_titulo: str
    libro_autor: str
    eje: str
    infografia_url: str | None = None
    diagramas: list[dict[str, Any]] = field(default_factory=list)


def _supabase_config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env "
            "(consulta tools/video/.env.example)."
        )
    return url, key


def _sb_get(path: str) -> list[dict[str, Any]]:
    url, key = _supabase_config()
    resp = requests.get(
        f"{url}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        timeout=20,
    )
    if not resp.ok:
        raise RuntimeError(f"Error Supabase ({resp.status_code}): {resp.text[:300]}")
    return resp.json()


def _load_diagrams(lesson_id: str) -> list[dict[str, Any]]:
    if not DIAGRAMAS_PATH.exists():
        return []
    try:
        data = json.loads(DIAGRAMAS_PATH.read_text(encoding="utf-8"))
        items = data.get(lesson_id, [])
        return items if isinstance(items, list) else []
    except Exception:
        return []


def fetch_book(query: str) -> LessonData:
    """Busca un libro por UUID o título y sintetiza un LessonData resumen con sus lecciones."""
    q = query.strip()
    if not q:
        raise ValueError("Debes indicar el ID o el título de un libro.")

    if UUID_RE.match(q):
        libro_rows = _sb_get(f"libros?id=eq.{q}&select=*&limit=1")
    else:
        encoded = quote(q, safe="")
        libro_rows = _sb_get(f"libros?titulo=eq.{encoded}&select=*&limit=1")
        if not libro_rows:
            pattern = quote(f"*{q}*", safe="")
            libro_rows = _sb_get(f"libros?titulo=ilike.{pattern}&select=*&limit=5")

    if not libro_rows:
        raise LookupError(f"No se encontró ningún libro para: {query!r}")

    if len(libro_rows) > 1:
        print(f"[supabase] Varios libros para {query!r}; usando el primero: {libro_rows[0]['titulo']!r}")

    libro = libro_rows[0]
    lecciones = _sb_get(
        f"lecciones?libro_id=eq.{libro['id']}&activa=eq.true&select=*&order=orden.asc&limit=8"
    )
    if not lecciones:
        raise LookupError(f"El libro {libro.get('titulo')!r} no tiene lecciones activas.")

    cuerpo_parts: list[str] = []
    ideas: list[str] = []
    diagramas: list[dict[str, Any]] = []
    cita = ""
    aplicacion = ""
    conexion = ""
    img_url = None
    img_cap = None

    for lec in lecciones:
        t = (lec.get("titulo") or "").strip()
        ic = (lec.get("idea_clave") or "").strip()
        cb = (lec.get("cuerpo") or "").strip()
        if ic:
            ideas.append(ic)
        if t or ic or cb:
            snippet = cb[:420].rsplit(".", 1)[0] + "." if len(cb) > 420 and "." in cb[:420] else cb[:360]
            cuerpo_parts.append(f"{t}. {ic} {snippet}".strip())
        if not cita and (lec.get("cita_memorable") or "").strip():
            cita = lec["cita_memorable"].strip()
        if not aplicacion and (lec.get("aplicacion_practica") or "").strip():
            aplicacion = lec["aplicacion_practica"].strip()
        if not conexion and (lec.get("conexion_cruzada") or "").strip():
            conexion = lec["conexion_cruzada"].strip()
        if not img_url and lec.get("imagen_principal"):
            img_url = lec["imagen_principal"]
            img_cap = lec.get("imagen_caption")
        if len(diagramas) < 2:
            diagramas.extend(_load_diagrams(lec["id"]))

    infografia_url = None
    if libro.get("infografia_url") and libro.get("infografia_estado") == "aprobada":
        infografia_url = libro["infografia_url"]

    eje = (libro.get("eje_principal") or libro.get("eje") or "Mente Fría").strip()
    libro_titulo = (libro.get("titulo") or "Mente Fría").strip()

    return LessonData(
        id=libro["id"],
        titulo=libro_titulo,
        cuerpo="\n\n".join(cuerpo_parts[:5]),
        idea_clave=ideas[0] if ideas else (libro.get("descripcion") or libro_titulo).strip(),
        cita_memorable=cita,
        aplicacion_practica=aplicacion,
        conexion_cruzada=conexion,
        imagen_principal=img_url,
        imagen_caption=img_cap,
        libro_titulo=libro_titulo,
        libro_autor=(libro.get("autor") or "").strip(),
        eje=eje,
        infografia_url=infografia_url,
        diagramas=diagramas[:2],
    )


def fetch_lesson(query: str) -> LessonData:
    """Busca una lección por UUID o por título (exacto o parcial); si no existe, intenta por libro."""
    q = query.strip()
    if not q:
        raise ValueError("Debes indicar el ID o el título de una lección o libro.")

    if UUID_RE.match(q):
        rows = _sb_get(f"lecciones?id=eq.{q}&select=*&limit=1")
    else:
        encoded = quote(q, safe="")
        rows = _sb_get(f"lecciones?titulo=eq.{encoded}&activa=eq.true&select=*&limit=1")
        if not rows:
            pattern = quote(f"*{q}*", safe="")
            rows = _sb_get(
                f"lecciones?titulo=ilike.{pattern}&activa=eq.true&select=*&order=orden.asc&limit=5"
            )

    if not rows:
        try:
            return fetch_book(q)
        except LookupError:
            raise LookupError(f"No se encontró ninguna lección ni libro activo para: {query!r}")

    if len(rows) > 1:
        print(f"[supabase] Varias coincidencias para {query!r}; usando la primera: {rows[0]['titulo']!r}")

    lec = rows[0]
    libro_rows = _sb_get(f"libros?id=eq.{lec['libro_id']}&select=*&limit=1")
    libro = libro_rows[0] if libro_rows else {}

    infografia_url = None
    if libro.get("infografia_url") and libro.get("infografia_estado") == "aprobada":
        infografia_url = libro["infografia_url"]

    eje = (libro.get("eje_principal") or libro.get("eje") or "Mente Fría").strip()

    return LessonData(
        id=lec["id"],
        titulo=(lec.get("titulo") or "").strip(),
        cuerpo=(lec.get("cuerpo") or "").strip(),
        idea_clave=(lec.get("idea_clave") or "").strip(),
        cita_memorable=(lec.get("cita_memorable") or "").strip(),
        aplicacion_practica=(lec.get("aplicacion_practica") or "").strip(),
        conexion_cruzada=(lec.get("conexion_cruzada") or "").strip(),
        imagen_principal=lec.get("imagen_principal"),
        imagen_caption=lec.get("imagen_caption"),
        libro_titulo=(libro.get("titulo") or "Mente Fría").strip(),
        libro_autor=(libro.get("autor") or "").strip(),
        eje=eje,
        infografia_url=infografia_url,
        diagramas=_load_diagrams(lec["id"]),
    )
