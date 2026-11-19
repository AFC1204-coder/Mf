import unittest

from tools.video import frames as F
from tools.video import guia as G
from tools.video import scriptwriter as SW
from tools.video.tests.fixtures import libro


def pasos(*titulos):
    return {"plantilla": "pasos", "datos": {"pasos": [{"t": t[0], "d": t[1] if len(t) > 1 else ""} for t in titulos]}}


class Piezas(unittest.TestCase):
    def test_solo_las_plantillas_con_cajas_y_entre_dos_y_seis_piezas(self):
        self.assertEqual(len(G.pieces(pasos(("Uno",), ("Dos",)))), 2)
        self.assertEqual(G.pieces(pasos(("Uno",))), [])
        self.assertEqual(G.pieces(pasos(*[(f"P{i}",) for i in range(7)])), [])
        self.assertEqual(G.pieces({"plantilla": "cifras", "datos": {"items": [{"n": "1", "t": "x"}, {"n": "2", "t": "y"}]}}), [])
        self.assertEqual(G.pieces(None), [])
        self.assertEqual(G.pieces(pasos(("Uno",), ("",))), [])  # una pieza sin título no se puede nombrar

    def test_comparar_tiene_dos_piezas_con_sus_elementos(self):
        ps = G.pieces({"plantilla": "comparar", "datos": {"izq": {"t": "A", "items": ["a1", "a2"], "tono": "mal"}, "der": {"t": "B", "items": ["b1"]}}})
        self.assertEqual([(p.t, p.items, p.tone) for p in ps], [("A", ["a1", "a2"], "mal"), ("B", ["b1"], "a")])
        self.assertEqual(ps[0].lines, ["A", "a1", "a2"])


class Emparejamiento(unittest.TestCase):
    PIEZAS = G.pieces(pasos(("Se prueban conductas", "Los individuos ensayan estrategias"), ("Los resultados filtran", "Unas conductas se refuerzan y otras se descartan"), ("Se transmiten", "Pasan a otros por imitación")))

    def test_la_pieza_se_nombra_en_la_palabra_donde_empieza_a_hablarse_de_ella(self):
        bloque = ("Al principio los individuos ensayan distintas estrategias sin saber cuál funciona. "
                  "Después los resultados filtran: unas conductas se refuerzan y otras se descartan casi siempre.")
        ms = G.mentions(bloque, self.PIEZAS)
        self.assertEqual([j for j, _ in ms], [0, 1])
        self.assertLess(ms[0][1], ms[1][1])
        palabras = bloque.split()
        self.assertTrue(palabras[ms[1][1]].lower().strip(":,.").startswith(("resul", "filtr", "unas", "conduc")))

    def test_ante_la_duda_no_ilumina_nada(self):
        self.assertEqual(G.mentions("Un equilibrio de Nash es una situación en la que ningún jugador gana cambiando su estrategia por su cuenta.", self.PIEZAS), [])
        self.assertEqual(G.mentions("Texto que no tiene nada que ver con las piezas del esquema.", self.PIEZAS), [])

    def test_una_sola_coincidencia_suelta_no_basta(self):
        self.assertEqual(G.mentions("Las estrategias del ajedrez son muy variadas.", self.PIEZAS), [])

    def test_dos_piezas_no_se_iluminan_a_la_vez(self):
        ps = G.pieces(pasos(("Alfa beta gamma",), ("Alfa beta delta",)))
        ms = G.mentions("alfa beta gamma delta", ps, theta=0.2, min_gap=4)
        self.assertLessEqual(len(ms), 1)

    def test_la_pieza_inicial_solo_si_se_nombra_al_empezar(self):
        ini, cambios = G.timeline("Los individuos ensayan distintas estrategias para ver cuál funciona. Con el tiempo se transmiten por imitación a otros.", self.PIEZAS, offset=3)
        self.assertEqual(ini, 0)
        self.assertTrue(all(w >= 3 for w, _ in cambios))
        ini2, cambios2 = G.timeline("Pasa mucho tiempo antes de que nadie note nada raro, pero los resultados filtran unas conductas que se refuerzan y otras que se descartan.", self.PIEZAS)
        self.assertEqual(ini2, -1)
        self.assertEqual([j for _, j in cambios2], [1])


class Pantallas(unittest.TestCase):
    def setUp(self):
        self.b = libro()
        self.b.lessons[1].diagramas = [{"tipo": "diagrama", "plantilla": "pasos", "titulo": "Anclaje", "pie": "Pie.", "datos": {"pasos": [{"t": "Número inicial", "d": "Sesga"}, {"t": "Ruleta", "d": "También ancla"}, {"t": "Tu cifra", "d": "Antes"}]}}]
        self.ep = SW.lesson_episode(self.b, 1)

    def _html(self, modo, i=0):
        esc = [s for s in self.ep.scenes if s.kind == "guia" and s.view["mode"] == modo]
        s = esc[i]
        return F.frame_html(self.ep, s, s.view, self.ep.scenes.index(s))

    def test_la_leyenda_numera_los_titulos_y_marca_la_activa(self):
        doc = self._html("legend")
        self.assertIn('<li class=""><i>1</i><span>Número inicial</span></li>', doc)
        s = next(s for s in self.ep.scenes if s.kind == "guia" and s.view["mode"] == "legend")
        doc = F.frame_html(self.ep, s, dict(s.view, active=1), 0)
        self.assertIn('<li class="on"><i>2</i><span>Ruleta</span></li>', doc)

    def test_la_tarjeta_de_la_pieza_dice_que_pieza_es(self):
        doc = self._html("piece", 1)
        self.assertIn("2 DE 3", doc)
        self.assertIn("<b>Ruleta</b>", doc)
        self.assertIn("También ancla", doc)

    def test_al_recordar_se_pregunta_cuantas_piezas_y_hay_cuenta_atras(self):
        doc = self._html("ask", 1)
        self.assertIn("¿Cuáles eran las 3 piezas?", doc)
        self.assertIn("PIENSA TU RESPUESTA", doc)

    def test_frame_js_recibe_el_estado_de_la_guia(self):
        doc = self._html("piece", 2)
        self.assertIn('"guide": true', doc)
        self.assertIn('"order": [0, 1, 2]', doc)
        self.assertIn('"active": 2', doc)
        self.assertIn('"shown": 3', doc)

    def test_el_desarrollo_guiado_sustituye_la_ancla_por_la_tarjeta_cuando_hay_pieza(self):
        dev = next(s for s in self.ep.scenes if s.section == "Desarrollo")
        sin = F.frame_html(self.ep, dev, dict(dev.view, active=-1), 3)
        con = F.frame_html(self.ep, dev, dict(dev.view, active=0), 3)
        self.assertIn("vf-card", sin)
        self.assertNotIn("vf-piece", sin)
        self.assertIn("vf-piece", con)
        self.assertNotIn("vf-card", con)


if __name__ == "__main__":
    unittest.main()
