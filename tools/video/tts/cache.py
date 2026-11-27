"""Caché de locuciones: el mismo texto con la misma voz no se vuelve a sintetizar.

Hace baratas las repeticiones (retocar un fotograma no cuesta voz) y da coherencia a la serie: la
frase que se repite entre lecciones (la idea que abre, cierra y enlaza) suena idéntica en todas.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from .base import TTSEngine, TTSResult, WordTiming


class CachedTTS(TTSEngine):
    name = "cache"

    def __init__(self, engine: TTSEngine, cache_dir: Path) -> None:
        self.engine = engine
        self.cache_dir = cache_dir
        self.hits = 0
        self.misses = 0

    def default_voice(self) -> str:
        return self.engine.default_voice()

    def sample_voices(self) -> list[str]:
        return self.engine.sample_voices()

    def _key(self, text: str, voice: str) -> str:
        ajustes = getattr(self.engine, "ajustes", lambda: "")()  # ritmo y tono, si no son los de siempre
        variante = getattr(self.engine, "variante", lambda _t, _v: "")(text, voice)  # p. ej. la frase de apoyo de las voces multilingües
        clave = [text, voice] + ([ajustes] if ajustes or variante else []) + ([variante] if variante else [])
        raw = json.dumps(clave, ensure_ascii=False)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        chosen = voice or self.engine.default_voice()
        key = self._key(text, chosen)
        meta_path = self.cache_dir / f"{key}.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                audio = self.cache_dir / meta["file"]
                marcas = [WordTiming(**w) for w in meta.get("word_timings", [])]
                # Una locución cortada que se guardó antes de existir la comprobación no se reutiliza: se pide otra vez.
                entera = True
                if meta.get("engine_name") == "edge-tts":
                    from .edge_tts_engine import incompleta  # aquí dentro: sin edge-tts instalado la caché sigue valiendo para los otros motores

                    entera = not incompleta(str(meta.get("text") or text), marcas, float(meta["duration_s"]))
                if entera and audio.exists() and audio.stat().st_size > 0:
                    self.hits += 1
                    return TTSResult(
                        audio_path=audio,
                        duration_s=float(meta["duration_s"]),
                        engine_name=meta["engine_name"],
                        voice=meta["voice"],
                        word_timings=marcas,
                    )
            except (ValueError, KeyError, TypeError, OSError):
                pass

        self.cache_dir.mkdir(parents=True, exist_ok=True)
        res = self.engine.synthesize(text, out_path, voice=voice)
        self.misses += 1
        # El motor «auto» puede haber caído a otro motor con otra voz: se guarda bajo la clave pedida
        # pero anotando lo que sonó de verdad.
        stored = self.cache_dir / f"{key}{res.audio_path.suffix}"
        shutil.copyfile(res.audio_path, stored)
        meta_path.write_text(
            json.dumps(
                {
                    "file": stored.name,
                    "duration_s": res.duration_s,
                    "engine_name": res.engine_name,
                    "voice": res.voice,
                    "text": text,
                    "word_timings": [w.__dict__ for w in res.word_timings],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return TTSResult(stored, res.duration_s, res.engine_name, res.voice, res.word_timings)
