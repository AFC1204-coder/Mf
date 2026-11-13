"""Motor Edge TTS (gratuito, sin clave, español de España con marcas por palabra)."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import edge_tts

from .base import TTSEngine, TTSResult, WordTiming, estimate_word_timings, probe_duration

EDGE_VOICES = [
    "es-ES-AlvaroNeural",
    "es-ES-ElviraNeural",
    "es-ES-XimenaNeural",
]


class EdgeTTSEngine(TTSEngine):
    name = "edge"

    def __init__(
        self,
        voice: str | None = None,
        rate: str = "-8%",
        pitch: str = "-2Hz",
    ) -> None:
        self.voice = (voice or os.getenv("EDGE_VOICE", "es-ES-AlvaroNeural")).strip()
        self.rate = rate
        self.pitch = pitch

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return EDGE_VOICES

    async def _synth_async(self, text: str, out_path: Path, voice: str) -> list[WordTiming]:
        communicate = edge_tts.Communicate(
            text,
            voice=voice,
            rate=self.rate,
            pitch=self.pitch,
            boundary="WordBoundary",
        )
        timings: list[WordTiming] = []
        out_path.parent.mkdir(parents=True, exist_ok=True)

        with out_path.open("wb") as audio_file:
            async for chunk in communicate.stream():
                ctype = chunk.get("type")
                if ctype == "audio":
                    audio_file.write(chunk["data"])
                elif ctype == "WordBoundary":
                    start_s = chunk["offset"] / 10_000_000.0
                    dur_s = chunk["duration"] / 10_000_000.0
                    timings.append(
                        WordTiming(
                            text=chunk["text"],
                            start_s=round(start_s, 3),
                            end_s=round(start_s + dur_s, 3),
                        )
                    )
        return timings

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        chosen_voice = voice or self.voice
        timings = asyncio.run(self._synth_async(text, out_path, chosen_voice))
        duration = probe_duration(out_path)
        if not timings:
            timings = estimate_word_timings(text, duration)
        return TTSResult(
            audio_path=out_path,
            duration_s=duration,
            engine_name="edge-tts",
            voice=chosen_voice,
            word_timings=timings,
        )
