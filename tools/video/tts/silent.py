"""Motor «mudo»: pista en silencio con la duración que tendría la locución.

Sirve para previsualizar el vídeo (fotogramas, ritmo y subtítulos) sin red, sin clave y sin gastar
cuota, y para las pruebas automáticas. No es una voz: el vídeo sale sin sonido.
"""

from __future__ import annotations

import wave
from pathlib import Path

from .base import TTSEngine, TTSResult, estimate_word_timings

WORDS_PER_SECOND = 2.4


class SilentTTSEngine(TTSEngine):
    name = "mudo"

    def __init__(self, voice: str | None = None) -> None:
        self.voice = voice or "sin-voz"

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return [self.voice]

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        palabras = text.split()
        pausas = sum(0.35 for w in palabras if w.endswith((".", "!", "?", "…", ":"))) + sum(0.12 for w in palabras if w.endswith((",", ";")))
        duration = round(max(0.6, len(palabras) / WORDS_PER_SECOND + pausas * 0.5), 3)
        out_path = out_path.with_suffix(".wav")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        rate = 24000
        with wave.open(str(out_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(b"\x00\x00" * int(duration * rate))
        return TTSResult(
            audio_path=out_path,
            duration_s=duration,
            engine_name="mudo",
            voice=voice or self.voice,
            word_timings=estimate_word_timings(text, duration),
        )
