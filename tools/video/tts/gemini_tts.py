"""Motor Gemini TTS (gemini-2.5-flash-preview-tts / gemini-2.5-pro-preview-tts)."""

from __future__ import annotations

import base64
import os
import subprocess
import time
from pathlib import Path

import requests

from .base import (
    TTSEngine,
    TTSQuotaOrUnavailableError,
    TTSResult,
    estimate_word_timings,
    probe_duration,
)

GEMINI_VOICES = ["Aoede", "Charon", "Fenrir"]


class GeminiTTSEngine(TTSEngine):
    name = "gemini"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        voice: str | None = None,
    ) -> None:
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        self.model = (model or os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")).strip()
        self.voice = (voice or os.getenv("GEMINI_VOICE", "Aoede")).strip()

    def default_voice(self) -> str:
        return self.voice

    def sample_voices(self) -> list[str]:
        return GEMINI_VOICES

    def synthesize(self, text: str, out_path: Path, voice: str | None = None) -> TTSResult:
        if not self.api_key:
            raise TTSQuotaOrUnavailableError("GEMINI_API_KEY no configurada en .env")

        chosen_voice = voice or self.voice
        out_path.parent.mkdir(parents=True, exist_ok=True)

        styled_prompt = (
            "Lee el siguiente texto en español de España, con voz cálida, pausada y cercana, "
            "ritmo de explicación tranquila y reflexiva, sin tono de anuncio ni locución comercial:\n\n"
            f"{text}"
        )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": styled_prompt}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": chosen_voice}
                    }
                },
            },
        }

        for attempt in range(2):
            try:
                resp = requests.post(url, json=payload, timeout=45)
            except requests.RequestException as exc:
                raise TTSQuotaOrUnavailableError(f"Error de red con Gemini TTS: {exc}") from exc

            if resp.status_code == 429 and attempt == 0:
                print("[tts] Límite por minuto en Gemini TTS (429); esperando 6 s y reintentando...")
                time.sleep(6)
                continue
            break

        if resp.status_code in (401, 403, 429, 503):
            raise TTSQuotaOrUnavailableError(
                f"Gemini TTS no disponible ({resp.status_code}): {resp.text[:250]}"
            )
        if not resp.ok:
            body = resp.text[:300]
            if "RESOURCE_EXHAUSTED" in body or "quota" in body.lower():
                raise TTSQuotaOrUnavailableError(f"Cuota Gemini TTS agotada: {body}")
            raise RuntimeError(f"Error Gemini TTS ({resp.status_code}): {body}")

        data = resp.json()
        try:
            part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
            raw_bytes = base64.b64decode(part["data"])
            mime = part.get("mimeType", "audio/L16;rate=24000")
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Respuesta inesperada de Gemini TTS: {data}") from exc

        if "L16" in mime or "pcm" in mime.lower():
            rate = 24000
            for token in mime.split(";"):
                if token.strip().startswith("rate="):
                    rate = int(token.split("=")[1])
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "s16le",
                    "-ar",
                    str(rate),
                    "-ac",
                    "1",
                    "-i",
                    "pipe:0",
                    "-c:a",
                    "libmp3lame",
                    "-q:a",
                    "2",
                    str(out_path),
                ],
                input=raw_bytes,
                capture_output=True,
                check=True,
            )
        else:
            tmp_raw = out_path.with_suffix(".raw")
            tmp_raw.write_bytes(raw_bytes)
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(tmp_raw), "-c:a", "libmp3lame", "-q:a", "2", str(out_path)],
                capture_output=True,
                check=True,
            )
            tmp_raw.unlink(missing_ok=True)

        duration = probe_duration(out_path)
        return TTSResult(
            audio_path=out_path,
            duration_s=duration,
            engine_name=f"gemini ({self.model})",
            voice=chosen_voice,
            word_timings=estimate_word_timings(text, duration),
        )
