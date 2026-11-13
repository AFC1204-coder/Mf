"""Fábrica de motores TTS con respaldo automático Gemini -> Edge TTS."""

from __future__ import annotations

import os
from pathlib import Path

from .base import TTSEngine, TTSQuotaOrUnavailableError, TTSResult
from .edge_tts_engine import EdgeTTSEngine
from .gemini_tts import GeminiTTSEngine


class AutoTTSEngine(TTSEngine):
    """Intenta Gemini TTS primero y cae automáticamente a Edge TTS si falla la cuota o falta la clave."""

    name = "auto"

    def __init__(self, gemini_model: str | None = None, voice: str | None = None) -> None:
        self.gemini = GeminiTTSEngine(model=gemini_model, voice=voice if voice and not voice.startswith("es-ES-") else None)
        self.edge = EdgeTTSEngine(voice=voice if voice and voice.startswith("es-ES-") else None)
        self._locked_fallback = not bool(self.gemini.api_key)

    def default_voice(self) -> str:
        return self.edge.default_voice() if self._locked_fallback else self.gemini.default_voice()

    def sample_voices(self) -> list[str]:
        return self.edge.sample_voices() if self._locked_fallback else self.gemini.sample_voices()

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        if voice and voice.startswith("es-ES-"):
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
    mode = (engine or os.getenv("TTS_ENGINE", "auto")).strip().lower()
    if mode == "gemini":
        return GeminiTTSEngine(model=gemini_model, voice=voice)
    if mode == "edge":
        return EdgeTTSEngine(voice=voice)
    return AutoTTSEngine(gemini_model=gemini_model, voice=voice)
