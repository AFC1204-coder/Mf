"""La propuesta de lecciones con vídeo y el archivo que la corrige a mano."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.video import seleccion as S
from tools.video.tests.fixtures import libro


class SeleccionTest(unittest.TestCase):
    def setUp(self):
        self.book = libro()

    def test_cuantas_por_libro(self):
        self.assertEqual([S.cuantas(n) for n in (3, 4, 5, 9, 10, 24)], [2, 2, 3, 3, 4, 4])

    def test_el_mapa_sube_la_leccion_que_le_corresponde(self):
        le = self.book.lessons[-1]
        self.book.mapa = {"nodos": [{"etiqueta": le.titulo, "texto": ""}], "cierre": "x"}
        self.assertEqual(S.del_mapa(self.book), {len(self.book.lessons) - 1: [le.titulo]})
        fila = S.puntuar(self.book)[-1]
        self.assertTrue(any("mapa" in m for m in fila.motivos))

    def test_propone_como_mucho_las_que_tocan_y_solo_posibles(self):
        filas = S.puntuar(self.book)
        propuestas = [f for f in filas if f.propuesta]
        self.assertLessEqual(len(propuestas), S.cuantas(len(filas)))
        self.assertTrue(all(f.posible for f in propuestas))

    def test_la_decision_a_mano_manda_y_se_conserva(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / "seleccion.csv"
            S.anotar([self.book], ruta)
            antes = S.elegidas(self.book, ruta)
            filas = S.leer(ruta)
            fuera = next(n for n in range(1, len(self.book.lessons) + 1) if n not in antes) if len(antes) < len(self.book.lessons) else None
            dentro = min(antes)
            texto = ruta.read_text(encoding="utf-8").splitlines()
            nuevo = [texto[0]]
            for linea in texto[1:]:
                n = int(linea.split(",")[2]) if linea.split(",")[2].isdigit() else None
                id_dentro, id_fuera = self.book.lessons[dentro - 1].id, self.book.lessons[fuera - 1].id if fuera else ""
                if id_dentro in linea:
                    linea += "no"
                elif id_fuera and id_fuera in linea:
                    linea += "sí"
                nuevo.append(linea)
            ruta.write_text("\n".join(nuevo) + "\n", encoding="utf-8")
            despues = S.elegidas(self.book, ruta)
            self.assertNotIn(dentro, despues)
            if fuera:
                self.assertIn(fuera, despues)
            S.anotar([self.book], ruta)  # regenerar no borra lo decidido
            self.assertEqual(S.elegidas(self.book, ruta), despues)
            self.assertEqual(len(S.leer(ruta)), len(filas))


if __name__ == "__main__":
    unittest.main()
