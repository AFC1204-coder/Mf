import unittest
from pathlib import Path

from tools.video import frames as F
from tools.video import renderer as R
from tools.video import scriptwriter as SW
from tools.video.tests.fixtures import libro
from tools.video.tts.base import WordTiming


class Fotogramas(unittest.TestCase):
    def setUp(self):
        self.b = libro()
        self.ep = SW.lesson_episode(self.b, 0)

    def test_un_estado_por_cambio_y_acumulativos(self):
        think = next(s for s in self.ep.scenes if s.kind == "pregunta" and not s.narration)
        estados = F.scene_states(think, 0)
        self.assertEqual([e.view["countdown"] for e in estados], [0, 3, 2, 1])

    def test_html_de_todas_las_plantillas_sin_red(self):
        for ep in SW.book_series(self.b):
            estados, paginas = F.episode_pages(ep)
            self.assertEqual(len(estados), len(paginas))
            for doc in paginas:
                self.assertNotIn("http://", doc)
                self.assertNotIn("https://", doc)
                self.assertIn("MENTE FRÍA", doc)

    def test_el_indice_resalta_la_seccion_en_curso(self):
        i, escena = next((i, s) for i, s in enumerate(self.ep.scenes) if s.section == "Matiz")
        doc = F.frame_html(self.ep, escena, escena.view, i)
        self.assertIn('<span class="vf-rail-i on"><i></i><b>Matiz</b></span>', doc)
        self.assertIn('<span class="vf-rail-i done"><i></i><b>Esquema</b></span>', doc)
        self.assertIn('<span class="vf-rail-i "><i></i><b>Práctica</b></span>', doc)
        cierre = F.frame_html(self.ep, self.ep.scenes[-1], self.ep.scenes[-1].view, len(self.ep.scenes) - 1)
        self.assertNotIn("vf-rail-i on", cierre)
        self.assertEqual(cierre.count("vf-rail-i done"), len(self.ep.sections))

    def test_el_texto_del_corpus_se_escapa(self):
        escena = next(s for s in self.ep.scenes if s.kind == "idea")
        doc = F.frame_html(self.ep, escena, dict(escena.view, text="<script>alert(1)</script> & más"), 2)
        self.assertNotIn("<script>alert(1)</script>", doc)
        self.assertIn("&lt;script&gt;", doc)

    def test_la_respuesta_marca_la_opcion_correcta(self):
        i, r = next((i, s) for i, s in enumerate(self.ep.scenes) if s.kind == "pregunta" and s.view["reveal"])
        doc = F.frame_html(self.ep, r, r.view, i)
        self.assertEqual(doc.count('class="vf-opt ok"'), 1)
        self.assertEqual(doc.count('class="vf-opt dim"'), 3)
        self.assertIn('<div class="vf-opt ok"><span class="l">B</span>', doc)


class LineaDeTiempo(unittest.TestCase):
    def test_marcas_exactas_cuando_cuadran(self):
        marcas = [WordTiming("uno", 0.0, 0.4), WordTiming("dos", 0.5, 0.9)]
        self.assertEqual(R.align_words(["Uno,", "dos."], marcas, 1.0), [("Uno,", 0.0, 0.4), ("dos.", 0.5, 0.9)])

    def test_se_interpola_cuando_el_motor_parte_palabras(self):
        marcas = [WordTiming(str(i), i * 0.5, i * 0.5 + 0.4) for i in range(6)]
        res = R.align_words(["a", "b", "c"], marcas, 3.0)
        self.assertEqual([r[1] for r in res], [0.0, 1.0, 2.0])
        self.assertTrue(all(a[2] <= b[1] + 1e-6 for a, b in zip(res, res[1:])))

    def test_sin_marcas_se_reparte_la_duracion(self):
        res = R.align_words(["a", "b"], [], 2.0)
        self.assertEqual(res, [("a", 0.0, 1.0), ("b", 1.0, 2.0)])

    def test_las_rayas_sueltas_no_cuentan_como_palabra(self):
        hablados, mapa = R._spoken_tokens("La verdad — dicha así — pesa.")
        self.assertEqual(hablados, ["La", "verdad —", "dicha", "así —", "pesa."])
        self.assertEqual(mapa, [0, 1, 1, 2, 3, 3, 4])

    def test_subtitulos_no_cruzan_frases_ni_escenas(self):
        palabras = [("Una", 0.0, 0.3), ("frase.", 0.3, 0.8), ("Otra", 1.0, 1.3), ("más", 1.3, 1.6), ("larga", 1.6, 2.0), ("aquí", 2.0, 2.3), ("sigue.", 2.3, 2.8)]
        t1 = R.SceneTiming(0.0, 3.0, 3.4, palabras)
        t2 = R.SceneTiming(3.4, 0.0, 5.0, [])
        t3 = R.SceneTiming(8.4, 1.0, 1.5, [("Fin.", 0.1, 0.9)])
        chunks = R.build_subtitle_chunks([t1, t2, t3])
        textos = [" ".join(w for w, _, _ in c[2]) for c in chunks]
        self.assertEqual(textos, ["Una frase.", "Otra más larga aquí", "sigue.", "Fin."])
        self.assertLessEqual(chunks[2][1], 3.4)  # no invade el silencio de la escena siguiente
        self.assertEqual(chunks[3][0], 8.5)
        self.assertTrue(all(a[1] <= b[0] + 1e-6 for a, b in zip(chunks, chunks[1:])))

    def test_fundidos_suman_exactamente_la_duracion(self):
        a, b, c = Path("a.png"), Path("b.png"), Path("c.png")
        original = R._blend_frames
        R._blend_frames = lambda x, y, steps, d: [Path(f"m{i}.png") for i in range(steps)]
        try:
            cortes = [(0.0, a, True), (2.0, b, False), (2.1, c, False), (5.0, a, True)]
            entradas = R._video_entries(cortes, 8.0, Path("."))
        finally:
            R._blend_frames = original
        self.assertAlmostEqual(sum(d for _, d in entradas), 8.0, places=6)
        self.assertTrue(all(d > 0 for _, d in entradas))
        nombres = [p.name for p, _ in entradas]
        self.assertEqual(nombres[0], "a.png")
        self.assertEqual(nombres[:2], ["a.png", "b.png"])  # el hueco de 0,1 s es demasiado corto para fundir
        self.assertEqual(nombres[2], "m0.png")  # el siguiente sí funde
        self.assertEqual(nombres[-1], "a.png")

    def test_srt_reparte_las_frases_largas_sin_dejar_palabras_sueltas(self):
        frase = [(f"p{i}" + ("," if i == 9 else "." if i == 19 else ""), i * 0.3, i * 0.3 + 0.25) for i in range(20)]
        trozos = R._split_balanced(frase)
        self.assertEqual([len(t) for t in trozos], [10, 10])
        self.assertEqual(trozos[0][-1][0], "p9,")
        self.assertEqual(sum(trozos, []), frase)
        self.assertEqual(R._split_balanced(frase[:14]), [frase[:14]])
        self.assertTrue(all(len(t) >= 3 for t in R._split_balanced(frase[:16])))

    def test_tiempo_srt(self):
        self.assertEqual(R._fmt_srt_time(3725.5), "01:02:05,500")
        self.assertEqual(R._fmt_srt_time(59.9996), "00:01:00,000")


if __name__ == "__main__":
    unittest.main()


class EfectosDeSonidoTest(unittest.TestCase):
    def test_pista_sintetizada_repetible_y_mas_baja_que_la_voz(self):
        import array
        import tempfile
        import wave
        from pathlib import Path

        from tools.video import renderer as R

        eventos = [(0.5, "paso"), (1.0, "pieza"), (2.0, "tic"), (3.0, "resp")]
        with tempfile.TemporaryDirectory() as d:
            a = R._pista_sfx(eventos, 4.0, Path(d) / "a.wav")
            b = R._pista_sfx(eventos, 4.0, Path(d) / "b.wav")
            self.assertEqual(a.read_bytes(), b.read_bytes())
            with wave.open(str(a)) as w:
                self.assertEqual((w.getnchannels(), w.getframerate()), (1, R.SAMPLE_RATE))
                pcm = array.array("h", w.readframes(w.getnframes()))
        pico = max(abs(v) for v in pcm) / 32767
        self.assertGreater(pico, 0.03)  # se oye
        self.assertLess(pico, 0.25)  # y queda muy por debajo de la voz (normalizada cerca de 0,85)
        sr = R.SAMPLE_RATE
        self.assertEqual(max(abs(v) for v in pcm[: int(0.45 * sr)]), 0)  # nada antes del primer evento
        for t in (0.6, 1.02, 2.02, 3.05):
            self.assertGreater(max(abs(v) for v in pcm[int(t * sr) : int((t + 0.05) * sr)]), 200, t)
