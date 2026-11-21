"""Fábrica de motores de voz.

Por defecto, **Edge TTS** (gratis, sin clave). `kokoro` es local y gratis. `gemini` y `auto`
(Gemini con respaldo en Edge) usan una clave de pago: solo si se piden de forma explícita.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from .base import TTSEngine, TTSQuotaOrUnavailableError, TTSResult
from .edge_tts_engine import EdgeTTSEngine
from .gemini_tts import GeminiTTSEngine
from .silent import SilentTTSEngine

DEFAULT_ENGINE = "edge"
_VOZ_EDGE = re.compile(r"^[a-z]{2,3}-[A-Z]{2}-\w+Neural$")


def is_edge_voice(voice: str | None) -> bool:
    """«es-ES-AlvaroNeural», «en-US-BrianMultilingualNeural»… (las de Gemini son un nombre suelto)."""
    return bool(voice and _VOZ_EDGE.match(voice))


class AutoTTSEngine(TTSEngine):
    """Intenta Gemini TTS primero y cae automáticamente a Edge TTS si falla la cuota o falta la clave."""

    name = "auto"

    def __init__(self, gemini_model: str | None = None, voice: str | None = None) -> None:
        self.gemini = GeminiTTSEngine(model=gemini_model, voice=voice if voice and not is_edge_voice(voice) else None)
        self.edge = EdgeTTSEngine(voice=voice if is_edge_voice(voice) else None)
        self._locked_fallback = not bool(self.gemini.api_key)

    def default_voice(self) -> str:
        return self.edge.default_voice() if self._locked_fallback else self.gemini.default_voice()

    def sample_voices(self) -> list[str]:
        return self.edge.sample_voices() if self._locked_fallback else self.gemini.sample_voices()

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        if is_edge_voice(voice):
            return self.edge.synthesize(text, out_path, voice=voice)

        if not self._locked_fallback:
            try:
                return self.gemini.synthesize(text, out_path, voice=voice)
            except TTSQuotaOrUnavailableError as exc:
                print(f"[tts] {exc}")
                print("[tts] Cambiando automáticamente al respaldo gratuito Edge TTS.")
                self._locked_fallback = True

        return self.edge.synthesize(text, out_path, voice=None)


def get_tts_engine(
    engine: str | None = None,
    voice: str | None = None,
    gemini_model: str | None = None,
) -> TTSEngine:
    mode = (engine or os.getenv("TTS_ENGINE", DEFAULT_ENGINE)).strip().lower()
    if mode == "gemini":
        return GeminiTTSEngine(model=gemini_model, voice=voice)
    if mode == "edge":
        return EdgeTTSEngine(voice=voice)
    if mode == "kokoro":
        from .kokoro_tts import KokoroTTSEngine  # import tardío: es opcional

        return KokoroTTSEngine(voice=voice)
    if mode == "mudo":
        return SilentTTSEngine(voice=voice)
    return AutoTTSEngine(gemini_model=gemini_model, voice=voice)
