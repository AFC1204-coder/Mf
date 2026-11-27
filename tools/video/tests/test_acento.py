"""Voces multilingües: las frases muy cortas se dicen con una frase de apoyo en español que luego se recorta."""

import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.video.tts import edge_tts_engine as E
from tools.video.tts.base import WordTiming
from tools.video.tts.cache import CachedTTS

VOZ = "fr-FR-RemyMultilingualNeural"


class NecesitaApoyoTest(unittest.TestCase):
    def test_solo_voces_multilingues_y_primera_frase_corta(self):
        self.assertTrue(E.necesita_apoyo("Antojo.", VOZ))
        self.assertTrue(E.necesita_apoyo("El matiz. Generar más opciones tiene un coste.", VOZ))
        self.assertTrue(E.necesita_apoyo("Señal. Los hábitos se disparan por señales.", VOZ))
        self.assertFalse(E.necesita_apoyo("Las decisiones planteadas como sí o no fracasan más.", VOZ))
        self.assertFalse(E.necesita_apoyo("La respuesta: Porque conocerlos no impide caer en ellos.", VOZ))
        self.assertFalse(E.necesita_apoyo("Antojo.", "es-ES-AlvaroNeural"))
        self.assertFalse(E.necesita_apoyo("", VOZ))


class RecorteTest(unittest.TestCase):
    def test_el_apoyo_se_recorta_y_las_marcas_se_desplazan(self):
        motor = E.EdgeTTSEngine.__new__(E.EdgeTTSEngine)
        motor.voice, motor.rate, motor.pitch, motor.proxy = VOZ, "+0%", "+0Hz", None
        palabras = E.APOYO_ES.split() + ["Antojo."]

        async def falso(texto, out_path, voz):
            self.assertEqual(texto, f"{E.APOYO_ES} Antojo.")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-ar", "24000", "-ac", "1", str(out_path)], check=True)
            return [WordTiming(w.strip(":."), 0.3 * k, 0.3 * k + 0.25) for k, w in enumerate(palabras[:-1])] + [WordTiming("Antojo", 2.4, 2.9)]

        motor._synth_async = falso
        with tempfile.TemporaryDirectory() as d:
            res = motor.synthesize("Antojo.", Path(d) / "a.mp3")
            self.assertEqual([w.text for w in res.word_timings], ["Antojo"])
            self.assertAlmostEqual(res.word_timings[0].start_s, E.APOYO_MARGEN_S, places=2)
            self.assertAlmostEqual(res.duration_s, 3 - (2.4 - E.APOYO_MARGEN_S), delta=0.08)

    def test_la_cache_distingue_el_audio_con_apoyo(self):
        motor = E.EdgeTTSEngine.__new__(E.EdgeTTSEngine)
        motor.voice, motor.rate, motor.pitch, motor.proxy = VOZ, E.RITMO, E.TONO, None
        with tempfile.TemporaryDirectory() as d:
            c = CachedTTS(motor, Path(d))
            self.assertNotEqual(c._key("Antojo.", VOZ), c._key("Antojo.", "es-ES-AlvaroNeural"))
            largo = "Las decisiones planteadas como sí o no fracasan más."
            self.assertEqual(c._key(largo, VOZ), CachedTTS(type("M", (), {})(), Path(d))._key(largo, VOZ))  # lo largo no cambia de clave


if __name__ == "__main__":
    unittest.main()
