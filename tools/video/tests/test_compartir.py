"""Piezas compartibles: selección literal, texto cinético, plan del libro y control de calidad. Sin red, sin Chrome y sin voz."""

from __future__ import annotations

import copy
import re
import tempfile
import unittest
from pathlib import Path

from tools.video import compartir as K
from tools.video import compartir_frames as CF
from tools.video import lint as L
from tools.video.corpus import book_from_rows
from tools.video.text import split_sentences as T_split
from tools.video.scriptwriter import Part
from tools.video.tests import fixtures as F
from tools.video.tests.pitidos import PitidosTTSEngine

WEB = re.compile(r"lecci[oó]n \d|lecci[oó]n anterior|siguiente lecci[oó]n|\bde \d+\b|\bapp\b|episodio|venimos de", re.IGNORECASE)


def _libro(**cambios):
    """El libro de prueba con campos de lecciones cambiados: {"l-1": {"idea_clave": "…"}}."""
    lecciones = copy.deepcopy(F.LECCIONES)
    for lec in lecciones:
        lec.update(cambios.get(lec["id"], {}))
    return book_from_rows(F.LIBRO, lecciones, cambios.get("preguntas", F.PREGUNTAS), cambios.get("diagramas", F.DIAGRAMAS), cambios.get("mapas", F.MAPAS))


def _textos(pieza) -> list[str]:
    """Todo lo que se oye y todo lo que se ve (cadenas de las vistas) en una pieza."""
    out: list[str] = []

    def walk(o):
        if isinstance(o, str):
            out.append(o)
        elif isinstance(o, dict):
            for k, v in o.items():
                if k != "spec":
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for s in pieza.scenes:
        out.append(s.narration)
        walk(s.view)
    return out


class SeleccionTest(unittest.TestCase):
    def test_titulo_corto_es_un_prefijo_literal(self):
        self.assertEqual(K.titulo_corto("Steal Like an Artist: 10 Things Nobody Told You"), "Steal Like an Artist")
        self.assertEqual(K.titulo_corto("Cartas a un joven poeta (Briefe an einen jungen Dichter)"), "Cartas a un joven poeta")
        self.assertEqual(K.titulo_corto("Fluir"), "Fluir")
        self.assertEqual(K.titulo_corto("Yo: una historia"), "Yo: una historia")  # no deja un título de una sílaba

    def test_el_hilo_prefiere_la_idea_y_salta_lo_que_no_esta_en_espanol(self):
        libro = F.libro()
        self.assertEqual(K.hilo(libro.lessons[0]), ("Lo primero que se nos ocurre no siempre es lo cierto.", "idea_clave"))
        self.assertEqual(K.hilo(libro.lessons[2])[1], "cita_memorable")
        ingles = _libro(**{"l-3": {"cita_memorable": "The past instability of the market economy is the consequence of the exclusion of money."}})
        texto, origen = K.hilo(ingles.lessons[2])
        self.assertEqual(origen, "cuerpo")
        self.assertTrue(texto.startswith("La última lección cierra el círculo."))

    def test_el_hilo_evita_la_frase_que_habla_de_la_leccion_si_hay_otra(self):
        libro = _libro(**{"l-1": {"idea_clave": "La lección extrae que dudar ayuda.", "cita_memorable": "Dudar a tiempo ahorra errores."}})
        self.assertEqual(K.hilo(libro.lessons[0]), ("Dudar a tiempo ahorra errores.", "cita_memorable"))

    def test_sin_idea_el_arranque_del_cuerpo_son_frases_enteras(self):
        texto, origen = K.hilo(F.libro().lessons[1])
        self.assertEqual(origen, "cuerpo")
        self.assertEqual(texto, "La segunda lección empieza aquí. Daniel Kahneman lo llamó «efecto de anclaje» en sus trabajos.")

    def test_el_matiz_no_pierde_la_salvedad_de_seguridad(self):
        largo = "Primera frase del matiz que ya ocupa bastante sitio en la pieza corta y no deja hueco. " + "Otra frase larga que no cabe. " * 3
        libro = _libro(**{"l-1": {"autocorreccion": largo + "Esto no sustituye a un profesional sanitario."}})
        partes = K.matiz_partes(libro.lessons[0], 20)
        self.assertEqual(len(partes), 2)
        self.assertTrue(partes[0].text.startswith("Primera frase"))
        self.assertEqual(partes[1].text, "Esto no sustituye a un profesional sanitario.")
        self.assertTrue(all(p.origin == "leccion.autocorreccion" for p in partes))

    def test_la_pregunta_tiene_que_entenderse_sin_la_leccion(self):
        preguntas = [
            {"id": "q-a", "leccion_id": "l-1", "texto": "Según la lección, ¿qué pasa?", "opciones": ["Uno", "Dos"], "correcta": 0, "explicacion": "", "dificultad": 1},
            {"id": "q-b", "leccion_id": "l-1", "texto": "¿Qué afirma el autor en el capítulo 7?", "opciones": ["Uno", "Dos"], "correcta": 0, "explicacion": "", "dificultad": 1},
            {"id": "q-c", "leccion_id": "l-1", "texto": "¿Cuál es cierta?", "opciones": ["Todas las anteriores", "Dos"], "correcta": 0, "explicacion": "", "dificultad": 1},
            {"id": "q-d", "leccion_id": "l-1", "texto": "¿Qué mide la selección natural?", "opciones": ["El ajuste al entorno", "Nada"], "correcta": 0, "explicacion": "", "dificultad": 3},
        ]
        libro = _libro(preguntas=preguntas)
        self.assertEqual(K.pregunta_autonoma(libro.lessons[0]).id, "q-d")  # «selección» no es «lección»
        self.assertIsNone(K.pregunta_autonoma(_libro(preguntas=preguntas[:3]).lessons[0]))

    def test_la_explicacion_se_corta_antes_de_hablar_de_las_opciones(self):
        q = F.libro().lessons[0].preguntas[0]
        self.assertEqual(K.explicacion_autonoma(q), "La respuesta rápida suele ser la equivocada.")


class CineticoTest(unittest.TestCase):
    def test_las_paginas_cubren_el_texto_sin_pasarse_ni_dejar_coletillas(self):
        for n in range(1, 90):
            tokens = [f"p{i}" + ("." if i % 11 == 10 else "," if i % 5 == 4 else "") for i in range(n)]
            paginas = K.paginar(tokens)
            self.assertEqual(paginas[0][0], 0)
            self.assertEqual(paginas[-1][1], n)
            for (a, b), (c, _) in zip(paginas, paginas[1:]):
                self.assertEqual(b, c)
            self.assertTrue(all(0 < b - a <= K.PAGINA for a, b in paginas), (n, paginas))
            if n > K.PAGINA:
                self.assertTrue(all(b - a >= 3 for a, b in paginas), (n, paginas))

    def test_las_paginas_cortan_en_la_puntuacion(self):
        t = "Las malas decisiones suelen deberse a cuatro villanos: marco estrecho, sesgo de confirmación, emoción pasajera y exceso de confianza.".split()
        self.assertEqual([" ".join(t[a:b]) for a, b in K.paginar(t)][0], "Las malas decisiones suelen deberse a cuatro villanos: marco estrecho,")

    def test_las_rafagas_son_cortas_y_respetan_la_frase(self):
        t = "Uno dos tres cuatro cinco seis. Siete, ocho nueve diez once doce trece catorce.".split()
        r = K.rafagas(t, 0, len(t))
        self.assertEqual(r[0][0], 0)
        self.assertEqual(r[-1][1], len(t))
        self.assertTrue(all(1 <= j - i <= K.RAFAGA + 1 for i, j in r))
        self.assertIn(6, [j for _, j in r])  # ninguna ráfaga cruza el punto

    def test_el_texto_cinetico_es_la_locucion_y_entra_en_orden(self):
        partes = [K._fixed("matiz"), Part("El efecto no es igual de fuerte en expertos. Hay réplicas que lo matizan.", "leccion.autocorreccion")]
        s = K.escena_frase("Matiz", "matiz", "EL MATIZ", partes, skip_parts=1)
        self.assertEqual(s.view["words"], s.narration.split()[2:])  # «El matiz.» lo dice el rótulo
        self.assertEqual(s.view["shown"], 0)  # primero, el rótulo solo
        momentos = [b.at_word for b in s.beats]
        self.assertEqual(momentos, sorted(momentos))
        self.assertEqual(momentos[0], 2)
        self.assertEqual(s.beats[-1].patch["shown"], len(s.view["words"]))
        sin_salto = K.escena_frase("Idea", "idea", "UNA IDEA", [Part("Una idea corta y clara.", "leccion.idea_clave")])
        self.assertGreater(sin_salto.view["shown"], 0)  # el gancho está escrito desde el primer fotograma


class PiezasTest(unittest.TestCase):
    def setUp(self):
        self.libro = F.libro()
        self.plan = K.plan_libro(self.libro)

    def test_catalogo_del_libro_de_prueba(self):
        claves = [p.key for p in self.plan.piezas]
        self.assertEqual(claves[0], "libro")
        self.assertEqual(sum(p.tipo == "idea" for p in self.plan.piezas), 3)
        self.assertEqual([p.key for p in self.plan.piezas if p.tipo == "pregunta"], ["pregunta-01-la-primera-idea"])
        self.assertEqual({(o.tipo, o.leccion_n) for o in self.plan.omitidas if o.tipo != "caso"}, {("pregunta", 2), ("pregunta", 3), ("practica", 3)})
        self.assertEqual(sum(o.tipo == "caso" for o in self.plan.omitidas), 3)  # el libro de prueba no cuenta ningún caso
        self.assertTrue(all(o.motivo for o in self.plan.omitidas))

    def test_ninguna_pieza_ancla_a_la_web(self):
        for p in self.plan.piezas:
            for texto in _textos(p):
                if texto.startswith("La segunda lección empieza") or texto.startswith("La última lección cierra"):
                    continue  # texto del corpus de prueba
                self.assertIsNone(WEB.search(texto), (p.key, texto))
        for formula in [*K.FORMULAS.values(), *K.ROTULOS.values()]:
            self.assertIsNone(K.ANCLA_WEB.search(formula), formula)

    def test_la_idea_abre_en_frio_y_lleva_credito_esquema_y_matiz(self):
        p = self.plan.piezas[1]
        self.assertEqual(p.tipo, "idea")
        self.assertEqual(p.scenes[0].narration, "Lo primero que se nos ocurre no siempre es lo cierto.")
        self.assertEqual(p.gancho, p.scenes[0].narration)
        self.assertEqual([s.kind for s in p.scenes], ["c-frase", "c-credito", "c-figura", "c-figura", "c-figura", "c-figura", "c-frase", "c-cierre"])
        self.assertEqual(p.scenes[1].narration, "Del libro El libro de prueba, de Ana Autora.")
        self.assertEqual(p.scenes[3].narration, "Respuesta rápida. Inmediata. A veces falla.")  # el esquema, literal
        self.assertEqual(p.scenes[5].narration, "Dos modos de responder.")
        self.assertEqual(p.scenes[-2].narration, "El matiz. No toda intuición falla.")
        self.assertEqual(p.scenes[-1].narration, K.FORMULAS["cta"])

    def test_el_cierre_retoma_el_gancho(self):
        for p in self.plan.piezas:
            cierre = p.scenes[-1]
            self.assertEqual(cierre.kind, "c-cierre")
            self.assertTrue(cierre.view["recuerda"], p.key)
        idea = self.plan.piezas[1]
        self.assertEqual(idea.scenes[-1].view["recuerda"], idea.gancho)  # un solo mensaje: el que abrió la pieza
        pregunta = next(x for x in self.plan.piezas if x.tipo == "pregunta")
        self.assertEqual(pregunta.scenes[-1].view["recuerda"], "Que puede ser equivocada.")  # la pregunta se cierra con su respuesta

    def test_el_patron_visual_sale_de_la_plantilla_de_la_figura(self):
        self.assertEqual(K.patron_visual({"plantilla": "comparar"}), "contraste")
        self.assertEqual(K.patron_visual({"plantilla": "pasos"}), "cadena")
        self.assertEqual(K.patron_visual({"plantilla": "ciclo"}), "ciclo")
        self.assertEqual(K.patron_visual({"plantilla": "mapa"}), "radial")
        self.assertEqual(K.patron_visual({"plantilla": "matriz", "datos": {"celdas": [{}, {}, {}]}}), "silueta")  # sin cuatro cuadrantes no hay matriz
        self.assertEqual(K.patron_visual({"plantilla": "grafica"}), "silueta")
        figura = [s for s in self.plan.piezas[1].scenes if s.kind == "c-figura"]
        self.assertTrue(all(s.view["patron"] == "contraste" for s in figura))
        self.assertEqual([s.view["mode"] for s in figura], ["titulo", "pieza", "pieza", "pie"])  # estructura entera → piezas → pie

    def test_arco_completo_sencillo_o_ninguno(self):
        self.assertEqual(self.plan.piezas[1].arco, "completo")
        sin_figura = next(x for x in self.plan.piezas if x.key.startswith("idea-03"))
        self.assertEqual(sin_figura.arco, "sin_esquema")
        self.assertEqual([s.kind for s in sin_figura.scenes], ["c-frase", "c-credito", "c-cierre"])  # la lección 3 no tiene matiz
        # Sin idea redactada y con un arranque que solo habla del libro: abre el esquema, no una frase hueca.
        meta = {"l-1": {"idea_clave": "", "cita_memorable": "", "cuerpo": "Ana Autora dedica una sección entera a este asunto. Luego lo desarrolla."}}
        p = K.pieza_idea(_libro(**meta), 0)
        self.assertEqual(p.arco, "esquema_primero")
        self.assertEqual(p.scenes[0].kind, "c-figura")
        self.assertEqual(p.gancho, "Rápido y despacio")
        self.assertEqual(p.scenes[-1].view["recuerda"], "Dos modos de responder.")
        self.assertEqual([i for i in L.lint_pieza(p, _libro(**meta)) if i.level == "error"], [])
        # …y si tampoco hay figura que recorrer, no hay pieza (ni práctica: no habría idea que poner detrás).
        plan = K.plan_libro(_libro(diagramas={}, **meta))
        self.assertEqual({(o.tipo, o.leccion_n) for o in plan.omitidas if o.leccion_n == 1}, {("idea", 1), ("practica", 1), ("caso", 1)})

    def test_si_la_leccion_se_hace_una_pregunta_la_idea_la_resuelve(self):
        libro = _libro(**{"l-1": {"cuerpo": "¿Por qué fallamos al responder deprisa? La respuesta rápida suele ser la equivocada."}})
        p = K.pieza_idea(libro, 0)
        self.assertEqual(p.gancho, "¿Por qué fallamos al responder deprisa?")
        self.assertEqual(p.scenes[0].view["style"], "pregunta")
        self.assertEqual(p.scenes[1].narration, "Lo primero que se nos ocurre no siempre es lo cierto.")
        self.assertEqual(p.scenes[-1].view["recuerda"], p.scenes[1].narration)  # se lleva la respuesta, no la pregunta

    def test_el_arranque_literal_no_cierra_comillas_ni_reescribe(self):
        texto = "La hipótesis nació de una asociación («menos infecciones, más alergias, según se dijo entonces») y de poco más que eso, la verdad sea dicha."
        corto = K.arranque_literal(texto, 12)
        self.assertTrue(texto.startswith(corto.rstrip("…")))
        self.assertEqual(K.arranque_literal("Corto y claro.", 12), "Corto y claro.")

    def test_la_idea_redactada_por_la_app_no_se_entrecomilla(self):
        p = next(x for x in self.plan.piezas if x.key.startswith("idea-03"))
        self.assertEqual(p.gancho_origen, "leccion.cita_memorable")
        for texto in [*_textos(p), p.descripcion_pub, p.portada["text"]]:
            self.assertNotIn("«Dos frenos", texto)
            self.assertNotIn('"Dos frenos', texto)

    def test_la_pregunta_no_ensena_las_opciones_falsas(self):
        p = next(x for x in self.plan.piezas if x.tipo == "pregunta")
        self.assertEqual([s.kind for s in p.scenes], ["c-frase", "c-pausa", "c-frase", "c-credito", "c-frase", "c-cierre"])
        self.assertEqual(p.scenes[2].narration, "La respuesta: Que puede ser equivocada. La respuesta rápida suele ser la equivocada.")
        todo = " ".join(_textos(p))
        for falsa in ("Que es la correcta", "Que no existe", "Que tarda mucho"):
            self.assertNotIn(falsa, todo)
        self.assertEqual(p.scenes[1].hold_s, K.PAUSA_PENSAR_S)

    def test_la_practica_abre_con_que_probar_y_da_la_idea_que_hay_detras(self):
        p = next(x for x in self.plan.piezas if x.key.startswith("practica-01"))
        self.assertEqual(p.scenes[0].narration, "Cuenta hasta tres antes de responder.")
        self.assertEqual(p.scenes[1].narration, "La idea detrás. Lo primero que se nos ocurre no siempre es lo cierto.")
        self.assertEqual(p.scenes[1].view["words"][0], "Lo")

    def test_el_caso_abre_con_lo_concreto_y_deja_la_idea(self):
        cuerpo = "Todo empieza con una pregunta sencilla.\n\nUn ejemplo: alguien recibe un correo molesto y contesta de inmediato. Diez minutos después se arrepiente.\n\nPensar despacio corrige."
        libro = _libro(**{"l-1": {"cuerpo": cuerpo}})
        p = K.pieza_caso(libro, 0)
        self.assertEqual(p.scenes[0].narration, "Un ejemplo: alguien recibe un correo molesto y contesta de inmediato. Diez minutos después se arrepiente.")
        self.assertEqual(p.gancho, "Un ejemplo: alguien recibe un correo molesto y contesta de inmediato.")
        self.assertEqual(p.scenes[1].narration, "La idea detrás. Lo primero que se nos ocurre no siempre es lo cierto.")
        self.assertEqual(p.scenes[-1].view["recuerda"], "Lo primero que se nos ocurre no siempre es lo cierto.")  # se lleva la idea, no el caso
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [])
        self.assertIn(p.key, K.plan_libro(libro).orden)

    def test_un_ejemplo_que_solo_se_anuncia_no_es_un_caso(self):
        solo = _libro(**{"l-1": {"cuerpo": "Una frase cualquiera para empezar.\n\nUn ejemplo cotidiano ayuda a ver la diferencia."}})
        self.assertIsNone(K.pieza_caso(solo, 0))
        con_lo_que_sigue = _libro(**{"l-1": {"cuerpo": "Una frase.\n\nUn ejemplo cotidiano ayuda a ver la diferencia. Quien responde a un correo en caliente suele arrepentirse a los diez minutos."}})
        self.assertEqual(len(T_split(K.pieza_caso(con_lo_que_sigue, 0).scenes[0].narration)), 2)
        self.assertIsNone(K.pieza_caso(F.libro(), 0))  # sin caso en el cuerpo, no hay pieza
        self.assertIsNone(K.pieza_caso(_libro(**{"l-2": {"cuerpo": "Primera frase del cuerpo.\n\nImagina que alguien te pide una cifra antes de negociar y tú no la tienes pensada."}}), 1))  # sin idea redactada que ilustrar

    def test_textos_por_red_caben_en_cada_red_y_no_inventan(self):
        for p in self.plan.piezas:
            textos = K.textos_por_red(p)
            self.assertLessEqual(len(textos["x"]["texto"]), 280, p.key)
            self.assertLessEqual(len(textos["tiktok"]["texto"]), 150, p.key)
            self.assertLessEqual(len(textos["youtube_shorts"]["titulo"]), 100, p.key)
            self.assertTrue(textos["youtube_shorts"]["titulo"].endswith("#Shorts"))
            for campos in textos.values():
                for valor in campos.values():
                    self.assertIsNone(WEB.search(valor), (p.key, valor))
                    self.assertNotIn("http", valor)
        x = K.textos_por_red(self.plan.piezas[1])["x"]["texto"]
        self.assertEqual(x, "Lo primero que se nos ocurre no siempre es lo cierto. Del libro «El libro de prueba», de Ana Autora. #MenteFría #libros")

    def test_el_libro_sale_del_mapa(self):
        p = self.plan.piezas[0]
        self.assertEqual(p.scenes[0].narration, "Pensar bien es frenar a tiempo.")
        self.assertEqual(p.scenes[1].narration, "El libro de prueba, de Ana Autora, en 3 ideas.")
        self.assertEqual([s.narration for s in p.scenes if s.kind == "c-nodo"][0], "Primera idea. Dudar de lo inmediato.")
        self.assertIsNone(K.pieza_libro(_libro(mapas={})))

    def test_dos_piezas_no_abren_igual(self):
        repetido = _libro(**{"l-2": {"idea_clave": "Lo primero que se nos ocurre no siempre es lo cierto."}})
        plan = K.plan_libro(repetido, ("idea",))
        self.assertEqual(len(plan.piezas), 2)
        self.assertTrue(any("abre igual" in o.motivo for o in plan.omitidas))
        ganchos = [K._huella_gancho(p.gancho) for p in K.plan_libro(self.libro).piezas]
        self.assertEqual(len(ganchos), len(set(ganchos)))

    def test_el_orden_sugerido_las_incluye_todas_y_no_junta_las_de_una_leccion(self):
        self.assertEqual(sorted(self.plan.orden), sorted(p.key for p in self.plan.piezas))
        self.assertEqual(self.plan.orden[0], "libro")
        self.assertTrue(self.plan.orden[1].startswith("idea-01"))
        por_clave = {p.key: p for p in self.plan.piezas}
        orden = [por_clave[k] for k in self.plan.orden]
        primera_idea = {p.leccion_n: i for i, p in enumerate(orden) if p.tipo == "idea"}
        for i, p in enumerate(orden):
            if p.tipo in ("pregunta", "practica"):
                self.assertGreater(i, primera_idea[p.leccion_n])  # nunca antes que la idea de su lección

    def test_solo_una_leccion(self):
        plan = K.plan_libro(self.libro, solo_leccion=0)
        self.assertEqual([p.key.split("-")[0] for p in plan.piezas], ["idea", "pregunta", "practica"])

    def test_texto_de_publicacion(self):
        p = self.plan.piezas[1]
        texto = K.texto_publicacion(p, 41.2)
        self.assertTrue(texto.startswith("La primera idea\n"))
        self.assertIn("El matiz: No toda intuición falla.", texto)
        self.assertIn("Del libro «El libro de prueba», de Ana Autora.", texto)
        self.assertIn("#MenteFría", texto)
        self.assertIn("#AnaAutora", texto)
        self.assertIsNone(WEB.search(texto))

    def test_la_huella_cambia_con_el_contenido(self):
        otra = K.plan_libro(_libro(**{"l-1": {"autocorreccion": "No toda intuición falla. A veces acierta."}})).piezas[1]
        self.assertNotEqual(self.plan.piezas[1].fingerprint(), otra.fingerprint())
        self.assertEqual(self.plan.piezas[1].fingerprint(), K.plan_libro(F.libro()).piezas[1].fingerprint())


FIGURAS = {
    "espectro": {"tipo": "diagrama", "plantilla": "espectro", "titulo": "De menos a más margen", "pie": "Un continuo, no dos cajas.",
                 "datos": {"polos": ["Poco margen", "Mucho margen"], "marcas": [
                     {"pos": 0.9, "t": "Holgado", "d": "Puede esperar"}, {"pos": 0.1, "t": "Apurado", "d": "Decide con prisa"}, {"pos": 0.5, "t": "Justo", "d": "Depende del día"}]}},
    "tiempo": {"tipo": "diagrama", "plantilla": "tiempo", "titulo": "Dos fechas", "pie": "",
               "datos": {"eventos": [{"f": "1998", "t": "Se publica el estudio"}, {"f": "2010", "t": "Se retira"}]}},
    "cifras": {"tipo": "diagrama", "plantilla": "cifras", "titulo": "Una cifra", "pie": "",
               "datos": {"items": [{"n": "37 %", "t": "De las respuestas rápidas fallan"}]}},
    "mapa": {"tipo": "diagrama", "plantilla": "mapa", "titulo": "Tres frenos", "pie": "Los tres cuentan.",
             "datos": {"centro": "Pensar despacio", "centroSub": "lectura nuestra", "nodos": [{"t": "Parar", "d": "Antes de responder"}, {"t": "Dudar", "d": "De lo inmediato"}, {"t": "Comprobar", "d": "Con un dato"}]}},
    "matriz": {"tipo": "diagrama", "plantilla": "matriz", "titulo": "Prisa y acierto", "pie": "Cuatro casos.",
               "datos": {"ejeX": {"nombre": "Ritmo", "izq": "Despacio", "der": "Deprisa"}, "ejeY": {"nombre": "Resultado", "arriba": "Acierta", "abajo": "Falla"},
                         "celdas": [{"t": "Lo esperable", "d": "Pensó y acertó"}, {"t": "Suerte", "d": "No pensó y acertó"}, {"t": "Mala suerte", "d": "Pensó y falló"}, {"t": "Lo habitual", "d": "No pensó y falló"}]}},
}


def _con_figura(nombre: str):
    return _libro(diagramas={"l-1": [FIGURAS[nombre]]})


class PatronesTest(unittest.TestCase):
    def setUp(self):
        self._node = L._check_diagrams
        L._check_diagrams = lambda specs: None

    def tearDown(self):
        L._check_diagrams = self._node

    def _figura(self, nombre):
        libro = _con_figura(nombre)
        p = K.pieza_idea(libro, 0)
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [], nombre)
        return p, [s for s in p.scenes if s.kind == "c-figura"]

    def test_las_figuras_que_antes_iban_sin_esquema_ahora_se_recorren(self):
        for nombre, patron in (("espectro", "espectro"), ("tiempo", "cadena"), ("cifras", "cifra")):
            p, figura = self._figura(nombre)
            self.assertEqual(p.arco, "completo", nombre)
            self.assertTrue(figura and all(s.view["patron"] == patron for s in figura), nombre)

    def test_el_espectro_va_de_un_polo_al_otro_en_su_orden(self):
        _, figura = self._figura("espectro")
        self.assertEqual([p["t"] for p in figura[0].view["pieces"]], ["Apurado", "Justo", "Holgado"])  # por posición, no por orden de escritura
        self.assertEqual(figura[0].view["marco"]["polos"], ["Poco margen", "Mucho margen"])
        self.assertEqual(figura[0].view["marco"]["pos"], [0.1, 0.5, 0.9])
        cuerpo, _ = CF._stage_figura(figura[1].view, "")
        self.assertIn("Poco margen", cuerpo)
        self.assertIn("left:13.2%", cuerpo)
        self.assertEqual(figura[1].narration, "Apurado. Decide con prisa.")

    def test_la_fecha_y_la_cifra_son_literales(self):
        _, tiempo = self._figura("tiempo")
        self.assertEqual(tiempo[1].narration, "1998. Se publica el estudio.")
        _, cifras = self._figura("cifras")
        self.assertEqual(cifras[1].narration, "37 %. De las respuestas rápidas fallan.")
        cuerpo, _ = CF._stage_figura(cifras[1].view, "")
        self.assertIn('<div class="cs-cifra tn-a"><b>37 %</b><span>De las respuestas rápidas fallan</span></div>', cuerpo)

    def test_el_centro_del_mapa_y_su_apostilla_se_ven(self):
        _, figura = self._figura("mapa")
        self.assertEqual(figura[0].view["patron"], "radial")
        for escena in figura:
            cuerpo, _ = CF._stage_figura(escena.view, "")
            self.assertIn("<b>Pensar despacio</b><span>lectura nuestra</span>", cuerpo)  # antes la silueta no lo enseñaba

    def test_la_matriz_ensena_los_cuatro_cuadrantes_y_luego_situa_cada_uno(self):
        _, figura = self._figura("matriz")
        inicio, _ = CF._stage_figura(figura[0].view, "")
        for rotulo in ("Ritmo", "Resultado", "Despacio", "Deprisa", "Acierta", "Falla", "Lo esperable", "Lo habitual"):
            self.assertIn(rotulo, inicio)
        segunda, _ = CF._stage_figura(figura[2].view, "")  # «Suerte»: deprisa y acierta
        self.assertIn("<span>Deprisa</span><span>Acierta</span>", segunda)
        self.assertIn("<b>Suerte</b>", segunda)
        cuarta, _ = CF._stage_figura(figura[4].view, "")  # «Lo habitual»: deprisa y falla
        self.assertIn("<span>Deprisa</span><span>Falla</span>", cuarta)

    def test_mas_figuras_caben_en_los_patrones_que_ya_hay(self):
        escalera = {"plantilla": "escalera", "datos": {"escalones": [{"t": "Física", "d": "Sus leyes limitan"}, {"t": "Química"}, {"t": "Biología"}]}}
        self.assertEqual((K.patron_visual(escalera), [p.t for p in K.piezas_figura(escalera)]), ("cadena", ["Física", "Química", "Biología"]))
        balanza = {"plantilla": "balanza", "datos": {"izq": {"t": "Conquistar", "items": ["Una meta"]}, "der": {"t": "Adentrarse", "items": ["Estar dentro"]}}}
        self.assertEqual((K.patron_visual(balanza), K.piezas_figura(balanza)[1].items), ("contraste", ["Estar dentro"]))
        bucle = {"plantilla": "bucle", "datos": {"nombre": "Aprender por ensayo", "nodos": [{"t": "Probar"}, {"t": "Ver"}, {"t": "Corregir"}], "signos": ["+", "+", "+"]}}
        self.assertEqual((K.patron_visual(bucle), len(K.piezas_figura(bucle)), K.marco_figura(bucle)["centro"]), ("ciclo", 3, "Aprender por ensayo"))
        bucle["datos"]["signos"] = ["+", "−", "+"]  # un paso que frena cambia el sentido del ciclo y aquí no se vería: sin esquema
        self.assertEqual(K.piezas_figura(bucle), [])
        iceberg = {"plantilla": "iceberg", "datos": {"etiquetaVisible": "Lo que vemos", "etiquetaOculto": "Lo que lo sostiene", "visibles": [{"t": "Una ola"}], "ocultos": [{"t": "Procesos", "d": "Con estabilidad relativa"}, {"t": "Eventos"}]}}
        self.assertEqual((K.patron_visual(iceberg), [p.t for p in K.piezas_figura(iceberg)], K.marco_figura(iceberg)["corte"]), ("iceberg", ["Una ola", "Procesos", "Eventos"], 1))
        html = CF._patron({"patron": "iceberg", "mode": "titulo", "pieces": [p.to_view() for p in K.piezas_figura(iceberg)], "marco": K.marco_figura(iceberg)})
        self.assertLess(html.index("Lo que vemos"), html.index("Una ola"))
        self.assertLess(html.index("Una ola"), html.index("Lo que lo sostiene"))
        self.assertLess(html.index("Lo que lo sostiene"), html.index("Procesos"))
        jerarquia = {"plantilla": "jerarquia", "datos": {"raiz": "Dos formas", "ramas": [{"t": "Diseñada", "hijos": [{"t": "Planes"}]}, {"t": "Ecológica", "hijos": [{"t": "Mercados"}]}]}}
        self.assertEqual((K.patron_visual(jerarquia), K.piezas_figura(jerarquia)[0].items, K.marco_figura(jerarquia)["centro"]), ("radial", ["Planes"], "Dos formas"))
        jerarquia["datos"]["ramas"][0]["hijos"][0]["d"] = "Con detalle"  # habría que dejar texto fuera: mejor sin esquema
        self.assertEqual(K.piezas_figura(jerarquia), [])

    def test_no_x_sino_y(self):
        self.assertEqual(K.no_sino("Lo que hace buena una inversión no es la calidad del activo, sino la relación entre su precio y su valor.".split()), (6, 12, 21))
        self.assertIsNone(K.no_sino("No solo falla la memoria, sino también el juicio.".split()))  # no niega nada
        self.assertIsNone(K.no_sino("No lo sabemos. Sino hubiera sido otro.".split()))  # no cruza el punto
        self.assertIsNone(K.no_sino("Pensar despacio corrige.".split()))

    def test_el_contraste_de_la_frase_se_senala_sin_cambiar_una_palabra(self):
        idea = "La ventaja no está en una mano concreta, sino en saber algo de la baraja."
        s = K.escena_frase("Idea", "idea", "UNA IDEA", [Part(idea, "leccion.idea_clave")])
        self.assertEqual(s.narration, idea)
        self.assertEqual(len(s.view["pages"]), 1)  # breve: el contraste se ve entero en una página
        self.assertEqual((s.view["neg"], s.view["afi"]), ([2, 8], [8, 15]))
        final = dict(s.view, **s.beats[-1].patch)
        cuerpo, _ = CF._stage_frase(final, "UNA IDEA")
        self.assertIn('<span class="w neg">está</span>', cuerpo)
        self.assertIn('<span class="w">no</span>', cuerpo)  # el «no» no se tacha: es lo que dice la frase
        self.assertIn('class="w afi">saber</span>', cuerpo)
        antes = dict(s.view, **s.beats[0].patch)
        self.assertNotIn("neg", CF._stage_frase(antes, "UNA IDEA")[0])  # hasta que no se ha dicho lo negado, nada se apaga
        matiz = K.escena_frase("Matiz", "matiz", "EL MATIZ", [Part(idea, "leccion.autocorreccion")])
        self.assertNotIn("neg", matiz.view)  # solo en la idea


class ControlTest(unittest.TestCase):
    def setUp(self):
        self._node = L._check_diagrams
        L._check_diagrams = lambda specs: None  # sin Node en las pruebas
        self.libro = F.libro()
        self.plan = K.plan_libro(self.libro)

    def tearDown(self):
        L._check_diagrams = self._node

    def test_las_piezas_del_libro_de_prueba_pasan_el_control(self):
        for p in self.plan.piezas:
            errores = [str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error"]
            self.assertEqual(errores, [], p.key)

    def test_rechaza_una_formula_que_no_esta_declarada(self):
        p = self.plan.piezas[1]
        p.scenes[1].parts[0] = Part("Lección 1 de 3 de El libro de prueba.", "plantilla")
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("fórmula no declarada", mensajes)

    def test_un_titulo_de_esquema_que_dice_leccion_avisa_pero_no_tumba_la_pieza(self):
        diagramas = {"l-1": [dict(F.DIAGRAMAS["l-1"][0], titulo="Las lecciones de responder despacio")]}
        libro = _libro(diagramas=diagramas)
        incidencias = L.lint_pieza(K.pieza_idea(libro, 0), libro)
        self.assertEqual([i for i in incidencias if i.level == "error"], [])
        self.assertTrue(any("alude a la lección" in i.message for i in incidencias))

    def test_una_pieza_larga_se_aprieta_sin_cortar_frases(self):
        largo = " ".join(f"Frase número {i} del matiz con unas cuantas palabras de relleno para alargar." for i in range(1, 9))
        idea = "Una idea " + "bastante larga " * 30 + "que termina aquí."
        libro = _libro(**{"l-1": {"idea_clave": idea, "autocorreccion": largo, "aplicacion_practica": largo}})
        p = K.pieza_idea(libro, 0)
        matiz = [x.text for s in p.scenes for x in s.parts if x.origin == "leccion.autocorreccion"]
        self.assertEqual(matiz, ["Frase número 1 del matiz con unas cuantas palabras de relleno para alargar. Frase número 2 del matiz con unas cuantas palabras de relleno para alargar."])
        self.assertEqual(p.scenes[0].narration, idea)  # la idea no se toca
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [])
        practica = K.pieza_practica(libro, 0)
        self.assertLessEqual(len(practica.scenes[0].narration.split()), K.PRACTICA_BREVE)
        self.assertTrue(practica.scenes[0].narration.endswith("."))

    def test_rechaza_texto_que_no_esta_en_el_corpus(self):
        p = self.plan.piezas[1]
        p.scenes[0].parts[0] = Part("Lo primero que se nos ocurre casi nunca es lo cierto.", "leccion.idea_clave")
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("no es literal", mensajes)
        self.assertIn("no coincide con la locución", mensajes)

    def test_rechaza_un_cierre_que_no_es_literal(self):
        p = self.plan.piezas[1]
        p.scenes[-1].view["recuerda"] = "Piensa siempre despacio."
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("mensaje de cierre no es literal", mensajes)

    def test_rechaza_una_pieza_sin_matiz_o_sin_credito(self):
        p = self.plan.piezas[1]
        p.scenes = [s for s in p.scenes if s.view.get("style") != "matiz" and s.kind != "c-credito"]
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("no lo lleva", mensajes)
        self.assertIn("de qué libro sale", mensajes)


class FotogramasTest(unittest.TestCase):
    def setUp(self):
        self.libro = F.libro()
        self.plan = K.plan_libro(self.libro)

    def test_cada_estado_tiene_su_pagina_y_nunca_hay_mas_texto_del_presupuesto(self):
        for p in self.plan.piezas:
            estados, paginas = CF.pieza_pages(p)
            self.assertEqual(len(estados), len(paginas))
            self.assertEqual(len(estados), sum(1 + len(s.beats) for s in p.scenes))
            for s in p.scenes:
                for v in CF.estados(s):
                    self.assertLessEqual(CF.palabras_en_pantalla(s.kind, v), L.MAX_PALABRAS_EN_PANTALLA, (p.key, s.kind))
                    if s.kind == "c-frase":
                        self.assertLessEqual(CF.palabras_en_pantalla(s.kind, v), K.PAGINA)

    def test_el_fotograma_no_lleva_cromo_de_la_web_y_si_el_credito(self):
        p = self.plan.piezas[1]
        _, paginas = CF.pieza_pages(p, "9:16", 2)
        primera = paginas[0]
        self.assertIn("MENTE FRÍA", primera)
        self.assertIn("UNA IDEA", primera)
        self.assertIn('<footer class="cs-foot"><b>El libro de prueba</b> · Ana Autora</footer>', primera)
        self.assertIn("motivo-2", primera)
        for pagina in paginas:
            self.assertNotIn("vf-rail", pagina)
            self.assertIsNone(re.search(r"LECCIÓN \d|Lección \d", pagina))
        self.assertNotIn("cs-foot", paginas[-1].split("<main")[1])  # en el cierre, el crédito es el contenido

    def test_las_palabras_que_aun_no_se_han_dicho_no_se_ven(self):
        s = K.escena_frase("Idea", "idea", "UNA IDEA", [Part("Uno dos tres cuatro cinco seis siete ocho.", "leccion.idea_clave")])
        cuerpo, _ = CF._stage_frase(s.view, "UNA IDEA")
        self.assertEqual(cuerpo.count('class="w off"'), len(s.view["words"]) - s.view["shown"])
        self.assertEqual(cuerpo.count('class="w hot"'), s.view["shown"])

    def test_contraste_y_cadena_ensenan_la_estructura_y_abren_solo_la_pieza_activa(self):
        figura = [s for s in self.plan.piezas[1].scenes if s.kind == "c-figura"]
        inicio, _ = CF._stage_figura(figura[0].view, "")
        self.assertIn("p-contraste", inicio)
        self.assertEqual(inicio.count('class="cs-pan visto'), 2)  # antes de explicar: los dos lados, solo con su título
        self.assertNotIn("<li>", inicio)
        segunda, _ = CF._stage_figura(figura[2].view, "")
        self.assertEqual(segunda.count('class="cs-pan on'), 1)
        self.assertIn("<li>Cuesta</li>", segunda)  # el lado activo, entero y literal
        self.assertNotIn("<li>Inmediata</li>", segunda)  # el ya visto queda en su título
        self.assertNotIn("cs-dg", segunda)  # este patrón no necesita la silueta

    def test_aspectos(self):
        p = self.plan.piezas[1]
        for aspecto in K.ASPECTOS:
            self.assertIn(f'ar-{aspecto.replace(":", "x")}', CF.portada_html(p, aspecto))

    def test_el_acento_sale_del_eje(self):
        self.assertEqual(CF.acento_eje("Economía y Mercados"), "#6fb38a")
        self.assertEqual(CF.acento_eje("Un eje que no existe"), "#c9a84c")


class PitidosTest(unittest.TestCase):
    def test_una_marca_por_palabra_dentro_del_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            res = PitidosTTSEngine().synthesize("Uno dos, tres. Cuatro cinco.", Path(tmp) / "a.mp3")
            self.assertTrue(res.audio_path.exists())
            self.assertEqual([w.text for w in res.word_timings], ["Uno", "dos,", "tres.", "Cuatro", "cinco."])
            inicios = [w.start_s for w in res.word_timings]
            self.assertEqual(inicios, sorted(inicios))
            self.assertLessEqual(res.word_timings[-1].end_s, res.duration_s)


if __name__ == "__main__":
    unittest.main()
