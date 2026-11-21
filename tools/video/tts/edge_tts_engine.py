"""Motor Edge TTS (gratuito, sin clave, español de España con marcas por palabra)."""

from __future__ import annotations

import asyncio
import os
import ssl
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import proxy_bypass_environment

import edge_tts

from .base import TTSEngine, TTSResult, WordTiming, estimate_word_timings, probe_duration

EDGE_VOICES = [
    "es-ES-AlvaroNeural",
    "es-ES-ElviraNeural",
    "es-ES-XimenaNeural",
    # Voces multilingües de última generación: hablan español y pronuncian bien los títulos y
    # términos en inglés («Never Split the Difference»). Su acento en español no es peninsular.
    "en-US-AndrewMultilingualNeural",
    "en-US-BrianMultilingualNeural",
    "en-US-AvaMultilingualNeural",
    "en-US-EmmaMultilingualNeural",
    "fr-FR-VivienneMultilingualNeural",
]


EDGE_HOST = "speech.platform.bing.com"


def proxy_de_entorno(host: str = EDGE_HOST) -> str | None:
    """El proxy HTTPS del entorno (HTTPS_PROXY…), salvo que NO_PROXY excluya el host.

    edge-tts habla por WebSocket (wss://) y aiohttp no aplica a esas conexiones el proxy del entorno:
    detrás de un proxy obligatorio (una red corporativa, un contenedor) intentaba salir directo y fallaba.
    """
    for clave in ("HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"):
        valor = (os.getenv(clave) or "").strip()
        if valor and urlparse(valor).scheme in ("http", "https"):
            return None if proxy_bypass_environment(host) else valor
    return None


def _contexto_tls() -> ssl.SSLContext | None:
    """Certificados de confianza: los de edge-tts (certifi) más los que el entorno declare (SSL_CERT_FILE,
    REQUESTS_CA_BUNDLE). Un proxy que inspecciona TLS firma con su propia autoridad, que certifi no conoce."""
    extra = [f for f in (os.getenv("SSL_CERT_FILE"), os.getenv("REQUESTS_CA_BUNDLE")) if f and os.path.isfile(f)]
    if not extra:
        return None
    import certifi

    ctx = ssl.create_default_context(cafile=certifi.where())
    for f in dict.fromkeys(extra):
        ctx.load_verify_locations(cafile=f)
    return ctx


def _preparar_red() -> str | None:
    """Ajusta edge-tts a la red del entorno y devuelve el proxy que hay que usar (o None)."""
    ctx = _contexto_tls()
    comunicacion = getattr(edge_tts, "communicate", None)
    if ctx is not None and comunicacion is not None and hasattr(comunicacion, "_SSL_CTX"):
        comunicacion._SSL_CTX = ctx  # edge-tts fija su contexto TLS a nivel de módulo y no admite otro por parámetro
    return proxy_de_entorno()


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
        self.proxy = _preparar_red()

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
            proxy=self.proxy,
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
