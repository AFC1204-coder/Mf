"""Motor de voz de prueba: un pitido por palabra y sus marcas de tiempo exactas.

No es una voz. Sirve para comprobar el montaje cuando no hay red de voz: el vídeo sale con sonido
(un tono por palabra, más grave al acabar la frase), así que se puede verificar de oído y con
herramientas que cada ráfaga de texto entra cuando «suena» su primera palabra. Sin dependencias.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

from tools.video.tts.base import TTSEngine, TTSResult, WordTiming

RATE = 24000


class PitidosTTSEngine(TTSEngine):
    name = "pitidos"

    def __init__(self, voice: str | None = None, palabras_por_segundo: float = 2.7) -> None:
        self.voice = voice or "pitidos"
        self.pps = palabras_por_segundo

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return [self.voice]

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        palabras = text.split()
        muestras: list[int] = []
        marcas: list[WordTiming] = []
        t = 0.08
        muestras += [0] * int(t * RATE)
        for w in palabras:
            fin_frase = w.rstrip("\"'»”)").endswith((".", "!", "?", "…", ":"))
            dur = min(0.5, 0.16 + 0.03 * len(w)) * (2.4 / self.pps)
            pausa = 0.30 if fin_frase else 0.12 if w.endswith((",", ";")) else 0.05
            hz = 330.0 if fin_frase else 440.0
            n = int(dur * RATE)
            for i in range(n):
                env = min(1.0, i / 240, (n - i) / 240)  # sin chasquidos
                muestras.append(int(9000 * env * math.sin(2 * math.pi * hz * i / RATE)))
            marcas.append(WordTiming(text=w, start_s=round(t, 3), end_s=round(t + dur, 3)))
            t += dur + pausa
            muestras += [0] * int(pausa * RATE)
        out_path = out_path.with_suffix(".wav")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out_path), "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(RATE)
            f.writeframes(struct.pack(f"<{len(muestras)}h", *muestras))
        return TTSResult(audio_path=out_path, duration_s=round(len(muestras) / RATE, 3), engine_name=self.name, voice=voice or self.voice, word_timings=marcas)
