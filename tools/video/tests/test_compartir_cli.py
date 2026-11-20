"""Filtros del plan y calendario de publicación de las piezas compartibles. Sin red, sin Chrome y sin voz."""

from __future__ import annotations

import argparse
import json
import tempfile
import unittest
from pathlib import Path

from tools.video import cli
from tools.video import compartir as K
from tools.video.tests import fixtures as F


class FiltrosTest(unittest.TestCase):
    def setUp(self):
        self.plan = K.plan_libro(F.libro())

    def test_sin_filtros_el_plan_no_cambia(self):
        self.assertIs(cli._filtra_plan(self.plan, argparse.Namespace(max_seg=None, excluir=None)), self.plan)

    def test_max_seg_deja_fuera_las_largas_y_lo_anota(self):
        tope = sorted(p.estimated_seconds for p in self.plan.piezas)[len(self.plan.piezas) // 2]
        filtrado = cli._filtra_plan(self.plan, argparse.Namespace(max_seg=tope, excluir=None))
        self.assertTrue(all(p.estimated_seconds <= tope for p in filtrado.piezas))
        self.assertLess(len(filtrado.piezas), len(self.plan.piezas))
        self.assertEqual(len(filtrado.piezas) + len(filtrado.omitidas), len(self.plan.piezas) + len(self.plan.omitidas))
        self.assertTrue(any("--max-seg" in o.motivo for o in filtrado.omitidas))
        self.assertEqual(sorted(filtrado.orden), sorted(p.key for p in filtrado.piezas))

    def test_excluir_mira_tambien_lo_que_solo_se_ve(self):
        # «Corrige» solo está en una tarjeta del esquema de la lección 1 y en el cuerpo, que la pieza «idea» no lee entero.
        filtrado = cli._filtra_plan(self.plan, argparse.Namespace(max_seg=None, excluir="a veces falla"))
        self.assertIn(("idea", 1), {(o.tipo, o.leccion_n) for o in filtrado.omitidas if "--excluir" in o.motivo})

    def test_excluir_un_tema_quita_las_piezas_que_lo_nombran(self):
        filtrado = cli._filtra_plan(self.plan, argparse.Namespace(max_seg=None, excluir="Negociar, ruleta"))
        fuera = {o.leccion_n for o in filtrado.omitidas if "--excluir" in o.motivo}
        self.assertEqual(fuera, {2})  # solo la lección 2 habla de negociar (su práctica) y de la ruleta
        for p in filtrado.piezas:
            self.assertNotIn("negociar", " ".join(s.narration for s in p.scenes).lower())


class CalendarioTest(unittest.TestCase):
    def test_reparte_entre_libros_alternando_y_respeta_el_orden_de_cada_uno(self):
        with tempfile.TemporaryDirectory() as tmp:
            salida = Path(tmp)
            for slug, eje, n in (("uno", "Economía y Mercados", 3), ("dos", "Psicología y Conducta", 2), ("tres", "Economía y Mercados", 1)):
                carpeta = salida / slug / "compartir" / "9x16"
                carpeta.mkdir(parents=True)
                piezas = [{"orden": i + 1, "clave": f"p{i + 1}", "tipo": "idea", "titulo": f"{slug} {i + 1}", "duracion_s": 40, "video": f"p{i + 1}/video.mp4" if i < 2 else None} for i in range(n)]
                (carpeta / "manifiesto.json").write_text(json.dumps({"titulo": slug, "autor": "", "eje": eje, "piezas": piezas}), encoding="utf-8")
            original = cli.OUTPUT
            cli.OUTPUT = salida
            try:
                self.assertEqual(cli.calendario(argparse.Namespace(aspecto="9:16", por_dia=2, desde="2026-12-01", todas=False)), 0)
                plan = json.loads((salida / "calendario-compartir-9x16.json").read_text(encoding="utf-8"))
                self.assertEqual([(x["libro"], x["clave"]) for x in plan], [("tres", "p1"), ("dos", "p1"), ("uno", "p1"), ("dos", "p2"), ("uno", "p2")])  # un libro de cada eje por vuelta; la tercera de «uno» no tiene vídeo
                self.assertEqual([x["dia"] for x in plan], ["2026-12-01", "2026-12-01", "2026-12-02", "2026-12-02", "2026-12-03"])
                self.assertTrue(all(a["libro"] != b["libro"] for a, b in zip(plan, plan[1:])))
                self.assertEqual(cli.calendario(argparse.Namespace(aspecto="9:16", por_dia=1, desde=None, todas=True)), 0)
                self.assertEqual(len(json.loads((salida / "calendario-compartir-9x16.json").read_text(encoding="utf-8"))), 6)
                self.assertEqual(cli.calendario(argparse.Namespace(aspecto="1:1", por_dia=1, desde=None, todas=True)), 1)  # sin manifiestos
                # Manifiestos válidos como JSON pero con otra forma, y una fecha mal escrita: nada revienta.
                for nombre, contenido in (("raro1", "[]"), ("raro2", '{"piezas": null}'), ("raro3", '{"titulo": "r", "piezas": [{"clave": "p1", "video": "v", "duracion_s": null}, "x", {}]}')):
                    carpeta = salida / nombre / "compartir" / "9x16"
                    carpeta.mkdir(parents=True)
                    (carpeta / "manifiesto.json").write_text(contenido, encoding="utf-8")
                self.assertEqual(cli.calendario(argparse.Namespace(aspecto="9:16", por_dia=1, desde=None, todas=False)), 0)
                self.assertEqual(len(json.loads((salida / "calendario-compartir-9x16.json").read_text(encoding="utf-8"))), 6)
                self.assertEqual(cli.calendario(argparse.Namespace(aspecto="9:16", por_dia=1, desde="mañana", todas=False)), 1)
            finally:
                cli.OUTPUT = original


if __name__ == "__main__":
    unittest.main()
