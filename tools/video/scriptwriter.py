"""Generador de guiones (5-7 escenas, 60-90 s) y exportador a Markdown."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import requests

from .supabase_client import LessonData

WORDS_PER_SECOND = 2.25  # ~135 palabras/min: ritmo cálido, pausado y claro


@dataclass
class Scene:
    index: int
    kind: str  # "gancho" | "idea" | "cierre"
    tag: str
    on_screen: str
    narration: str
    show_infographic: bool = False
    estimated_seconds: float = 12.0
    visual_prompt: str = ""


@dataclass
class VideoScript:
    lesson_id: str
    lesson_title: str
    book_title: str
    book_author: str
    eje: str
    scenes: list[Scene]

    @property
    def total_words(self) -> int:
        return sum(len(s.narration.split()) for s in self.scenes)

    @property
    def estimated_seconds(self) -> float:
        return round(sum(s.estimated_seconds for s in self.scenes), 1)

    def to_dict(self) -> dict[str, Any]:
        return {
            "lesson_id": self.lesson_id,
            "lesson_title": self.lesson_title,
            "book_title": self.book_title,
            "book_author": self.book_author,
            "eje": self.eje,
            "total_words": self.total_words,
            "estimated_seconds": self.estimated_seconds,
            "scenes": [asdict(s) for s in self.scenes],
        }


def _clean_text(raw: str) -> str:
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _split_sentences(text: str) -> list[str]:
    clean = _clean_text(text)
    if not clean:
        return []
    parts = re.split(r"(?<=[.!?])\s+", clean)
    return [p.strip() for p in parts if len(p.strip()) > 12]


def _clean_for_speech(text: str) -> str:
    """Limpia paréntesis técnicos y abreviaturas para que la locución y subtítulos suenen naturales."""
    t = _clean_text(text)
    t = re.sub(r"\(\s*ej\.?\s*:\s*([^)]+)\)", r", por ejemplo, \1", t, flags=re.IGNORECASE)
    t = re.sub(r"\([^)]{1,45}\)", "", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _fit_complete_phrase(text: str, max_words: int = 26) -> str:
    """Devuelve frases o cláusulas completas sin cortar nunca a mitad de una oración."""
    clean = _clean_for_speech(text)
    words = clean.split()
    if len(words) <= max_words:
        return clean

    # Intentar tomar oraciones completas que quepan en max_words
    sentences = _split_sentences(clean)
    chosen: list[str] = []
    count = 0
    for s in sentences:
        sw = len(s.split())
        if chosen and count + sw > max_words:
            break
        if sw <= max_words + 4:
            chosen.append(s)
            count += sw
        else:
            break
    if chosen:
        return " ".join(chosen)

    # Si una sola oración es muy larga, cortar en la última coma/punto y coma/guion antes de max_words
    prefix = " ".join(words[:max_words])
    m = re.search(r"^(.{25,}?)[,;—:]\s+[^,;—:]*$", prefix)
    if m:
        out = m.group(1).strip().rstrip(",;:")
    else:
        out = prefix.rstrip(",;:")
    if not out.endswith((".", "!", "?")):
        out += "."
    return out


def _short_headline(text: str, max_words: int = 7) -> str:
    clean = _clean_for_speech(text)
    first = _split_sentences(clean)[0] if _split_sentences(clean) else clean
    words = first.split()
    if len(words) <= max_words:
        return first.rstrip(".,;:")
    return " ".join(words[:max_words]).rstrip(".,;:") + "…"


def _truncate_words(text: str, max_words: int) -> str:
    return _fit_complete_phrase(text, max_words)


def _estimate_sec(narration: str) -> float:
    words = max(1, len(narration.split()))
    return round(words / WORDS_PER_SECOND + 0.8, 1)


def _has_visual(lesson: LessonData) -> bool:
    return bool(lesson.imagen_principal or lesson.diagramas or lesson.infografia_url)


def _build_gemini_script(lesson: LessonData, api_key: str) -> list[Scene] | None:
    has_vis = _has_visual(lesson)
    hook_source = lesson.cita_memorable or lesson.idea_clave or lesson.titulo
    prompt = f"""Eres guionista de vídeos cortos verticales (60-90 segundos) para «Mente Fría», en español de España.
Crea un guion de EXACTAMENTE 6 escenas basado en esta lección:

Título: {lesson.titulo}
Libro: {lesson.libro_titulo} — {lesson.libro_autor}
Eje: {lesson.eje}
Idea memorable / cita: {_clean_text(hook_source)}
Aplicación práctica: {_clean_text(lesson.aplicacion_practica)}
Texto completo: {_clean_text(lesson.cuerpo)[:3500]}
Tiene infografía/esquema: {"sí" if has_vis else "no"}

Reglas estrictas:
1. Escena 1 ("gancho"): abre con la idea memorable como gancho directo (sin "Hola chicos" ni "En este vídeo").
2. Escenas 2 a 5 ("idea"): desarrolla 4 ideas clave concretas de la lección, con tono cercano, claro, adulto, sin relleno ni clichés.
3. Escena 6 ("cierre"): cierra con una aplicación práctica concreta o una pregunta que haga pensar, mencionando brevemente el libro y autor.
4. Duración total: entre 145 y 190 palabras sumando todas las narraciones (~65-85 segundos a ritmo tranquilo). Cada narración entre 22 y 34 palabras.
5. "on_screen": texto grande para mostrar en pantalla (máximo 10 palabras, directo y legible).
6. Si tiene infografía ("sí"), marca "show_infographic": true en UNA sola escena central (escena 3 o 4) donde mejor encaje. Si no tiene, todas false.

Responde SOLO con un JSON válido con este formato:
{{
  "scenes": [
    {{
      "kind": "gancho",
      "tag": "LA IDEA",
      "on_screen": "...",
      "narration": "...",
      "show_infographic": false
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    try:
        resp = requests.post(
            url,
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.6},
            },
            timeout=30,
        )
        if not resp.ok:
            print(f"[scriptwriter] Gemini API ({resp.status_code}), usando generador local.")
            return None
        data = resp.json()
        raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_json)
        raw_scenes = parsed.get("scenes", [])
        if not (5 <= len(raw_scenes) <= 7):
            return None
        scenes: list[Scene] = []
        for idx, item in enumerate(raw_scenes, start=1):
            narr = _clean_text(item.get("narration", ""))
            on_scr = _clean_text(item.get("on_screen", ""))
            if not narr:
                return None
            scenes.append(
                Scene(
                    index=idx,
                    kind=item.get("kind", "idea"),
                    tag=(item.get("tag") or f"IDEA {idx}").upper()[:24],
                    on_screen=on_scr or _truncate_words(narr, 9),
                    narration=narr,
                    show_infographic=bool(item.get("show_infographic", False)) and has_vis,
                    estimated_seconds=_estimate_sec(narr),
                )
            )
        return scenes
    except Exception as exc:
        print(f"[scriptwriter] Error con Gemini ({exc}), usando generador local.")
        return None


def _build_local_script(lesson: LessonData) -> list[Scene]:
    has_vis = _has_visual(lesson)
    hook = _clean_for_speech(lesson.cita_memorable or lesson.idea_clave)
    sentences = _split_sentences(lesson.cuerpo)

    if not hook:
        first_s = _fit_complete_phrase(sentences[0], 14) if sentences else ""
        hook_narration = _fit_complete_phrase(f"{lesson.titulo}. {first_s}".strip(), 22)
    else:
        hook_narration = _fit_complete_phrase(hook, 22)

    # Seleccionar 4 ideas del cuerpo distribuidas uniformemente (20-25 palabras cada una)
    body_pool = sentences[1:] if len(sentences) > 4 else sentences
    if not body_pool:
        body_pool = [lesson.titulo]

    selected_ideas: list[str] = []
    target_ideas = 4
    if len(body_pool) <= target_ideas:
        selected_ideas = body_pool[:target_ideas]
    else:
        step = len(body_pool) / target_ideas
        for i in range(target_ideas):
            selected_ideas.append(body_pool[min(len(body_pool) - 1, int(i * step))])

    while len(selected_ideas) < 3:
        selected_ideas.append(selected_ideas[-1])

    # Cierre práctico (18-24 palabras)
    ap = _clean_for_speech(lesson.aplicacion_practica)
    author_ref = f"{lesson.libro_titulo}, de {lesson.libro_autor}" if lesson.libro_autor else lesson.libro_titulo
    if ap:
        ap_short = _fit_complete_phrase(ap, 22)
        closing_narration = f"Pruébalo hoy: {ap_short} Una idea de {author_ref}."
        closing_screen = _short_headline(ap_short, 7)
    else:
        closing_narration = (
            f"¿Dónde podrías aplicar hoy esta idea de {author_ref}? "
            "Obsérvalo en tu próxima decisión."
        )
        closing_screen = "¿Dónde lo aplicarías hoy?"

    scenes: list[Scene] = [
        Scene(
            index=1,
            kind="gancho",
            tag="GANCHO",
            on_screen=_short_headline(lesson.titulo, 8),
            narration=hook_narration,
            show_infographic=False,
            estimated_seconds=_estimate_sec(hook_narration),
        )
    ]

    mid_idx_for_infographic = 2 if len(selected_ideas) >= 3 else 1
    for i, idea in enumerate(selected_ideas):
        narr = _fit_complete_phrase(idea, 28)
        scenes.append(
            Scene(
                index=len(scenes) + 1,
                kind="idea",
                tag=f"IDEA {i + 1}",
                on_screen=_short_headline(narr, 7),
                narration=narr,
                show_infographic=has_vis and (i == mid_idx_for_infographic),
                estimated_seconds=_estimate_sec(narr),
            )
        )

    scenes.append(
        Scene(
            index=len(scenes) + 1,
            kind="cierre",
            tag="APLICACIÓN",
            on_screen=closing_screen,
            narration=closing_narration,
            show_infographic=False,
            estimated_seconds=_estimate_sec(closing_narration),
        )
    )
    return scenes


def generate_script(lesson: LessonData, use_gemini: bool = True) -> VideoScript:
    """Genera un guion de 5-7 escenas (60-90 s) para la lección."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    scenes: list[Scene] | None = None
    if use_gemini and api_key:
        scenes = _build_gemini_script(lesson, api_key)
    if scenes is None:
        scenes = _build_local_script(lesson)

    return VideoScript(
        lesson_id=lesson.id,
        lesson_title=lesson.titulo,
        book_title=lesson.libro_titulo,
        book_author=lesson.libro_autor,
        eje=lesson.eje,
        scenes=scenes,
    )


def export_script_markdown(script: VideoScript, out_path: Path) -> Path:
    """Exporta el guion a un archivo .md legible."""
    lines = [
        f"# Guion: {script.lesson_title}",
        "",
        f"- **ID lección:** `{script.lesson_id}`",
        f"- **Libro:** {script.book_title}",
        f"- **Autor:** {script.book_author or '—'}",
        f"- **Eje temático:** {script.eje}",
        f"- **Escenas:** {len(script.scenes)}",
        f"- **Palabras totales:** {script.total_words}",
        f"- **Duración estimada:** ~{script.estimated_seconds:.0f} s",
        "",
        "---",
        "",
    ]

    for s in script.scenes:
        infog = " · 🖼️ *Con infografía/esquema*" if s.show_infographic else ""
        lines.extend(
            [
                f"## Escena {s.index} — {s.tag} (`{s.kind}`, ~{s.estimated_seconds:.1f} s){infog}",
                "",
                f"**Texto en pantalla:** {s.on_screen}",
                "",
                f"> {s.narration}",
                "",
            ]
        )

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
