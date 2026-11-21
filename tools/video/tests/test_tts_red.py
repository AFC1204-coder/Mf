"""Red del motor Edge TTS: proxy y certificados del entorno. Sin red."""

from __future__ import annotations

import os
import ssl
import tempfile
import unittest
from unittest import mock

from tools.video.tts import edge_tts_engine as E


class RedTest(unittest.TestCase):
    def test_usa_el_proxy_https_del_entorno(self):
        with mock.patch.dict(os.environ, {"HTTPS_PROXY": "http://127.0.0.1:3128", "NO_PROXY": "localhost"}, clear=True):
            self.assertEqual(E.proxy_de_entorno(), "http://127.0.0.1:3128")

    def test_respeta_no_proxy(self):
        with mock.patch.dict(os.environ, {"HTTPS_PROXY": "http://127.0.0.1:3128", "NO_PROXY": ".bing.com"}, clear=True):
            self.assertIsNone(E.proxy_de_entorno())

    def test_sin_proxy_sale_directo(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(E.proxy_de_entorno())

    def test_proxy_con_esquema_que_aiohttp_no_entiende(self):
        with mock.patch.dict(os.environ, {"ALL_PROXY": "socks5://127.0.0.1:1080"}, clear=True):
            self.assertIsNone(E.proxy_de_entorno())

    def test_anade_la_autoridad_del_entorno_a_la_de_edge_tts(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(E._contexto_tls())
        import certifi

        with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as f:
            f.write(open(certifi.where(), encoding="utf-8").read())
        try:
            with mock.patch.dict(os.environ, {"SSL_CERT_FILE": f.name}, clear=True):
                ctx = E._contexto_tls()
            self.assertIsInstance(ctx, ssl.SSLContext)
            self.assertGreater(ctx.cert_store_stats()["x509_ca"], 0)
        finally:
            os.unlink(f.name)

    def test_el_motor_pasa_el_proxy_a_edge_tts(self):
        with mock.patch.dict(os.environ, {"HTTPS_PROXY": "http://127.0.0.1:3128"}, clear=True):
            motor = E.EdgeTTSEngine()
        self.assertEqual(motor.proxy, "http://127.0.0.1:3128")


if __name__ == "__main__":
    unittest.main()


class AjustesDeVozTest(unittest.TestCase):
    def test_ritmo_y_tono_se_normalizan_y_cambian_la_cache(self):
        from tools.video.tts.cache import CachedTTS
        from tools.video.tts.edge_tts_engine import EdgeTTSEngine, _ajuste

        self.assertEqual(_ajuste("0", "%", "-8%"), "+0%")
        self.assertEqual(_ajuste("-5%", "%", "-8%"), "-5%")
        self.assertEqual(_ajuste("+2hz", "Hz", "-2Hz"), "+2Hz")
        self.assertEqual(_ajuste(None, "%", "-8%"), "-8%")
        with self.assertRaises(ValueError):
            _ajuste("rápido", "%", "-8%")
        normal, natural = EdgeTTSEngine(), EdgeTTSEngine(rate="+0%", pitch="+0Hz")
        self.assertEqual(normal.ajustes(), "")  # los valores de siempre no invalidan la caché que ya existe
        self.assertEqual(natural.ajustes(), "+0%,+0Hz")
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as d:
            self.assertNotEqual(CachedTTS(normal, Path(d))._key("hola", "v"), CachedTTS(natural, Path(d))._key("hola", "v"))
