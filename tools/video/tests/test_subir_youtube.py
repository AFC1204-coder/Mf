"""La subida a YouTube: qué se sube y con qué texto (sin red)."""

from __future__ import annotations

import unittest

from tools.video import subir_youtube as Y


class SubirYoutubeTest(unittest.TestCase):
    PUB = {"youtube_shorts": {"titulo": "Idea a idea: Decisive #Shorts", "descripcion": "Un proceso para decidir mejor.\n\n#MenteFría #libros"}}

    def test_metadatos_salen_de_la_publicacion_sin_anadir_texto(self):
        m = Y.metadatos(self.PUB, 120, "private")
        self.assertEqual(m["snippet"]["title"], "Idea a idea: Decisive #Shorts")
        self.assertEqual(m["snippet"]["description"], self.PUB["youtube_shorts"]["descripcion"])
        self.assertEqual(m["snippet"]["tags"], ["MenteFría", "libros"])
        self.assertEqual(m["status"], {"privacyStatus": "private", "selfDeclaredMadeForKids": False})

    def test_un_video_largo_no_se_marca_como_short(self):
        self.assertEqual(Y.metadatos(self.PUB, 240, "unlisted")["snippet"]["title"], "Idea a idea: Decisive")

    def test_sin_titulo_no_se_sube(self):
        with self.assertRaises(ValueError):
            Y.metadatos({"youtube_shorts": {"descripcion": "x"}}, 60, "private")

    def test_pendientes_solo_renderizadas_y_sin_enlace(self):
        filas = [
            {"libro": "decisive", "pieza": "presentacion", "tipo": "presentacion", "youtube": ""},
            {"libro": "decisive", "pieza": "fondo-01-x", "tipo": "fondo", "youtube": "dQw4w9WgXcQ"},
            {"libro": "decisive", "pieza": "fondo-02-x", "tipo": "fondo", "youtube": ""},
            {"libro": "range", "pieza": "libro", "tipo": "libro", "youtube": ""},
        ]
        hechas = {("decisive", "presentacion"): {}, ("decisive", "fondo-01-x"): {}, ("range", "libro"): {}}
        self.assertEqual([f["pieza"] for f in Y.pendientes(filas, hechas)], ["presentacion", "libro"])
        self.assertEqual([f["pieza"] for f in Y.pendientes(filas, hechas, libro="range")], ["libro"])
        self.assertEqual(Y.pendientes(filas, hechas, tipos={"fondo"}), [])


if __name__ == "__main__":
    unittest.main()
