"""Registro de vídeos subidos → índice de la web."""

import json
import tempfile
import unittest
from pathlib import Path

from tools.video import publicados as P

ID1, ID2 = "dQw4w9WgXcQ", "abcdefghijk"


def _libro(output: Path, slug: str, piezas: list[dict], guiones: dict[str, str]) -> None:
    base = output / slug / "compartir" / "9x16"
    base.mkdir(parents=True)
    (base / "manifiesto.json").write_text(json.dumps({"libro_id": "B1", "titulo": "Libro", "piezas": piezas}), encoding="utf-8")
    for clave, g in guiones.items():
        (base / clave).mkdir()
        (base / clave / "pieza.json").write_text(json.dumps({"huella": {"guion": g}}), encoding="utf-8")


PIEZAS = [
    {"clave": "libro", "tipo": "libro", "leccion_id": "", "titulo": "Libro en 5 ideas", "video": "libro/video.mp4", "duracion_s": 44.7, "estado": "ok"},
    {"clave": "idea-01-a", "tipo": "idea", "leccion_id": "L1", "titulo": "A", "video": "idea-01-a/video.mp4", "duracion_s": 117.5, "estado": "sin-cambios"},
    {"clave": "fondo-01-a", "tipo": "fondo", "leccion_id": "L1", "titulo": "A", "video": "fondo-01-a/video.mp4", "duracion_s": 290, "estado": "ok"},
    {"clave": "idea-02-b", "tipo": "idea", "leccion_id": "L2", "titulo": "B", "video": None, "duracion_s": 0, "estado": "error"},
]
GUIONES = {"libro": "g0", "idea-01-a": "g1", "fondo-01-a": "g2"}


class IdYoutube(unittest.TestCase):
    def test_formas_de_enlace(self):
        for v in (ID1, f"https://youtu.be/{ID1}", f"https://www.youtube.com/watch?v={ID1}&t=3s", f"https://youtube.com/shorts/{ID1}?feature=share",
                  f"https://www.youtube.com/embed/{ID1}", f"https://studio.youtube.com/video/{ID1}/edit", f"  {ID1}  "):
            self.assertEqual(P.id_youtube(v), ID1, v)

    def test_lo_que_no_es_un_video(self):
        for v in ("", "pendiente", "https://www.youtube.com/@canal", "https://vimeo.com/123456789", "abc"):
            self.assertIsNone(P.id_youtube(v), v)


class Registro(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.out, self.csv, self.idx = self.dir / "output", self.dir / "publicados.csv", self.dir / "datos" / "videos.json"
        _libro(self.out, "libro", PIEZAS, GUIONES)

    def tearDown(self):
        self.tmp.cleanup()

    def _pon(self, pieza: str, enlace: str) -> None:
        filas = P.leer_csv(self.csv)
        next(f for f in filas if f["pieza"] == pieza)["youtube"] = enlace
        P.escribir_csv(self.csv, filas)

    def _indice(self) -> dict:
        return json.loads(self.idx.read_text(encoding="utf-8"))

    def test_primera_pasada_lista_solo_lo_renderizado_y_no_publica_nada(self):
        recuento, avisos = P.actualizar(self.csv, self.idx, self.out)
        self.assertEqual([f["pieza"] for f in P.leer_csv(self.csv)], ["libro", "idea-01-a", "fondo-01-a"])
        self.assertEqual((recuento["filas"], recuento["con_enlace"], recuento["publicados"]), (3, 0, 0))
        self.assertEqual(avisos, [])
        self.assertEqual(self._indice(), {"v": 1, "lecciones": {}, "libros": {}})

    def test_con_enlace_entra_en_el_indice_por_leccion_y_por_libro(self):
        P.actualizar(self.csv, self.idx, self.out)
        self._pon("idea-01-a", f"https://youtube.com/shorts/{ID1}")
        self._pon("libro", ID2)
        recuento, avisos = P.actualizar(self.csv, self.idx, self.out)
        self.assertEqual(avisos, [])
        self.assertEqual(recuento["publicados"], 2)
        self.assertEqual(self._indice()["lecciones"], {"L1": {"idea": {"yt": ID1, "s": 118}}})
        self.assertEqual(self._indice()["libros"], {"B1": {"libro": {"yt": ID2, "s": 45}}})
        fila = next(f for f in P.leer_csv(self.csv) if f["pieza"] == "idea-01-a")
        self.assertEqual(fila["guion"], f"{ID1}:g1")
        self.assertEqual(fila["youtube"], f"https://youtube.com/shorts/{ID1}")  # lo escrito a mano no se toca

    def test_si_el_guion_cambia_el_video_deja_de_publicarse_hasta_cambiar_el_enlace(self):
        P.actualizar(self.csv, self.idx, self.out)
        self._pon("idea-01-a", ID1)
        P.actualizar(self.csv, self.idx, self.out)
        (self.out / "libro/compartir/9x16/idea-01-a/pieza.json").write_text(json.dumps({"huella": {"guion": "NUEVO"}}), encoding="utf-8")
        recuento, avisos = P.actualizar(self.csv, self.idx, self.out)
        self.assertEqual(recuento["publicados"], 0)
        self.assertTrue(any("guion ha cambiado" in a for a in avisos))
        self.assertEqual(self._indice()["lecciones"], {})
        # Vídeo nuevo: basta con cambiar el enlace.
        self._pon("idea-01-a", ID2)
        recuento, avisos = P.actualizar(self.csv, self.idx, self.out)
        self.assertEqual(recuento["publicados"], 1)
        self.assertEqual(self._indice()["lecciones"]["L1"]["idea"]["yt"], ID2)

    def test_enlace_invalido_o_repetido_no_se_publica_y_avisa(self):
        P.actualizar(self.csv, self.idx, self.out)
        self._pon("idea-01-a", "lo subo luego")
        self._pon("fondo-01-a", ID1)
        self._pon("libro", ID1)
        recuento, avisos = P.actualizar(self.csv, self.idx, self.out)
        self.assertEqual(recuento["publicados"], 0)
        self.assertTrue(any("no es un enlace" in a for a in avisos))
        self.assertTrue(any("mismo vídeo" in a for a in avisos))

    def test_un_libro_no_generado_en_este_equipo_conserva_sus_videos(self):
        P.actualizar(self.csv, self.idx, self.out)
        self._pon("idea-01-a", ID1)
        P.actualizar(self.csv, self.idx, self.out)
        vacio = self.dir / "otro-equipo"
        vacio.mkdir()
        recuento, _ = P.actualizar(self.csv, self.idx, vacio)
        self.assertEqual(recuento["publicados"], 1)
        self.assertEqual(self._indice()["lecciones"]["L1"]["idea"]["yt"], ID1)
        self.assertEqual(len(P.leer_csv(self.csv)), 3)  # tampoco se pierden filas
        # …pero si se quita el enlace, desaparece también de la web.
        self._pon("idea-01-a", "")
        recuento, _ = P.actualizar(self.csv, self.idx, vacio)
        self.assertEqual(recuento["publicados"], 0)


if __name__ == "__main__":
    unittest.main()
