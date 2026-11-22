"""Motor Edge TTS (gratuito, sin clave, español de España con marcas por palabra)."""

from __future__ import annotations

import asyncio
import os
import re
import ssl
import time
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
    "en-US-BrianMultilingualNeural",
    "en-US-AvaMultilingualNeural",
    "en-US-EmmaMultilingualNeural",
    "fr-FR-VivienneMultilingualNeural",
    "fr-FR-RemyMultilingualNeural",
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


RITMO, TONO = "-8%", "-2Hz"
REINTENTOS = 6  # intentos por locución ante un fallo pasajero del servicio (en total espera hasta minuto y medio)
ESPERA_REINTENTO_S = 3.0  # espera antes del segundo intento; se dobla en cada uno


def _ajuste(valor: str | None, unidad: str, por_defecto: str) -> str:
    """«0», «+0», «-8%» → «+0%», «+0%», «-8%» (edge-tts exige signo y unidad)."""
    v = (valor or "").strip().replace(" ", "")
    if not v:
        return por_defecto
    m = re.fullmatch(r"([+-]?)(\d{1,3})(?:%|[Hh]z)?", v)
    if not m:
        raise ValueError(f"Ajuste de voz no válido: «{valor}». Ejemplos: -8{unidad}, +0{unidad}, +5{unidad}.")
    return f"{m.group(1) or '+'}{m.group(2)}{unidad}"


class EdgeTTSEngine(TTSEngine):
    name = "edge"

    def __init__(
        self,
        voice: str | None = None,
        rate: str | None = None,
        pitch: str | None = None,
    ) -> None:
        self.voice = (voice or os.getenv("EDGE_VOICE", "es-ES-AlvaroNeural")).strip()
        # Ritmo y tono: «-8%», «+0%», «+5%» · «-2Hz», «+0Hz». Por parámetro, por entorno (EDGE_RATE, EDGE_PITCH) o los de siempre.
        self.rate = _ajuste(rate or os.getenv("EDGE_RATE"), "%", RITMO)
        self.pitch = _ajuste(pitch or os.getenv("EDGE_PITCH"), "Hz", TONO)
        self.proxy = _preparar_red()

    def default_voice(self) -> str:
        return self.voice

    def ajustes(self) -> str:
        """Lo que cambia el audio además de la voz (entra en la caché y en la huella). Vacío con los valores de siempre."""
        return "" if (self.rate, self.pitch) == (RITMO, TONO) else f"{self.rate},{self.pitch}"

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
        # El servicio falla de vez en cuando sin motivo («No audio was received», un corte de red): en una tanda de
        # cientos de locuciones eso tumbaba una pieza de cada diez. Se reintenta con espera creciente antes de rendirse.
        ultimo: Exception | None = None
        timings: list[WordTiming] = []
        for intento in range(REINTENTOS):
            try:
                timings = asyncio.run(self._synth_async(text, out_path, chosen_voice))
                if out_path.exists() and out_path.stat().st_size > 0:
                    ultimo = None
                    break
                ultimo = RuntimeError("Edge TTS devolvió un audio vacío")
            except Exception as exc:  # noqa: BLE001 (edge-tts y aiohttp lanzan tipos distintos para el mismo fallo pasajero)
                ultimo = exc
            if intento < REINTENTOS - 1:
                time.sleep(ESPERA_REINTENTO_S * (2**intento))
        if ultimo is not None:
            raise ultimo
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
