"""Interfaz base intercambiable para motores de síntesis de voz (TTS)."""

from __future__ import annotations

import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


class TTSQuotaOrUnavailableError(RuntimeError):
    """Error cuando el motor TTS no está disponible o ha agotado su cuota."""


@dataclass
class WordTiming:
    text: str
    start_s: float
    end_s: float


@dataclass
class TTSResult:
    audio_path: Path
    duration_s: float
    engine_name: str
    voice: str
    word_timings: list[WordTiming] = field(default_factory=list)


def probe_duration(audio_path: Path) -> float:
    """Devuelve la duración exacta en segundos usando ffprobe."""
    res = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(res.stdout.strip())


def estimate_word_timings(text: str, duration_s: float) -> list[WordTiming]:
    """Reparte los tiempos por palabra proporcionalmente a su longitud cuando el motor no da marcas."""
    words = [w for w in text.split() if w.strip()]
    if not words:
        return []
    weights = [max(2, len(w)) + (2 if w.endswith((",", ";")) else 4 if w.endswith((".", "!", "?")) else 0) for w in words]
    total_w = sum(weights)
    pad_start = min(0.12, duration_s * 0.03)
    usable = max(0.2, duration_s - pad_start - 0.1)
    cursor = pad_start
    timings: list[WordTiming] = []
    for word, w in zip(words, weights):
        span = usable * (w / total_w)
        timings.append(WordTiming(text=word, start_s=round(cursor, 3), end_s=round(cursor + span, 3)))
        cursor += span
    return timings


class TTSEngine(ABC):
    name: str = "base"

    @abstractmethod
    def default_voice(self) -> str:
        ...

    @abstractmethod
    def sample_voices(self) -> list[str]:
        ...

    @abstractmethod
    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        ...
