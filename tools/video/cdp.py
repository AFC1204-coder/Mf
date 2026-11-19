"""Captura de fotogramas con un solo Chrome, por el protocolo DevTools (CDP).

`chrome --screenshot` arranca un navegador por fotograma y en algunos entornos (contenedores, CI)
se queda colgado. Aquí se abre **un** Chrome sin cabeza y se le piden todas las capturas por su
puerto de depuración local: es más rápido y no depende de que el proceso termine solo.

Solo usa `aiohttp` (ya viene con `edge-tts`). Si no está o algo falla, `frames.py` vuelve a la vía
clásica de un proceso por fotograma.
"""

from __future__ import annotations

import asyncio
import base64
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

LISTO_JS = (
    "(async () => { try { await document.fonts.ready; } catch (e) {} "
    "return document.readyState === 'complete' && document.documentElement.dataset.listo === '1'; })()"
)


class CDPError(RuntimeError):
    pass


def _launch(chrome: str, profile: Path, width: int, height: int) -> subprocess.Popen:
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-component-update",
        "--allow-file-access-from-files",
        "--force-device-scale-factor=1",
        "--remote-debugging-port=0",
        f"--window-size={width},{height}",
        f"--user-data-dir={profile}",
        "about:blank",
    ]
    if sys.platform.startswith("linux"):
        cmd.insert(1, "--no-sandbox")
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _wait_port(profile: Path, proc: subprocess.Popen, timeout_s: float = 30.0) -> int:
    marca = profile / "DevToolsActivePort"
    limite = time.monotonic() + timeout_s
    while time.monotonic() < limite:
        if proc.poll() is not None:
            raise CDPError("Chrome se cerró antes de abrir el puerto de depuración.")
        try:
            return int(marca.read_text().splitlines()[0])
        except (OSError, ValueError, IndexError):
            time.sleep(0.1)
    raise CDPError("Chrome no abrió el puerto de depuración a tiempo.")


class _Tab:
    def __init__(self, ws) -> None:
        self.ws = ws
        self._id = 0

    async def call(self, method: str, **params):
        self._id += 1
        mi_id = self._id
        await self.ws.send_str(json.dumps({"id": mi_id, "method": method, "params": params}))
        while True:
            msg = await self.ws.receive(timeout=60)
            if msg.type.name != "TEXT":
                raise CDPError(f"Conexión con Chrome interrumpida ({msg.type.name}).")
            data = json.loads(msg.data)
            if data.get("id") == mi_id:
                if "error" in data:
                    raise CDPError(f"{method}: {data['error'].get('message')}")
                return data.get("result", {})


async def _capture_all(port: int, jobs: list[tuple[Path, Path]], width: int, height: int, workers: int) -> None:
    import aiohttp

    cola: asyncio.Queue[tuple[Path, Path]] = asyncio.Queue()
    for j in jobs:
        cola.put_nowait(j)

    async with aiohttp.ClientSession() as session:

        async def trabajador() -> None:
            async with session.put(f"http://127.0.0.1:{port}/json/new?about:blank") as r:
                info = await r.json(content_type=None)
            async with session.ws_connect(info["webSocketDebuggerUrl"], max_msg_size=0) as ws:
                tab = _Tab(ws)
                await tab.call("Page.enable")
                await tab.call(
                    "Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=1, mobile=False
                )
                while True:
                    try:
                        html_path, out_png = cola.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                    await tab.call("Page.navigate", url=html_path.resolve().as_uri())
                    limite = time.monotonic() + 45
                    while True:
                        res = await tab.call("Runtime.evaluate", expression=LISTO_JS, awaitPromise=True, returnByValue=True)
                        if res.get("result", {}).get("value") is True:
                            break
                        if time.monotonic() > limite:
                            raise CDPError(f"El fotograma {html_path.name} no terminó de dibujarse.")
                        await asyncio.sleep(0.05)
                    shot = await tab.call(
                        "Page.captureScreenshot",
                        format="png",
                        clip={"x": 0, "y": 0, "width": width, "height": height, "scale": 1},
                        captureBeyondViewport=False,
                    )
                    out_png.write_bytes(base64.b64decode(shot["data"]))
            try:
                async with session.get(f"http://127.0.0.1:{port}/json/close/{info['id']}"):
                    pass
            except Exception:
                pass

        await asyncio.gather(*(trabajador() for _ in range(max(1, min(workers, len(jobs))))))


def capture_pages(chrome: str, jobs: list[tuple[Path, Path]], width: int, height: int, workers: int = 4) -> None:
    """Captura cada (html, png) con un único Chrome. Lanza CDPError si no se puede."""
    if not jobs:
        return
    try:
        import aiohttp  # noqa: F401
    except ImportError as exc:
        raise CDPError("Falta aiohttp (se instala con edge-tts).") from exc
    profile = Path(tempfile.mkdtemp(prefix="vf-cdp-"))
    proc = _launch(chrome, profile, width, height)
    try:
        port = _wait_port(profile, proc)
        asyncio.run(_capture_all(port, jobs, width, height, workers))
    except CDPError:
        raise
    except Exception as exc:  # red local, tiempo agotado, protocolo…
        raise CDPError(f"Captura por DevTools fallida: {exc}") from exc
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
