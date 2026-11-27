import tempfile
import unittest
from pathlib import Path

from tools.video import cola_youtube as C


class ColaTest(unittest.TestCase):
    def test_lee_libros_sin_comentarios(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / "cola.txt"
            ruta.write_text("# una nota\nDecisive\n\n  Range  \n", encoding="utf-8")
            self.assertEqual(C.libros_en_cola(ruta), ["Decisive", "Range"])
            self.assertEqual(C.libros_en_cola(Path(d) / "no-existe.txt"), [])

    def test_lo_ya_subido_no_esta_pendiente(self):
        todo = C.pendientes(50, cola=["Decisive"], filas=[])
        self.assertTrue(todo and todo[0][1])
        filas = [{"libro": "decisive", "pieza": k, "tipo": "", "titulo": "", "youtube": "abcdefghijk", "guion": ""} for k in todo[0][1]]
        self.assertEqual(C.pendientes(50, cola=["Decisive"], filas=filas), [])
        self.assertEqual(sum(len(c) for _, c in C.pendientes(1, cola=["Decisive"], filas=[])), 1)


if __name__ == "__main__":
    unittest.main()
