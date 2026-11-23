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

    def test_una_pregunta_en_negativo_no_sirve_su_respuesta_suelta_seria_un_error(self):
        def con(texto):
            return _libro(preguntas=[{"id": "q", "leccion_id": "l-1", "texto": texto, "opciones": ["La intuición nunca se equivoca", "Otra"], "correcta": 0, "explicacion": "", "dificultad": 1}])

        for texto in (
            "¿Cuál de estas afirmaciones sobre la intuición es FALSA?",
            "¿Cuál de las siguientes es una condición de umbral?",
            "¿Qué afirmación es incorrecta?",
            "Todas son ciertas EXCEPTO una, ¿cuál?",
            "¿Cuál NO es un sesgo?",
            "¿Cuál de los rasgos descritos no pertenece al modelo?",
        ):
            self.assertIsNone(K.pregunta_autonoma(con(texto).lessons[0]), texto)
            self.assertIsNone(K.pieza_pregunta(con(texto), 0), texto)
        # Una pregunta con un «no» corriente sí vale: su respuesta es una afirmación cierta.
        self.assertIsNotNone(K.pregunta_autonoma(con("¿Por qué un coste hundido no debería pesar en la decisión?").lessons[0]))

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
        self.assertEqual({(o.tipo, o.leccion_n) for o in self.plan.omitidas if o.tipo not in ("caso", "fondo", "recorrido")}, {("pregunta", 2), ("pregunta", 3), ("practica", 3)})
        self.assertEqual(sum(o.tipo == "fondo" for o in self.plan.omitidas), 3)  # cuerpos de dos frases: no dan para una pieza larga
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
        p = K.pieza_idea(self.libro, 0, breve=True)
        self.assertEqual(p.tipo, "idea")
        self.assertEqual(p.scenes[0].narration, "Lo primero que se nos ocurre no siempre es lo cierto.")
        self.assertEqual(p.gancho, p.scenes[0].narration)
        self.assertEqual([s.kind for s in p.scenes], ["c-frase", "c-credito", "c-figura", "c-figura", "c-figura", "c-figura", "c-frase", "c-cierre"])
        self.assertEqual(p.scenes[1].narration, "Del libro El libro de prueba, de Ana Autora.")
        self.assertEqual(p.scenes[3].narration, "Respuesta rápida. Inmediata. A veces falla.")  # el esquema, literal
        self.assertEqual(p.scenes[5].narration, "Dos modos de responder.")
        self.assertEqual(p.scenes[-2].narration, "El matiz. No toda intuición falla.")
        self.assertEqual(p.scenes[-1].narration, K.FORMULAS["cta"])

    def test_la_idea_lleva_su_explicacion_el_cuerpo_por_parrafos_enteros(self):
        p = self.plan.piezas[1]
        # La explicación nombra las dos piezas del esquema: van a su lado, y después solo la estructura entera y su pie.
        self.assertEqual([s.kind for s in p.scenes], ["c-frase", "c-credito", "c-frase", "c-frase", "c-figura", "c-figura", "c-frase", "c-frase", "c-cierre"])
        self.assertEqual([s.section for s in p.scenes[-3:-1]], ["Matiz", "Práctica"])  # tras el matiz, qué hacer con la idea
        self.assertEqual([s.view["mode"] for s in p.scenes if s.kind == "c-figura"], ["titulo", "pie"])
        explica = [s for s in p.scenes if s.section == "Explicación"]
        self.assertEqual([s.narration for s in explica], ["Todo empieza con una pregunta sencilla. La respuesta rápida suele ser la equivocada.", "Pensar despacio cuesta, pero corrige."])
        self.assertTrue(all(s.view["kicker"] == K.ROTULOS["explica"] and x.origin == "leccion.cuerpo" for s in explica for x in s.parts))
        self.assertEqual([i for i in L.lint_pieza(p, self.libro) if i.level == "error"], [])
        # La explicación va antes del esquema: el esquema la resume a la vista.
        self.assertLess(p.scenes.index(explica[-1]), next(i for i, s in enumerate(p.scenes) if s.kind == "c-figura"))

    def test_la_explicacion_no_elige_frases_ni_salta_parrafos(self):
        parrafos = ["Uno afirma algo. Y lo matiza enseguida.", "Dos sigue " + "con más palabras " * 30 + "hasta aquí.", "Tres ya no cabe " + "porque es largo " * 30 + "del todo.", "Esto no sustituye a un profesional sanitario. Cuatro añade otra cosa distinta que no entra."]
        libro = _libro(**{"l-1": {"cuerpo": "\n\n".join(parrafos)}})
        partes = [x.text for x in K.explicacion_partes(libro.lessons[0])]
        # el primero entero, el segundo entero mientras quepa, y de lo que queda fuera solo la salvedad de seguridad
        self.assertEqual(partes, [parrafos[0], parrafos[1], "Esto no sustituye a un profesional sanitario."])
        self.assertEqual([x.text for x in K.explicacion_partes(libro.lessons[0], None)], parrafos)  # a fondo: todo
        # lo que la pieza ya dijo al abrir no se repite, y un párrafo que solo se entiende en la serie corta la explicación
        self.assertEqual(K.explicacion_partes(libro.lessons[0], ya_dicho=("Uno afirma algo.",))[0].text, "Y lo matiza enseguida.")
        serie = _libro(**{"l-1": {"cuerpo": "Uno afirma algo.\n\nComo vimos en la lección anterior, dos.\n\nTres."}})
        self.assertEqual([x.text for x in K.explicacion_partes(serie.lessons[0], None)], ["Uno afirma algo."])

    def test_el_control_rechaza_una_explicacion_que_salta_o_recorta(self):
        libro = _libro(**{"l-1": {"cuerpo": "Uno afirma algo. Y lo matiza enseguida.\n\nDos sigue.\n\nTres cierra."}})
        for malo in (["Uno afirma algo."], ["Uno afirma algo. Y lo matiza enseguida.", "Tres cierra."], ["Dos sigue."]):
            p = K.pieza_idea(libro, 0)
            p.scenes = [s for s in p.scenes if s.section != "Explicación"]
            p.scenes[2:2] = [K.escena_frase("Explicación", "explica", K.ROTULOS["explica"], [Part(t, "leccion.cuerpo")]) for t in malo]
            self.assertIn("párrafos enteros", " ".join(str(i) for i in L.lint_pieza(p, libro) if i.level == "error"), malo)

    def test_a_fondo_cuenta_la_leccion_entera(self):
        parrafos = ["Uno afirma algo " + "con detalle " * 20 + "y acaba.", "Fuera del libro: dos añade contexto " + "y más contexto " * 15 + "al final.", "Lectura nuestra: tres interpreta."]
        matiz = "No toda intuición falla. " + "Otra frase del matiz que antes no cabía. " * 6
        libro = _libro(**{"l-1": {"cuerpo": "\n\n".join(parrafos), "autocorreccion": matiz.strip()}})
        p = K.pieza_fondo(libro, 0)
        self.assertEqual(p.tipo, "fondo")
        self.assertEqual([s.narration for s in p.scenes if s.section == "Explicación"], parrafos)  # todo el cuerpo, con sus marcas
        self.assertEqual(" ".join(x.text for s in p.scenes for x in s.parts if x.origin == "leccion.autocorreccion"), matiz.strip())  # el matiz, entero
        self.assertEqual([s.section for s in p.scenes if s.kind == "c-frase"][-1], "Práctica")
        self.assertEqual(p.scenes[0].view["kicker"], K.ROTULOS["fondo"])
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [])
        plan = K.plan_libro(libro)
        self.assertIn(p.key, [x.key for x in plan.piezas])  # abre como la pieza «idea» y no se cae por eso
        self.assertIn(p.key, plan.orden)
        self.assertIn("youtube", K.textos_por_red(p))
        self.assertNotIn("#Shorts", K.textos_por_red(p)["youtube"]["titulo"])
        self.assertTrue(p.titulo_pub.startswith("A fondo: "))

    def test_breve_da_la_pieza_de_un_minuto(self):
        largo = _libro(**{"l-1": {"cuerpo": "Uno afirma algo " + "con detalle " * 60 + "y acaba."}})
        self.assertGreater(K.pieza_idea(largo, 0).estimated_seconds, K.OBJETIVO_S)
        breve = K.plan_libro(largo, breve=True)
        idea = next(p for p in breve.piezas if p.key.startswith("idea-01"))
        self.assertFalse([s for s in idea.scenes if s.section == "Explicación"])
        self.assertLessEqual(idea.estimated_seconds, K.OBJETIVO_S)

    def test_el_esquema_acompana_a_la_explicacion_y_se_enciende_al_nombrarlo(self):
        p = self.plan.piezas[1]
        primera, segunda = [s for s in p.scenes if s.section == "Explicación"]
        self.assertEqual([x["t"] for x in primera.view["fig"]["pieces"]], ["Respuesta rápida", "Pensar despacio"])  # rótulos literales del esquema
        self.assertEqual(primera.view["fig_on"], [])  # nada encendido hasta que se nombra
        estados = CF.estados(primera)
        self.assertEqual(estados[-1]["fig_on"], [0])  # «La respuesta rápida suele ser…»
        self.assertEqual(estados[-1]["fig_act"], 0)
        html, clase = CF._stage_frase(estados[-1], "")
        self.assertEqual(clase, "con-comp")
        self.assertIn('class="act', html)
        self.assertEqual(segunda.view["fig_on"], [0, 1])  # lo encendido se conserva, y «Pensar despacio…» abre el párrafo: se enciende con él
        self.assertEqual([i for i in L.lint_pieza(p, self.libro) if i.level == "error"], [])

    def test_nombrar_un_rotulo_no_interpreta(self):
        frase = "El primero es el marco estrecho: plantear la decisión como «esto sí o no».".split()
        self.assertEqual(K.donde_nombra("Marco estrecho", frase), 4)
        self.assertEqual(K.donde_nombra("Los marcos estrechos", frase), 4)  # plural y artículo no cuentan
        self.assertIsNone(K.donde_nombra("Exceso de confianza", frase))
        self.assertIsNone(K.donde_nombra("Marco estrecho", "Un marco que era demasiado pequeño y estrecho.".split()))
        # Regla amplia, solo con dos o más palabras: otra forma de la misma palabra y en otro orden, sin cruzar frases.
        self.assertEqual(K.donde_nombra("Control sobrestimado", "dirigentes que sobrestimaban su control de los acontecimientos".split()), 2)
        self.assertEqual(K.donde_nombra("Reinvertir en el negocio", "cinco usos del capital: reinvertirlo en el negocio, comprar".split()), 4)
        self.assertIsNone(K.donde_nombra("Mundo real", "a los riesgos reales. En el mundo digital ocurrió lo contrario".split()))  # cruza un punto
        self.assertIsNone(K.donde_nombra("Costes de decisión", "no hay costes externos (todas las decisiones requieren".split()))  # cruza un paréntesis
        self.assertIsNone(K.donde_nombra("X causa Y", "La segunda: Y causa X (la causalidad inversa)".split()))  # el orden importa
        self.assertIsNone(K.donde_nombra("Planes y doctrinas rígidos", "se aferraban a planes y doctrinas, que malinterpretaban".split()))  # no puede faltar ninguna
        # Un rótulo de una sola palabra no usa la regla amplia.
        self.assertIsNone(K.donde_nombra("El plan", "diseñó el plano maestro en forma de avión".split()))
        self.assertIsNone(K.donde_nombra("Lo que funciona", "La función no reside en lo que está presente".split()))

    def test_si_el_pie_del_esquema_dice_lo_que_el_matiz_no_se_oye_dos_veces(self):
        libro = _libro(**{"l-1": {"autocorreccion": "Son dos modos de responder, pero no toda intuición falla."}})
        p = K.pieza_idea(libro, 0)
        self.assertNotIn("pie", [s.view.get("mode") for s in p.scenes if s.kind == "c-figura"])
        self.assertTrue(any(x.origin == "leccion.autocorreccion" for s in p.scenes for x in s.parts))  # el matiz sigue, entero
        self.assertIn("pie", [s.view.get("mode") for s in self.plan.piezas[1].scenes if s.kind == "c-figura"])  # si no se repite, el pie se queda

    def test_el_esquema_se_construye_pieza_a_pieza(self):
        figura = [s for s in K.pieza_idea(self.libro, 0, breve=True).scenes if s.kind == "c-figura"]
        primera = figura[0]
        self.assertEqual(primera.view["shown"], 0)  # empieza con solo el título…
        self.assertEqual([b.patch for b in primera.beats], [{"shown": 1}, {"shown": 2}])  # …y entra una pieza cada vez
        self.assertTrue(all(b.at_s is not None for b in primera.beats))
        vacio, _ = CF._stage_figura(CF.estados(primera)[0], "")
        medio, _ = CF._stage_figura(CF.estados(primera)[1], "")
        self.assertEqual(vacio.count("aun-no"), 2)
        self.assertEqual(medio.count("aun-no"), 1)  # la que falta guarda su sitio: nada salta cuando entre
        # Un ciclo se cierra al final: lo último que se dibuja es la flecha que vuelve al principio.
        ciclo = {"l-1": [{"tipo": "diagrama", "plantilla": "ciclo", "titulo": "Un ciclo", "datos": {"nodos": [{"t": "Uno"}, {"t": "Dos"}, {"t": "Tres"}]}}]}
        libro = _libro(diagramas=ciclo)
        fig = [s for s in K.pieza_idea(libro, 0, breve=True).scenes if s.kind == "c-figura"]
        self.assertEqual(fig[0].view["patron"], "ciclo")
        self.assertEqual(fig[0].beats[-1].patch, {"vuelta": 1})
        self.assertIn("abierto", CF._stage_figura(CF.estados(fig[0])[0], "")[0])
        self.assertNotIn("abierto", CF._stage_figura(CF.estados(fig[0])[-1], "")[0])

    def test_los_iconos_dicen_el_tipo_de_momento_no_el_contenido(self):
        iconos_biblioteca = {"bombilla", "diana", "ojo", "balanza", "dado", "ciclo", "red", "reloj", "escudo", "brujula", "libro", "grupo", "grafico", "pregunta", "bandera", "lupa", "llave", "camino"}
        self.assertLessEqual(set(K.ICONOS.values()), iconos_biblioteca)  # solo los de lib/mapa.js
        # Se asignan por estilo de escena o por forma de figura: ninguna clave depende del texto de la lección.
        self.assertLessEqual(set(K.ICONOS), {"idea", "pregunta", "explica", "matiz", "practica", "caso", "respuesta", "credito", "pensar", "conexion", "nombres", *K.PATRONES.values(), "silueta", "matriz", "espectro", "cifra", "iceberg", "ciclo", "radial", "cadena", "contraste"})
        p = self.plan.piezas[1]
        matiz = next(s for s in p.scenes if s.section == "Matiz")
        self.assertIn('data-icon="escudo"', CF._stage_frase(CF.estados(matiz)[-1], "")[0])
        self.assertEqual([i for i in L.lint_pieza(p, self.libro) if i.level == "error"], [])

    def test_la_idea_anade_el_parrafo_del_caso_si_la_leccion_lo_marca(self):
        relleno = "Dos sigue " + "con más palabras " * 40 + "hasta aquí."
        caso = "Por ejemplo, una médica revisa su primer diagnóstico. Lo cambia al ver la analítica."
        libro = _libro(**{"l-1": {"cuerpo": "\n\n".join(["Uno afirma algo. Y lo matiza enseguida.", relleno, "Tres no cabe " + "y es largo " * 40 + "del todo.", caso, "Cinco cierra."])}})
        p = K.pieza_idea(libro, 0)
        escena = next(s for s in p.scenes if s.section == "Caso")
        self.assertEqual(escena.narration, caso)  # el párrafo entero, aunque se salte el tercero
        self.assertEqual(escena.view["kicker"], K.ROTULOS["caso"])
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [])
        # Un párrafo que no empieza presentándose como caso no se añade: saltado de su sitio, podría no entenderse.
        sin = _libro(**{"l-1": {"cuerpo": "\n\n".join(["Uno afirma algo. Y lo matiza enseguida.", relleno, "Tres no cabe " + "y es largo " * 40 + "del todo.", "Eso pasó con una médica, por ejemplo. Cambió su diagnóstico."])}})
        self.assertFalse([s for s in K.pieza_idea(sin, 0).scenes if s.section == "Caso"])

    def test_un_icono_por_pieza_solo_sale_si_alguien_lo_aprobo(self):
        import json
        import tempfile
        from pathlib import Path
        from unittest import mock

        entradas = [
            {"leccion_id": "l-1", "pieza": "Respuesta rápida", "icono": "reloj", "aprobado": True},
            {"leccion_id": "l-1", "pieza": "Pensar despacio", "icono": "lupa", "aprobado": False},  # propuesto, sin revisar
            {"leccion_id": "l-1", "pieza": "Otra", "icono": "unicornio", "aprobado": True},  # no es de la biblioteca
        ]
        with tempfile.TemporaryDirectory() as d, mock.patch.object(K, "ICONOS_DIR", Path(d)), mock.patch.dict("os.environ", {"ICONOS_PROPUESTOS": ""}):
            (Path(d) / "prueba.json").write_text(json.dumps({"piezas": entradas}), encoding="utf-8")
            try:
                self.assertEqual(K.iconos_de_piezas(recargar=True), {("l-1", "Respuesta rápida"): "reloj"})
                p = K.pieza_idea(self.libro, 0, breve=True)
                piezas = next(s for s in p.scenes if s.kind == "c-figura").view["pieces"]
                self.assertEqual([x.get("icon") for x in piezas], ["reloj", None])
                html, _ = CF._stage_figura(next(s for s in p.scenes if s.kind == "c-figura" and s.view["mode"] == "pieza").view, "")
                self.assertIn('data-icon="reloj"', html)
                self.assertNotIn('data-icon="lupa"', html)
                self.assertEqual([i for i in L.lint_pieza(p, self.libro) if i.level == "error"], [])
                with mock.patch.dict("os.environ", {"ICONOS_PROPUESTOS": "1"}):  # la previsualización sí los enseña
                    self.assertEqual(K.iconos_de_piezas(recargar=True)[("l-1", "Pensar despacio")], "lupa")
            finally:
                K._iconos_cache = None

    def test_al_cambiar_de_pieza_los_paneles_se_mueven_no_saltan(self):
        p = K.pieza_idea(self.libro, 0, breve=True)
        estados, paginas = CF.pieza_pages(p)
        mov = CF.pieza_movimientos(p)
        llegadas = [n for n, st in enumerate(estados) if p.scenes[st.scene_index].kind == "c-figura" and st.view.get("mode") == "pieza"]
        self.assertEqual(sorted(mov), llegadas)  # un movimiento por cada pieza que se abre, y por nada más
        for n, docs in mov.items():
            self.assertEqual(len(docs), CF.PASOS_MOVIMIENTO)
            self.assertTrue(all("cs-fantasma" in d and '"tween": ' in d for d in docs))
            # El texto visible es el del estado de llegada: el intermedio no dice nada distinto.
            visible = docs[0].split('<main class="cs-stage cs-fantasma')[1].split("</main>", 1)[1]
            self.assertIn(paginas[n].split('<main class="cs-stage')[1].split("</main>")[0], visible)
        self.assertNotIn("cs-fantasma", paginas[0])  # los fotogramas normales no cambian

    def test_el_cierre_retoma_el_gancho(self):
        for p in self.plan.piezas:
            cierre = p.scenes[-1]
            self.assertEqual(cierre.kind, "c-cierre")
            self.assertTrue(cierre.view["recuerda"], p.key)
        idea = self.plan.piezas[1]
        self.assertEqual(idea.scenes[-1].view["recuerda"], idea.gancho)  # un solo mensaje: el que abrió la pieza
        pregunta = next(x for x in self.plan.piezas if x.tipo == "pregunta")
        cierre = pregunta.scenes[-1].view  # la pregunta y su respuesta, juntas: la respuesta sola no dice de qué
        self.assertEqual((cierre["recuerda_antes"], cierre["recuerda"]), ("¿Qué suele pasar con la primera respuesta?", "Que puede ser equivocada."))
        html = CF._stage_cierre(cierre, "")[0]
        self.assertLess(html.index("¿Qué suele pasar"), html.index("Que puede ser equivocada."))

    def test_el_cierre_no_corta_la_idea_justo_antes_de_su_salvedad(self):
        idea = "La fuerza de voluntad es un recurso limitado que se agota con el uso, aunque estudios recientes no han logrado replicar ese efecto."
        p = K.pieza_idea(_libro(**{"l-1": {"idea_clave": idea}}), 0)
        self.assertEqual(p.scenes[-1].view["recuerda"], idea)
        self.assertEqual(p.portada["text"], idea)

    def test_el_patron_visual_sale_de_la_plantilla_de_la_figura(self):
        self.assertEqual(K.patron_visual({"plantilla": "comparar"}), "contraste")
        self.assertEqual(K.patron_visual({"plantilla": "pasos"}), "cadena")
        self.assertEqual(K.patron_visual({"plantilla": "ciclo"}), "ciclo")
        self.assertEqual(K.patron_visual({"plantilla": "mapa"}), "radial")
        self.assertEqual(K.patron_visual({"plantilla": "matriz", "datos": {"celdas": [{}, {}, {}]}}), "silueta")  # sin cuatro cuadrantes no hay matriz
        self.assertEqual(K.patron_visual({"plantilla": "grafica"}), "silueta")
        figura = [s for s in K.pieza_idea(self.libro, 0, breve=True).scenes if s.kind == "c-figura"]
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
        self.assertEqual({(o.tipo, o.leccion_n) for o in plan.omitidas if o.leccion_n == 1}, {("idea", 1), ("practica", 1), ("caso", 1), ("fondo", 1)})

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
        self.assertIsNone(K.no_sino("No es simplemente un archivo, sino una reconstrucción.".split()))
        self.assertIsNone(K.no_sino("No lo sabemos. Sino hubiera sido otro.".split()))  # no cruza el punto
        self.assertIsNone(K.no_sino("Pensar despacio corrige.".split()))
        # con dos «no», cuenta el más cercano al «sino»
        self.assertEqual(K.no_sino("Quien no entrena no pierde fuerza por la edad, sino por el desuso.".split())[0], 3)

    def test_de_un_no_sino_solo_se_senala_lo_afirmado(self):
        idea = "Quien no entrena no pierde fuerza por la edad, sino por el desuso."
        s = K.escena_frase("Idea", "idea", "UNA IDEA", [Part(idea, "leccion.idea_clave")])
        self.assertEqual(s.narration, idea)
        self.assertEqual(len(s.view["pages"]), 1)  # breve: se ve entera en una página
        self.assertEqual(s.view["afi"], [9, 13])
        self.assertNotIn("neg", s.view)  # qué niega el «no» no se puede saber sin analizar la frase: no se apaga nada
        final = dict(s.view, **s.beats[-1].patch)
        cuerpo, _ = CF._stage_frase(final, "UNA IDEA")
        self.assertRegex(cuerpo, r'class="w[^"]* afi">desuso\.</span>')
        self.assertIn('<span class="w">pierde</span>', cuerpo)  # «pierde fuerza» no está negado y se ve normal
        matiz = K.escena_frase("Matiz", "matiz", "EL MATIZ", [Part(idea, "leccion.autocorreccion")])
        self.assertNotIn("afi", matiz.view)  # solo en la idea

    def test_una_figura_con_datos_raros_deja_la_pieza_sin_esquema_pero_no_revienta(self):
        raros = [
            {"tipo": "diagrama", "plantilla": "matriz", "titulo": "X", "datos": {"ejeX": "no es un objeto", "ejeY": None, "celdas": [{"t": "a"}, {"t": "b"}, {"t": "c"}, {"t": "d"}]}},
            {"tipo": "diagrama", "plantilla": "mapa", "titulo": "X", "datos": {"centro": {"t": "R"}, "nodos": [{"t": "a"}, {"t": "b"}]}},
            {"tipo": "diagrama", "plantilla": "cifras", "titulo": "X", "datos": {"items": [{"n": 42, "t": "un número que no es texto"}]}},
            {"tipo": "diagrama", "plantilla": "espectro", "titulo": "X", "datos": {"polos": ["a", "b"], "marcas": [{"pos": "medio", "t": "m"}, {"pos": None, "t": "n"}]}},
        ]
        for figura in raros:
            libro = _libro(diagramas={"l-1": [figura]})
            p = K.pieza_idea(libro, 0)
            self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [], figura["plantilla"])
            for s in p.scenes:
                for texto in _textos(p):
                    self.assertNotIn("{'t'", texto)
        self.assertEqual(K.marco_figura(raros[3])["pos"], [0.5, 0.5])  # sin posición válida, al centro, como la app

    def test_lo_que_la_figura_dice_no_se_queda_fuera(self):
        tiempo = {"plantilla": "tiempo", "datos": {"eventos": [{"f": "1998", "t": "Se publica", "d": "Doce casos, sin comparación"}, {"f": "2010", "t": "Se retira"}]}}
        self.assertEqual(K.piezas_figura(tiempo)[0].lines, ["1998", "Se publica", "Doce casos, sin comparación"])
        balanza = {"plantilla": "balanza", "datos": {"inclina": "der", "izq": {"t": "A", "items": ["x"]}, "der": {"t": "B", "items": ["y"]}}}
        self.assertEqual(K.piezas_figura(balanza), [])  # hacia dónde cae es parte del mensaje y aquí no se vería
        embudo = {"plantilla": "embudo", "datos": {"etapas": [{"t": "Visitas", "v": 1000, "unidad": "al mes"}, {"t": "Compras", "v": 20}]}}
        self.assertEqual(K.piezas_figura(embudo), [])


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
        p = K.pieza_idea(libro, 0, breve=True)
        matiz = [x.text for s in p.scenes for x in s.parts if x.origin == "leccion.autocorreccion"]
        self.assertEqual(matiz, ["Frase número 1 del matiz con unas cuantas palabras de relleno para alargar. Frase número 2 del matiz con unas cuantas palabras de relleno para alargar."])
        self.assertEqual(p.scenes[0].narration, idea)  # la idea no se toca
        self.assertEqual([i for i in L.lint_pieza(p, libro) if i.level == "error"], [])
        practica = K.pieza_practica(libro, 0, breve=True)
        self.assertLessEqual(practica.estimated_seconds, K.OBJETIVO_S + 5)
        self.assertTrue(practica.scenes[0].narration.endswith("."))

    def test_rechaza_texto_que_no_esta_en_el_corpus(self):
        p = self.plan.piezas[1]
        p.scenes[0].parts[0] = Part("Lo primero que se nos ocurre casi nunca es lo cierto.", "leccion.idea_clave")
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("no es literal", mensajes)
        self.assertIn("no coincide con la locución", mensajes)

    def test_rechaza_un_recorte_que_se_come_el_arranque_de_la_frase(self):
        # «toda intuición falla» está, literal, dentro de «No toda intuición falla»… y dice lo contrario.
        p = self.plan.piezas[1]
        matiz = next(s for s in p.scenes if s.view.get("style") == "matiz")
        matiz.parts[1] = Part("toda intuición falla.", "leccion.autocorreccion")
        matiz.view["words"] = ["toda", "intuición", "falla."]
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("empieza a media frase", mensajes)

    def test_una_frase_empieza_tambien_tras_una_cita_entre_comillas_simples(self):
        fuente = "Unas entran diciendo 'Ahí estás tú!' La segunda actitud es el fundamento. Otra frase."
        self.assertTrue(L._desde_inicio_de_frase("La segunda actitud es el fundamento.", fuente))
        self.assertFalse(L._desde_inicio_de_frase("actitud es el fundamento.", fuente))
        self.assertFalse(L._desde_inicio_de_frase("estás tú!' La segunda actitud", fuente))

    def test_rechaza_texto_que_solo_se_ve_y_no_esta_en_el_corpus(self):
        def errores(cambio):
            plan = K.plan_libro(self.libro, breve=True)
            p = plan.piezas[1]
            cambio(p)
            return " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")

        figura = lambda p: next(s for s in p.scenes if s.kind == "c-figura" and s.view["mode"] == "pieza")  # noqa: E731
        self.assertIn("no es literal del corpus (t)", errores(lambda p: figura(p).view["pieces"][0].update(t="Un rótulo inventado")))
        self.assertIn("no es literal del corpus (items)", errores(lambda p: figura(p).view["pieces"][0].update(items=["Falla siempre"])))
        self.assertIn("no es literal del corpus (title)", errores(lambda p: figura(p).view.update(title="Otro título")))
        self.assertIn("no es literal del corpus (tema)", errores(lambda p: p.scenes[0].view.update(tema="Un tema que no existe")))
        self.assertIn("no es literal del corpus (author)", errores(lambda p: p.scenes[1].view.update(author="Otro Autor")))
        self.assertIn("miniatura", errores(lambda p: p.portada.update(text="Lo primero que se nos ocurre siempre es falso.")))
        self.assertIn("rótulo no declarado", errores(lambda p: p.scenes[0].view.update(kicker="LECCIÓN 1 DE 3")))
        self.assertIn("título de publicación", errores(lambda p: setattr(p, "titulo_pub", "Un título de mi cosecha")))
        self.assertIn("descripción de publicación", errores(lambda p: setattr(p, "descripcion_pub", "El matiz: toda intuición falla.")))
        self.assertEqual(errores(lambda p: None), "")

    def test_rechaza_una_respuesta_que_no_es_la_correcta_de_su_pregunta(self):
        p = next(x for x in self.plan.piezas if x.tipo == "pregunta")
        respuesta = next(s for s in p.scenes if s.view.get("style") == "respuesta")
        respuesta.parts[1] = Part("Que es la correcta.", "pregunta.opcion")  # literal del corpus, pero es una opción FALSA
        respuesta.view["words"] = " ".join(x.text for x in respuesta.parts).split()[2:]
        mensajes = " ".join(str(i) for i in L.lint_pieza(p, self.libro) if i.level == "error")
        self.assertIn("no es la opción correcta", mensajes)

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
                        rotulos = sum(len(str(x["t"]).split()) for x in (v.get("fig") or {}).get("pieces", [])) + len(str((v.get("fig") or {}).get("title") or "").split())
                        self.assertLessEqual(CF.palabras_en_pantalla(s.kind, v) - rotulos, K.PAGINA)

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
        figura = [s for s in K.pieza_idea(self.libro, 0, breve=True).scenes if s.kind == "c-figura"]
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


class FondoConComprobacionYConexionesTest(unittest.TestCase):
    """La versión larga pregunta antes de seguir y sitúa la idea entre otros autores, siempre con texto del corpus."""

    def _leccion(self, **kw):
        from tools.video.corpus import Lesson, Question

        base = dict(
            id="L1", titulo="Ampliar las opciones", orden=1,
            cuerpo="\n\n".join(["Decidir entre una sola opción y nada es decidir a ciegas. " * 6] * 3),
            idea_clave="Considerar al menos dos alternativas reales mejora el resultado.",
            autocorreccion="Demasiadas alternativas pueden paralizar.",
            conexion_cruzada="Esto conecta con Kahneman, que describe los sesgos de base, y con Olson, que estudia los grupos. Es lectura nuestra.",
            autores_relacionados=["Daniel Kahneman", "Mancur Olson", "Gary Klein"],
            preguntas=[Question("q1", "¿Por qué no basta con conocer los sesgos?", ["Porque conocerlos no impide caer en ellos", "Porque son pocos"], 0, "Por eso proponen un proceso.")],
        )
        base.update(kw)
        return Lesson(**base)

    def _fondo(self, lesson):
        from tools.video.corpus import Book

        book = Book(id="B", titulo="Decisive", autor="Chip Heath", eje="Psicología y Conducta", descripcion="", lessons=[lesson])
        return K.pieza_fondo(book, 0), book

    def test_conexion_entera_con_los_autores_que_el_texto_nombra(self):
        pieza, book = self._fondo(self._leccion())
        con = next(s for s in pieza.scenes if s.section == "Conexiones")
        self.assertEqual(con.narration, "Esto conecta con Kahneman, que describe los sesgos de base, y con Olson, que estudia los grupos. Es lectura nuestra.")
        self.assertEqual([p.origin for p in con.parts], ["leccion.conexion_cruzada"])
        # Klein está en la lista pero el texto no lo nombra: no se muestra.
        self.assertEqual([p["t"] for p in con.view["fig"]["pieces"]], ["Daniel Kahneman", "Mancur Olson"])
        finales = [b.patch.get("fig_on") for b in con.beats if "fig_on" in b.patch] or [con.view["fig_on"]]
        self.assertEqual(finales[-1], [0, 1])
        self.assertFalse(L.has_errors(L.lint_pieza(pieza, book)))

    def test_conexion_que_remite_a_la_serie_o_demasiado_larga_no_entra(self):
        for texto in ("Como vimos en la lección anterior, Kahneman describe los sesgos de base y Olson los grupos.", "palabra " * 200):
            pieza, _ = self._fondo(self._leccion(conexion_cruzada=texto))
            self.assertFalse([s for s in pieza.scenes if s.section == "Conexiones"], texto[:30])

    def test_comprobacion_pregunta_pausa_y_respuesta_correcta(self):
        pieza, book = self._fondo(self._leccion())
        tipos = [(s.kind, s.section) for s in pieza.scenes]
        i = tipos.index(("c-pausa", "Pregunta"))
        self.assertEqual(pieza.scenes[i - 1].narration, "¿Por qué no basta con conocer los sesgos?")
        self.assertEqual(pieza.scenes[i - 1].view["kicker"], K.ROTULOS["comprueba"])
        self.assertIn("Porque conocerlos no impide caer en ellos.", pieza.scenes[i + 1].narration)
        self.assertLess(i, next(n for n, s in enumerate(pieza.scenes) if s.section == "Conexiones"))

    def test_el_lint_rechaza_una_respuesta_que_no_es_la_correcta(self):
        pieza, book = self._fondo(self._leccion())
        resp = next(s for s in pieza.scenes if s.section == "Respuesta")
        resp.parts[1] = K.Part("Porque son pocos.", "pregunta.opcion")
        self.assertTrue(any("no es la opción correcta" in i.message for i in L.lint_pieza(pieza, book)))


class CarrilTest(FondoConComprobacionYConexionesTest):
    """El mapa de tramos: un tramo por sección (y por párrafo de la explicación), sin texto."""

    def test_tramos_y_estado_en_cada_fotograma(self):
        pieza, _ = self._fondo(self._leccion())
        tramos = CF.capitulos(pieza)
        self.assertGreaterEqual(len(tramos), CF.CARRIL_MIN)
        self.assertEqual(tramos[0][0], 0)
        self.assertEqual(tramos[-1][1], len(pieza.scenes) - 2)  # el cierre no cuenta
        self.assertTrue(all(a <= b and d > 0 for a, b, d in tramos))
        self.assertEqual([a for a, _, _ in tramos][1:], [b + 1 for _, b, _ in tramos][:-1])  # sin huecos ni solapes
        # la pregunta, su pausa y su respuesta son un solo tramo
        i = next(n for n, s in enumerate(pieza.scenes) if s.kind == "c-pausa")
        self.assertTrue(any(a <= i - 1 and i + 1 <= b for a, b, _ in tramos))
        estados, paginas = CF.pieza_pages(pieza)
        medio = next(n for n, st in enumerate(estados) if st.scene_index == tramos[2][0])
        html = paginas[medio]
        self.assertEqual(html.count('<i class="hecho"'), 2)
        self.assertEqual(html.count('<i class="en"'), 1)
        self.assertNotIn("cs-carril", paginas[-1])  # el cierre va limpio
        self.assertNotIn("cs-carril", CF.portada_html(pieza))

    def test_una_pieza_corta_no_lleva_mapa(self):
        from tools.video.corpus import Book

        lesson = self._leccion()
        book = Book(id="B", titulo="Decisive", autor="Chip Heath", eje="Psicología y Conducta", descripcion="", lessons=[lesson])
        pieza = K.pieza_pregunta(book, 0)
        self.assertLess(len(CF.capitulos(pieza)), CF.CARRIL_MIN)
        self.assertNotIn("cs-carril", CF.pieza_pages(pieza)[1][0])


class IconosLucideTest(unittest.TestCase):
    def test_los_iconos_propuestos_existen_y_ninguno_nuevo_sale_sin_aprobar(self):
        import json

        self.assertGreater(len(K.ICONOS_LUCIDE), 200)
        self.assertTrue(all(n.startswith("lu-") for n in K.ICONOS_LUCIDE))
        for archivo in sorted(K.ICONOS_DIR.glob("*.json")):
            for e in json.loads(archivo.read_text(encoding="utf-8"))["piezas"]:
                self.assertTrue(not e["icono"] or e["icono"] in K.ICONOS_VALIDOS, f"{archivo.name}: {e['icono']}")
        usados = set(K.iconos_de_piezas(recargar=True).values())
        self.assertFalse({i for i in usados if i.startswith("lu-")}, "hay iconos de Lucide en uso sin que nadie los haya aprobado")

    def test_el_archivo_de_iconos_lleva_su_licencia(self):
        assets = K.ICONOS_DIR.parent / "assets"
        self.assertIn("ISC", (assets / "LICENCIA-lucide.txt").read_text(encoding="utf-8"))
        self.assertIn("ISC", (assets / "iconos-lucide.js").read_text(encoding="utf-8")[:300])


class RecorridoTest(unittest.TestCase):
    """El libro, idea a idea: el título y la idea literal de cada lección que tiene una."""

    def _libro(self, n=4, **kw):
        from tools.video.corpus import Book, Lesson

        lecciones = [
            Lesson(id=f"L{i}", titulo=f"Lección número {i}", orden=i, cuerpo="Texto del cuerpo de la lección. " * 20,
                   idea_clave=f"La idea central número {i} se dice en una frase.", autocorreccion="Con su matiz.")
            for i in range(1, n + 1)
        ]
        lecciones[1].idea_clave = ""  # sin idea redactada: no entra
        datos = dict(id="B", titulo="Decisive", autor="Chip Heath", eje="Psicología y Conducta", descripcion="Un proceso para decidir mejor frente a cuatro villanos.", lessons=lecciones)
        datos.update(kw)
        return Book(**datos)

    def test_recorre_las_lecciones_con_idea_y_cuenta_solo_esas(self):
        book = self._libro()
        pieza = K.pieza_recorrido(book)
        nodos = [s for s in pieza.scenes if s.kind == "c-nodo"]
        self.assertEqual([s.view["label"] for s in nodos], ["Lección número 1", "Lección número 3", "Lección número 4"])
        self.assertEqual({s.view["n"] for s in nodos}, {3})
        self.assertEqual(nodos[1].narration, "Lección número 3. La idea central número 3 se dice en una frase.")
        self.assertEqual([p.origin for p in nodos[1].parts], ["leccion[3].titulo", "leccion[3].idea_clave"])
        self.assertEqual(pieza.scenes[0].narration, "Un proceso para decidir mejor frente a cuatro villanos.")
        self.assertFalse(L.has_errors(L.lint_pieza(pieza, book)), [str(i) for i in L.lint_pieza(pieza, book) if i.level == "error"])

    def test_con_menos_de_tres_ideas_no_hay_recorrido_y_queda_anotado(self):
        book = self._libro(n=3)
        self.assertIsNone(K.pieza_recorrido(book))
        plan = K.plan_libro(book)
        self.assertIn(("recorrido", 0), {(o.tipo, o.leccion_n) for o in plan.omitidas})

    def test_va_al_final_del_orden_de_publicacion(self):
        plan = K.plan_libro(self._libro())
        self.assertEqual(plan.orden[-1], "recorrido")

    def test_el_lint_rechaza_una_idea_cambiada(self):
        book = self._libro()
        pieza = K.pieza_recorrido(book)
        nodo = next(s for s in pieza.scenes if s.kind == "c-nodo")
        nodo.parts[1] = K.Part("La idea central número 1 se dice mejor así.", nodo.parts[1].origin)
        self.assertTrue(L.has_errors(L.lint_pieza(pieza, book)))
