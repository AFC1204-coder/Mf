"""Motor Kokoro-82M (local, gratuito, licencia Apache 2.0). Voces en español: em_santa, em_alex (masculinas), ef_dora (femenina).

Necesita `pip install -r tools/audio/requirements-kokoro.txt` y espeak-ng (`brew install espeak-ng`).
La primera vez descarga el modelo (~330 MB) de Hugging Face; después funciona sin conexión.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from .base import TTSEngine, TTSResult, estimate_word_timings, probe_duration

KOKORO_VOICES = ["em_santa", "em_alex", "ef_dora"]
SAMPLE_RATE = 24000


class KokoroTTSEngine(TTSEngine):
    name = "kokoro"

    def __init__(self, voice: str | None = None, speed: float | None = None) -> None:
        self.voice = (voice or os.getenv("KOKORO_VOICE", "em_santa")).strip()
        self.speed = speed if speed is not None else float(os.getenv("KOKORO_SPEED", "0.95"))
        self._pipeline = None

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return KOKORO_VOICES

    def _get_pipeline(self):
        if self._pipeline is None:
            try:
                from kokoro import KPipeline  # import tardío: es pesado y opcional
            except ImportError as exc:
                raise RuntimeError(
                    "Falta Kokoro. Instala: brew install espeak-ng && "
                    "tools/video/.venv/bin/pip install -r tools/audio/requirements-kokoro.txt"
                ) from exc
            self._pipeline = KPipeline(lang_code="e", repo_id="hexgrad/Kokoro-82M")  # «e» = español
        return self._pipeline

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        import numpy as np

        chosen = (voice or self.voice).strip()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        pipeline = self._get_pipeline()

        trozos = []
        for _gs, _ps, audio in pipeline(text, voice=chosen, speed=self.speed):
            if audio is None:
                continue
            arr = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            trozos.append(np.asarray(arr, dtype=np.float32).reshape(-1))
            trozos.append(np.zeros(int(SAMPLE_RATE * 0.12), dtype=np.float32))  # pausa breve entre frases
        if not trozos:
            raise RuntimeError("Kokoro no generó audio para ese texto.")

        pcm = (np.clip(np.concatenate(trozos), -1.0, 1.0) * 32767).astype("<i2").tobytes()
        subprocess.run(
            ["ffmpeg", "-y", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
             "-c:a", "libmp3lame", "-q:a", "2", str(out_path)],
            input=pcm, capture_output=True, check=True,
        )
        duration = probe_duration(out_path)
        return TTSResult(
            audio_path=out_path,
            duration_s=duration,
            engine_name="kokoro (Kokoro-82M)",
            voice=chosen,
            word_timings=estimate_word_timings(text, duration),
        )
