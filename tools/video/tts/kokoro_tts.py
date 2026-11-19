"""Motor Kokoro-82M: voz neuronal **local y gratuita** (modelo Apache 2.0), sin clave ni cuota.

Voces en español: `em_alex`, `em_santa` (masculinas) y `ef_dora` (femenina).

Dos formas de ejecutarlo, la que esté instalada:

1. **kokoro-onnx** (ligera, sin PyTorch; funciona también en Python 3.13):
   `pip install -r tools/video/requirements-kokoro.txt`. El modelo (~90 MB cuantizado, o ~310 MB
   completo) y las voces (~28 MB) se descargan solos la primera vez a `tools/video/.modelos/kokoro/`
   (o a `KOKORO_DIR`). Después funciona sin conexión.
2. **kokoro** (PyTorch, Python ≤ 3.12) + `espeak-ng`: la variante original de `tools/audio`.

Kokoro no da marcas por palabra: los subtítulos se reparten de forma proporcional en cada escena.
Portado de la rama `claude/mente-fria-daily-redesign-pt8obx` (solo el motor; nada de subidas).
"""

from __future__ import annotations

import os
import subprocess
import urllib.request
from pathlib import Path

from .base import TTSEngine, TTSQuotaOrUnavailableError, TTSResult, estimate_word_timings, probe_duration

KOKORO_VOICES = ["em_alex", "em_santa", "ef_dora"]
SAMPLE_RATE = 24000
_RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
_MODELOS = {"int8": "kokoro-v1.0.int8.onnx", "fp16": "kokoro-v1.0.fp16.onnx", "completo": "kokoro-v1.0.onnx"}
_VOCES = "voices-v1.0.bin"
DEFAULT_DIR = Path(__file__).resolve().parent.parent / ".modelos" / "kokoro"


def _download(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + ".part")
    print(f"[kokoro] Descargando {dst.name} (solo la primera vez)…")
    try:
        urllib.request.urlretrieve(url, tmp)  # noqa: S310 (URL fija de GitHub)
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        raise TTSQuotaOrUnavailableError(f"No se pudo descargar {dst.name}: {exc}") from exc
    tmp.replace(dst)


class KokoroTTSEngine(TTSEngine):
    name = "kokoro"

    def __init__(self, voice: str | None = None, speed: float | None = None) -> None:
        self.voice = (voice or os.getenv("KOKORO_VOICE", "em_alex")).strip()
        self.speed = speed if speed is not None else float(os.getenv("KOKORO_SPEED", "0.95"))
        self.model_dir = Path(os.getenv("KOKORO_DIR") or DEFAULT_DIR)
        self.variant = os.getenv("KOKORO_MODELO", "int8").strip().lower()
        self._onnx = None
        self._pipeline = None

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return KOKORO_VOICES

    # ── carga perezosa: el modelo pesa y es opcional ──
    def _load(self) -> None:
        if self._onnx is not None or self._pipeline is not None:
            return
        try:
            from kokoro_onnx import Kokoro
        except ImportError:
            Kokoro = None
        if Kokoro is not None:
            modelo = self.model_dir / _MODELOS.get(self.variant, _MODELOS["int8"])
            if not modelo.exists():  # vale cualquier variante ya descargada
                ya = [self.model_dir / n for n in _MODELOS.values() if (self.model_dir / n).exists()]
                modelo = ya[0] if ya else modelo
            voces = self.model_dir / _VOCES
            if not modelo.exists():
                _download(_RELEASE + modelo.name, modelo)
            if not voces.exists():
                _download(_RELEASE + _VOCES, voces)
            self._onnx = Kokoro(str(modelo), str(voces))
            return
        try:
            from kokoro import KPipeline
        except ImportError as exc:
            raise TTSQuotaOrUnavailableError(
                "Falta Kokoro. Instala: tools/video/.venv/bin/pip install -r tools/video/requirements-kokoro.txt"
            ) from exc
        self._pipeline = KPipeline(lang_code="e", repo_id="hexgrad/Kokoro-82M")  # «e» = español

    def _samples(self, text: str, voice: str):
        import numpy as np

        self._load()
        if self._onnx is not None:
            audio, sr = self._onnx.create(text, voice=voice, speed=self.speed, lang="es")
            return np.asarray(audio, dtype=np.float32).reshape(-1), int(sr)
        trozos = []
        for _gs, _ps, audio in self._pipeline(text, voice=voice, speed=self.speed):
            if audio is None:
                continue
            arr = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            trozos.append(np.asarray(arr, dtype=np.float32).reshape(-1))
            trozos.append(np.zeros(int(SAMPLE_RATE * 0.12), dtype=np.float32))  # pausa breve entre frases
        if not trozos:
            raise RuntimeError("Kokoro no generó audio para ese texto.")
        return np.concatenate(trozos), SAMPLE_RATE

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        import numpy as np

        chosen = (voice or self.voice).strip()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        audio, sr = self._samples(text, chosen)
        pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2").tobytes()
        subprocess.run(
            ["ffmpeg", "-y", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
             "-c:a", "libmp3lame", "-q:a", "2", str(out_path)],
            input=pcm, capture_output=True, check=True,
        )
        duration = probe_duration(out_path)
        return TTSResult(
            audio_path=out_path,
            duration_s=duration,
            engine_name="kokoro (Kokoro-82M, local)",
            voice=chosen,
            word_timings=estimate_word_timings(text, duration),
        )
