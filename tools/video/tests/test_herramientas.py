"""Quinta vuelta: enumeraciones del propio texto, apartados de ampliación, segunda pregunta y ámbitos. Sin red."""

import unittest

from tools.video import compartir as K
from tools.video import compartir_frames as CF
from tools.video import lint as L
from tools.video.corpus import Lesson, Question
from tools.video.tests import fixtures as F
from tools.video.tests.test_compartir import _libro


def _errores(pieza, libro):
    return [str(i) for i in L.lint_pieza(pieza, libro) if i.level == "error"]


class EnumeracionTest(unittest.TestCase):
    def test_ordinales_con_el_arranque_literal_de_cada_punto(self):
        t = "Falla por tres razones. Primero, impide aprender: nadie corrige. Segundo, impide colaborar: nadie cede. Tercero, impide adaptarse."
        puntos = K.enumeracion(t.split())
        self.assertEqual([r for _, r in puntos], ["Primero, impide aprender", "Segundo, impide colaborar", "Tercero, impide adaptarse"])
        self.assertEqual([t.split()[i] for i, _ in puntos], ["Primero,", "Segundo,", "Tercero,"])

    def test_si_un_arranque_es_largo_todos_van_por_su_ordinal(self):
        t = "Primero, es completa. Segundo, está pensada para trabajar con esa psicología y no contra ella en ningún caso."
        self.assertEqual([r for _, r in K.enumeracion(t.split())], ["Primero", "Segundo"])

    def test_numerales_entre_parentesis(self):
        t = "Aplica las leyes: (1) ¿cuál será la señal? —defínela; (2) ¿cómo lo harás atractivo? —combínalo con algo."
        self.assertEqual([r for _, r in K.enumeracion(t.split())], ["¿cuál será la señal?", "¿cómo lo harás atractivo?"])
        t = "Tiene tres partes: (1) dedicar tiempo al silencio, (2) revisar el rumbo, y (3) practicar el desapego."
        self.assertEqual([r for _, r in K.enumeracion(t.split())], ["dedicar tiempo al silencio", "revisar el rumbo", "practicar el desapego"])

    def test_no_inventa_enumeraciones(self):
        for t in (
            "El primero de ellos llegó tarde y el segundo no llegó.",  # ordinales que no abren frase
            "Primero, una cosa. Luego otra.",  # un solo punto
            "Segundo, esto. Tercero, aquello.",  # no empieza por el primero
            "Lo dice en (2) y en (3).",
        ):
            self.assertEqual(K.enumeracion(t.split()), [], t)

    def test_la_lista_se_enciende_cuando_la_voz_llega_a_cada_punto(self):
        t = "Falla por tres razones. Primero, impide aprender: nadie corrige nada nunca. Segundo, impide colaborar: nadie cede. Tercero, impide adaptarse."
        escena = K.escena_frase("Explicación", "explica", K.ROTULOS["explica"], [K.Part(t, "leccion.cuerpo")])
        self.assertTrue(K.enumerar(escena))
        estados = CF.estados(escena)
        self.assertEqual(estados[0]["fig"]["patron"], "enumera")
        self.assertEqual(estados[0]["fig_on"], [])
        self.assertEqual(estados[-1]["fig_on"], [0, 1, 2])
        for v in estados:  # un punto nunca está encendido antes de que su ordinal se haya dicho
            dichas = " ".join(v["words"][: v["shown"]])
            for j in v["fig_on"]:
                self.assertIn(("Primero,", "Segundo,", "Tercero,")[j], dichas)
        self.assertIn("cp-enumera", CF._stage_frase(estados[-1], "")[0])
        sin = K.escena_frase("Explicación", "explica", K.ROTULOS["explica"], [K.Part("Una frase cualquiera sin lista.", "leccion.cuerpo")])
        self.assertFalse(K.enumerar(sin))


class FondoAmpliadoTest(unittest.TestCase):
    CUERPO = "La primera respuesta que da la mente suele llegar deprisa y con mucha seguridad. " * 3 + "\n\n" + "Pararse un momento antes de contestar permite revisar si esa respuesta rápida se sostiene o no. " * 3

    def _fondo(self, **cambios):
        libro = _libro(**{"l-1": {"cuerpo": self.CUERPO, **cambios}})
        k = next(i for i, l in enumerate(libro.lessons) if l.id == "l-1")
        return libro, K.pieza_fondo(libro, k)

    def _con_preguntas(self, preguntas):
        libro = _libro(**{"l-1": {"cuerpo": self.CUERPO}}, preguntas=preguntas)
        k = next(i for i, l in enumerate(libro.lessons) if l.id == "l-1")
        return libro, K.pieza_fondo(libro, k), libro.lessons[k]

    def test_los_detalles_entran_enteros_con_su_titulo(self):
        detalle = {"titulo": "Un apartado de ampliación", "cuerpo": "Primera frase del apartado, que es suficientemente larga para contar como texto. " * 3 + "\n\nSegundo párrafo del apartado, también con su extensión para que se vea entero en pantalla."}
        libro, p = self._fondo(detalles=[detalle, {"titulo": "", "cuerpo": "sin título no entra"}])
        escenas = [s for s in p.scenes if s.view.get("kicker") == K.ROTULOS["detalle"]]
        self.assertEqual(len(escenas), 2)  # una por párrafo
        self.assertEqual(escenas[0].view["tema"], "Un apartado de ampliación")
        self.assertTrue(escenas[0].narration.startswith("Un apartado de ampliación. Primera frase"))
        self.assertNotIn("Un", escenas[0].view["words"][:1])  # el título lo dice la voz y lo enseña el rótulo, no el texto
        self.assertEqual(_errores(p, libro), [])
        # Un apartado que alude a la serie de la web, o demasiado largo para ir entero, no entra.
        _, p2 = self._fondo(detalles=[{"titulo": "Otro", "cuerpo": "Como vimos en la lección anterior, esto sigue igual. " * 4}])
        self.assertFalse([s for s in p2.scenes if s.view.get("kicker") == K.ROTULOS["detalle"]])
        _, p3 = self._fondo(detalles=[{"titulo": "Largo", "cuerpo": "palabra " * 300}])
        self.assertFalse([s for s in p3.scenes if s.view.get("kicker") == K.ROTULOS["detalle"]])

    def test_segunda_pregunta_distinta_y_con_su_respuesta(self):
        q1 = F.PREGUNTAS[0]
        otra = dict(q1, id="q-otra", texto="¿Qué ocurre cuando una señal se repite muchos días seguidos?", opciones=["Que el gesto acaba saliendo solo, sin decidirlo.", "Nada en absoluto.", "Que se olvida."], correcta=0, explicacion="La repetición lo automatiza.")
        libro, p, leccion = self._con_preguntas([*F.PREGUNTAS, otra])
        preguntas = [x.text for s in p.scenes for x in s.parts if x.origin == "pregunta.texto"]
        self.assertEqual(len(K.preguntas_autonomas(leccion)), 2)
        self.assertEqual(len(preguntas), 2)
        self.assertEqual(len(set(preguntas)), 2)
        self.assertTrue(any(s.view.get("kicker") == K.ROTULOS["comprueba2"] for s in p.scenes))
        self.assertEqual(_errores(p, libro), [])
        # La misma pregunta repetida no cuenta como segunda.
        repetida = dict(q1, id="q-rep")
        libro2, p2, _ = self._con_preguntas([*F.PREGUNTAS, repetida])
        self.assertEqual(len([x for s in p2.scenes for x in s.parts if x.origin == "pregunta.texto"]), 1)
        self.assertEqual(_errores(p2, libro2), [])

    def test_el_control_rechaza_una_respuesta_cruzada(self):
        q1 = F.PREGUNTAS[0]
        otra = dict(q1, id="q-otra", texto="¿Qué ocurre cuando una señal se repite muchos días seguidos?", opciones=["Que el gesto acaba saliendo solo, sin decidirlo.", "Nada en absoluto.", "Que se olvida."], correcta=0, explicacion="La repetición lo automatiza.")
        libro, p, _ = self._con_preguntas([*F.PREGUNTAS, otra])
        respuestas = [x for s in p.scenes for x in s.parts if x.origin == "pregunta.opcion"]
        self.assertEqual(len(respuestas), 2)
        respuestas[0].text, respuestas[1].text = respuestas[1].text, respuestas[0].text
        self.assertTrue(any("no es la opción correcta" in e for e in _errores(p, libro)))

    def test_ambitos_literales_y_solo_si_no_hay_enumeracion(self):
        libro, p = self._fondo(dominio_aplicacion=["hábitos", "trabajo", "salud"])
        practica = next(s for s in p.scenes if s.section == "Práctica")
        fig = practica.view.get("fig") or {}
        self.assertEqual(fig.get("patron"), "ambitos")
        self.assertEqual([x["t"] for x in fig["pieces"]], ["hábitos", "trabajo", "salud"])
        self.assertEqual(fig["kicker"], K.ROTULOS["ambitos"])
        self.assertEqual(practica.view["fig_on"], [0, 1, 2])
        self.assertEqual(_errores(p, libro), [])
        _, uno = self._fondo(dominio_aplicacion=["hábitos"])
        self.assertNotEqual((next(s for s in uno.scenes if s.section == "Práctica").view.get("fig") or {}).get("patron"), "ambitos")


if __name__ == "__main__":
    unittest.main()
