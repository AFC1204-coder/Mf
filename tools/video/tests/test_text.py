import unittest

from tools.video import text as T


class Frases(unittest.TestCase):
    def test_no_corta_en_abreviaturas_iniciales_ni_decimales(self):
        texto = "El Dr. Pérez midió 3.5 puntos. B. F. Skinner lo discutió (p. ej. en 1953). ¿Y qué pasó después? Nada."
        self.assertEqual(
            T.split_sentences(texto),
            ["El Dr. Pérez midió 3.5 puntos.", "B. F. Skinner lo discutió (p. ej. en 1953).", "¿Y qué pasó después? Nada."],
        )

    def test_los_restos_diminutos_se_unen_a_la_frase_anterior(self):
        self.assertEqual(T.split_sentences("Lo intentó tres veces seguidas. Falló."), ["Lo intentó tres veces seguidas. Falló."])

    def test_no_corta_dentro_de_comillas_ni_parentesis(self):
        texto = "Dijo «No. Nunca. Jamás» y se fue. Luego volvió (tarde. Muy tarde) a casa."
        self.assertEqual(len(T.split_sentences(texto)), 2)

    def test_reconstruye_el_texto_original(self):
        texto = "Una frase. Otra frase con «cita». ¿Una pregunta? Sí."
        self.assertEqual(" ".join(T.split_sentences(texto)), texto)

    def test_take_sentences_nunca_parte_una_frase(self):
        texto = "Primera frase corta. Segunda frase algo más larga que la primera. Tercera."
        self.assertEqual(T.take_sentences(texto, 5), "Primera frase corta.")
        self.assertEqual(T.take_sentences(texto, 1), "Primera frase corta.")  # al menos una entera
        self.assertTrue(texto.startswith(T.take_sentences(texto, 12)))


class Rotulos(unittest.TestCase):
    def test_shorten_es_prefijo_literal(self):
        frase = "La hipótesis central del libro es que el tatuaje funciona como dispositivo de compromiso, una inversión irreversible en la identidad"
        corto = T.shorten_clause(frase, 14)
        self.assertTrue(corto.endswith("…"))
        self.assertTrue(frase.startswith(corto[:-1]))
        self.assertLessEqual(T.n_words(corto), 14)

    def test_shorten_no_toca_lo_que_cabe(self):
        self.assertEqual(T.shorten_clause("Una frase breve.", 10), "Una frase breve.")


class Voz(unittest.TestCase):
    def test_flechas_y_rayas_pasan_a_pausas_sin_perder_palabras(self):
        original = "Cambia «¿Por qué?» → «¿Qué pasó?» — con calma — y observa."
        hablado = T.for_speech(original)
        self.assertNotIn("→", hablado)
        self.assertNotIn("—", hablado)
        self.assertEqual(T.content_tokens(original), T.content_tokens(hablado))

    def test_abreviaturas_habladas(self):
        self.assertIn("por ejemplo", T.for_speech("Usa algo (ej: un diario) cada día."))


class Terminos(unittest.TestCase):
    def test_comillas_y_nombres_propios(self):
        texto = "La idea viene de Daniel Kahneman, que la llamó «efecto de anclaje» en 1974."
        terminos = dict(T.key_terms(texto))
        self.assertIn("Daniel Kahneman", terminos)
        self.assertIn("efecto de anclaje", terminos)
        self.assertEqual(texto.split()[terminos["Daniel Kahneman"]], "Daniel")

    def test_la_mayuscula_de_inicio_de_frase_no_cuenta(self):
        self.assertEqual(T.key_terms("Esto ocurre siempre. Nadie lo nota."), [])
        self.assertEqual(T.key_terms("Siempre pasa. El Dr. Pérez lo midió."), [("Dr. Pérez", 3)])

    def test_tras_signo_de_apertura_empieza_frase(self):
        texto = 'Cambia «¿Seguimos adelante?» por una pregunta abierta. Lo dijo "¡Bienvenido a casa!" entonces.'
        self.assertEqual(T.key_terms(texto), [])

    def test_excluye_lo_que_ya_esta_a_la_vista(self):
        texto = "Lo estudió Daniel Kahneman con cuidado."
        self.assertEqual(T.key_terms(texto, exclude=["Daniel Kahneman, premio Nobel"]), [])

    def test_las_pistas_de_una_palabra_no_valen(self):
        self.assertEqual(T.key_terms("el poder cambia a quien lo tiene", hints=["poder"]), [])
        self.assertEqual([t for t, _ in T.key_terms("la carga cognitiva pesa", hints=["Carga cognitiva"])], ["carga cognitiva"])


if __name__ == "__main__":
    unittest.main()
