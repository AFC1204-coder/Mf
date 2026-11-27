"""Imágenes libres: solo con licencia aceptada, solo aprobadas, y siempre con su crédito."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from tools.video import compartir as K
from tools.video import compartir_frames as CF
from tools.video import imagenes_libres as IM
from tools.video import lint as L
from tools.video.corpus import Book, Lesson


class LicenciasTest(unittest.TestCase):
    def test_solo_dominio_publico_cc0_y_cc_by(self):
        for ok in ("Public domain", "CC0", "CC BY 2.0", "CC BY 4.0", "PD-USGov", "No restrictions"):
            self.assertTrue(IM.licencia_aceptada(ok), ok)
        for no in ("", "CC BY-SA 4.0", "CC BY-NC 2.0", "CC BY-ND 2.0", "CC BY-NC-SA 3.0", "Fair use", "Copyrighted free use", "GFDL"):
            self.assertFalse(IM.licencia_aceptada(no), no)

    def test_credito(self):
        e = {"titulo": "File:Wooden signpost.jpg", "autor": "Steve H.", "licencia": "CC BY 2.0"}
        self.assertEqual(IM.credito(e), "Foto: Steve H. · CC BY 2.0")
        self.assertEqual(IM.credito({"autor": "", "licencia": "Public domain"}), "Foto: Public domain")
        self.assertEqual(IM.credito_largo(e), "«Wooden signpost», de Steve H. (CC BY 2.0, Wikimedia Commons)")


class CatalogoTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "archivos").mkdir()
        for n in ("a.jpg", "b.jpg", "c.jpg"):
            (self.dir / "archivos" / n).write_bytes(b"\xff\xd8\xff\xd9")
        self._previo = (IM.DIR, IM.ARCHIVOS, os.environ.pop("IMAGENES_PROPUESTAS", None))
        IM.DIR, IM.ARCHIVOS = self.dir, self.dir / "archivos"
        self._escribe(True)

    def tearDown(self):
        IM.DIR, IM.ARCHIVOS = self._previo[:2]
        if self._previo[2] is not None:
            os.environ["IMAGENES_PROPUESTAS"] = self._previo[2]
        IM.catalogo(recargar=True)
        self.tmp.cleanup()

    def _escribe(self, aprobado: bool, licencia: str = "CC BY 2.0") -> None:
        datos = {
            "libro_id": "B",
            "retrato": {"archivo": "b.jpg", "titulo": "File:Autor.jpg", "autor": "Ana", "licencia": "Public domain", "aprobado": aprobado},
            "lecciones": [
                {"leccion_id": "L1", "archivo": "a.jpg", "titulo": "File:Cruce.jpg", "autor": "Steve H.", "licencia": licencia, "aprobado": aprobado},
                {"leccion_id": "L2", "archivo": "no-existe.jpg", "titulo": "File:X.jpg", "autor": "X", "licencia": "CC0", "aprobado": True},
            ],
        }
        (self.dir / "libro.json").write_text(json.dumps(datos), encoding="utf-8")
        IM.catalogo(recargar=True)

    def _libro(self):
        lec = Lesson(id="L1", titulo="Ampliar las opciones", orden=1, cuerpo="\n\n".join(["Decidir entre una sola opción y nada es decidir a ciegas. " * 6] * 3),
                     idea_clave="Considerar al menos dos alternativas reales mejora el resultado.", autocorreccion="Demasiadas alternativas pueden paralizar.")
        return Book(id="B", titulo="Decisive", autor="Chip Heath", eje="Psicología y Conducta", descripcion="", lessons=[lec])

    def test_solo_entran_las_aprobadas_con_archivo(self):
        self.assertEqual(set(IM.catalogo()), {("autor", "B"), ("leccion", "L1")})
        self._escribe(False)
        self.assertEqual(IM.catalogo(), {})
        os.environ["IMAGENES_PROPUESTAS"] = "1"
        self.assertEqual(set(IM.catalogo(recargar=True)), {("autor", "B"), ("leccion", "L1")})
        os.environ.pop("IMAGENES_PROPUESTAS")

    def test_una_licencia_no_aceptada_no_entra_aunque_este_aprobada(self):
        self._escribe(True, licencia="CC BY-SA 4.0")
        self.assertNotIn(("leccion", "L1"), IM.catalogo())

    def test_la_pieza_lleva_la_imagen_su_credito_en_pantalla_y_en_la_descripcion(self):
        book = self._libro()
        pieza = K.pieza_idea(book, 0)
        idea = pieza.scenes[0]
        self.assertEqual(idea.view["foto"], {"src": "a.jpg", "credito": "Foto: Steve H. · CC BY 2.0"})
        credito = next(s for s in pieza.scenes if s.kind == "c-credito")
        self.assertEqual(credito.view["foto"]["src"], "b.jpg")
        self.assertIn("Imágenes: ", pieza.descripcion_pub)
        self.assertIn("«Cruce», de Steve H. (CC BY 2.0, Wikimedia Commons)", pieza.descripcion_pub)
        estados, paginas = CF.pieza_pages(pieza)
        self.assertIn('class="cs-foto "', paginas[0])
        self.assertIn("Foto: Steve H. · CC BY 2.0", paginas[0])
        self.assertIn("cs-foto retrato", next(h for st, h in zip(estados, paginas) if pieza.scenes[st.scene_index].kind == "c-credito"))
        self.assertFalse(L.has_errors(L.lint_pieza(pieza, book)), [str(i) for i in L.lint_pieza(pieza, book) if i.level == "error"])

    def test_sin_aprobar_la_pieza_sale_sin_imagen(self):
        self._escribe(False)
        pieza = K.pieza_idea(self._libro(), 0)
        self.assertFalse(any("foto" in s.view for s in pieza.scenes))
        self.assertNotIn("Imágenes:", pieza.descripcion_pub)

    def test_el_lint_rechaza_una_imagen_fuera_del_catalogo_o_con_el_credito_cambiado(self):
        book = self._libro()
        pieza = K.pieza_idea(book, 0)
        pieza.scenes[0].view["foto"] = {"src": "c.jpg", "credito": "Foto: alguien"}
        self.assertTrue(any("imagen que no está aprobada" in i.message for i in L.lint_pieza(pieza, book)))
        pieza = K.pieza_idea(book, 0)
        pieza.scenes[0].view["foto"]["credito"] = "Foto: otro · CC BY 2.0"
        self.assertTrue(L.has_errors(L.lint_pieza(pieza, book)))


if __name__ == "__main__":
    unittest.main()
