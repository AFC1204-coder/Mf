import unittest

from tools.video import scriptwriter as SW
from tools.video import text as T
from tools.video.lint import has_errors, lint_episode
from tools.video.tests.fixtures import libro


class Corpus(unittest.TestCase):
    def test_lecciones_en_orden_y_preguntas_repartidas(self):
        b = libro()
        self.assertEqual([l.id for l in b.lessons], ["l-1", "l-2", "l-3"])
        self.assertEqual(len(b.lessons[0].preguntas), 1)
        self.assertEqual([q.id for q in b.loose_questions], ["q-9"])

    def test_el_hilo_sale_del_corpus_por_prioridad(self):
        b = libro()
        self.assertEqual(b.lessons[0].thread(), ("Lo primero que se nos ocurre no siempre es lo cierto.", "idea_clave"))
        self.assertEqual(b.lessons[1].thread(), ("La segunda lección empieza aquí.", "cuerpo"))
        self.assertEqual(b.lessons[2].thread()[1], "cita_memorable")


class Leccion(unittest.TestCase):
    def setUp(self):
        self.b = libro()

    def test_secuencia_didactica_fija(self):
        ep = SW.lesson_episode(self.b, 0)
        self.assertEqual(ep.sections, ["Idea", "Desarrollo", "Esquema", "Matiz", "Práctica", "Repaso"])
        self.assertEqual([s.kind for s in ep.scenes[:2]], ["gancho", "portada"])
        self.assertEqual(ep.scenes[-1].kind, "cierre")
        self.assertEqual(ep.counter, "LECCIÓN 1/3")
        # Las secciones aparecen en el orden del índice y sin volver atrás.
        vistas = [s.section for s in ep.scenes if s.section]
        self.assertEqual(sorted(vistas, key=ep.sections.index), vistas)

    def test_solo_se_ofrecen_las_secciones_que_la_leccion_tiene(self):
        ep = SW.lesson_episode(self.b, 2)
        self.assertEqual(ep.sections, ["Idea", "Desarrollo"])

    def test_la_voz_solo_dice_corpus_o_formulas_fijas(self):
        for i in range(3):
            for fmt in SW.FORMATS:
                ep = SW.lesson_episode(self.b, i, fmt)
                self.assertFalse(has_errors(lint_episode(ep, self.b)), [str(x) for x in lint_episode(ep, self.b)])

    def test_puente_recupera_la_idea_anterior_y_el_cierre_anuncia_la_siguiente(self):
        ep = SW.lesson_episode(self.b, 1)
        puente = next(s for s in ep.scenes if s.kind == "puente")
        self.assertIn(self.b.lessons[0].thread()[0], puente.narration)
        self.assertIn("La tercera idea", ep.scenes[-1].narration)
        self.assertFalse(any(s.kind == "puente" for s in SW.lesson_episode(self.b, 0).scenes))

    def test_la_idea_abre_y_cierra_con_la_misma_frase(self):
        ep = SW.lesson_episode(self.b, 0)
        hilo = self.b.lessons[0].thread()[0]
        idea = next(s for s in ep.scenes if s.kind == "idea")
        self.assertIn(hilo, idea.narration)
        self.assertIn(hilo, ep.scenes[-1].narration)

    def test_si_la_idea_es_la_primera_frase_no_se_repite_en_el_desarrollo(self):
        ep = SW.lesson_episode(self.b, 1)
        desarrollo = " ".join(s.narration for s in ep.scenes if s.section == "Desarrollo")
        self.assertNotIn("La segunda lección empieza aquí.", desarrollo)
        idea = next(s for s in ep.scenes if s.kind == "idea")
        self.assertEqual(idea.view["kicker"], "EL PUNTO DE PARTIDA")

    def test_el_desarrollo_de_la_clase_lee_el_cuerpo_entero(self):
        ep = SW.lesson_episode(self.b, 0)
        desarrollo = " ".join(s.narration for s in ep.scenes if s.section == "Desarrollo")
        self.assertEqual(desarrollo, T.clean(self.b.lessons[0].cuerpo))

    def test_pregunta_pensar_respuesta(self):
        ep = SW.lesson_episode(self.b, 0)
        q = [s for s in ep.scenes if s.kind == "pregunta"]
        self.assertEqual(len(q), 3)
        self.assertEqual(q[1].narration, "")
        self.assertEqual(q[1].hold_s, 5.0)
        self.assertEqual([b.patch["countdown"] for b in q[1].beats], [3, 2, 1])
        self.assertTrue(q[2].view["reveal"])
        self.assertIn("la B: Que puede ser equivocada.", q[2].narration)
        self.assertFalse(any(s.kind == "pregunta" for s in SW.lesson_episode(self.b, 0, with_quiz=False).scenes))

    def test_las_opciones_se_leen_en_voz_alta_y_se_iluminan_a_la_vez(self):
        ep = SW.lesson_episode(self.b, 0)
        ask = next(s for s in ep.scenes if s.kind == "pregunta")
        opciones = self.b.lessons[0].preguntas[0].opciones
        for letra, o in zip("ABCD", opciones):
            self.assertIn(f"Opción {letra}. {o}", ask.narration)
        self.assertEqual([b.patch["active"] for b in ask.beats], [0, 1, 2, 3])
        palabras = ask.narration.split()
        for i, b in enumerate(ask.beats):
            self.assertEqual(palabras[b.at_word:b.at_word + 2], ["Opción", "ABCD"[i] + "."])
        self.assertEqual(ask.view["active"], -1)

    def test_los_terminos_entran_cuando_se_nombran(self):
        ep = SW.lesson_episode(self.b, 1)
        con_chips = [s for s in ep.scenes if s.view.get("chips")]
        self.assertTrue(con_chips)
        for s in con_chips:
            palabras = s.narration.split()
            for chip, beat in zip(s.view["chips"], s.beats):
                self.assertTrue(palabras[beat.at_word].strip("«»\"“”(").startswith(chip.split()[0]), (chip, palabras[beat.at_word]))

    def test_corto_es_mas_breve_y_no_lleva_pregunta(self):
        clase = SW.lesson_episode(self.b, 0, "clase")
        corto = SW.lesson_episode(self.b, 0, "corto")
        self.assertLess(corto.total_words, clase.total_words)
        self.assertFalse(any(s.kind in ("pregunta", "portada", "puente") for s in corto.scenes))

    def test_corto_salta_frases_que_dependen_de_la_anterior(self):
        corto = SW.lesson_episode(self.b, 1, "corto")
        desarrollo = [s.narration for s in corto.scenes if s.section == "Desarrollo"]
        self.assertFalse(any(n.startswith(("Esto ", "Por eso")) for n in desarrollo), desarrollo)

    def test_corto_recorta_desarrollo_si_se_pasa_de_tiempo(self):
        b = libro()
        frase = "Cada párrafo empieza con una frase bastante larga para llenar el tiempo disponible del vídeo corto sin remedio alguno"
        b.lessons[0].cuerpo = "\n\n".join(f"{frase} número {i}. Y sigue con algo más." for i in range(1, 5))
        b.lessons[0].autocorreccion = " ".join(["palabra"] * 60) + "."
        b.lessons[0].aplicacion_practica = " ".join(["acción"] * 60) + "."
        corto = SW.lesson_episode(b, 0, "corto")
        desarrollo = [s for s in corto.scenes if s.section == "Desarrollo"]
        self.assertLess(len(desarrollo), 3)
        self.assertGreaterEqual(len(desarrollo), 1)
        self.assertEqual([s.view["step"] for s in desarrollo], [[i + 1, len(desarrollo)] for i in range(len(desarrollo))])
        self.assertFalse(has_errors(lint_episode(corto, b)))

    def test_huella_estable_y_sensible_al_contenido(self):
        a = SW.lesson_episode(self.b, 0).fingerprint()
        self.assertEqual(a, SW.lesson_episode(libro(), 0).fingerprint())
        otro = libro()
        otro.lessons[0].cuerpo += " Una frase nueva."
        self.assertNotEqual(a, SW.lesson_episode(otro, 0).fingerprint())


class GanchoYTextoEnPantalla(unittest.TestCase):
    def setUp(self):
        self.b = libro()

    def test_el_gancho_abre_con_la_pregunta_que_luego_se_contesta(self):
        ep = SW.lesson_episode(self.b, 0)
        gancho = ep.scenes[0]
        pregunta = next(s for s in ep.scenes if s.kind == "pregunta")
        self.assertEqual(gancho.view["question"], pregunta.view["question"])
        self.assertIn(gancho.view["question"], gancho.narration)
        self.assertIn(SW.PHRASES["pregunta_vuelve"], pregunta.narration)

    def test_el_cierre_deja_abierta_la_pregunta_del_siguiente_episodio(self):
        for i in range(len(self.b.lessons) - 1):
            sig_q = self.b.lessons[i + 1].pick_question()
            cierre = SW.lesson_episode(self.b, i).scenes[-1]
            if sig_q:
                self.assertTrue(cierre.narration.endswith(sig_q.texto))
            else:
                self.assertNotIn("next_question", cierre.view)
        q1 = self.b.lessons[0].pick_question()
        self.assertTrue(SW.presentation_episode(self.b).scenes[-1].narration.endswith(q1.texto))

    def test_sin_pregunta_no_hay_gancho(self):
        self.assertEqual(SW.lesson_episode(self.b, 0, with_quiz=False).scenes[0].kind, "portada")
        self.assertFalse(any(s.kind == "gancho" for s in SW.lesson_episode(self.b, 2).scenes))

    def test_el_corto_abre_con_la_pregunta_y_cierra_con_su_respuesta(self):
        ep = SW.lesson_episode(self.b, 0, "corto")
        ganchos = [s for s in ep.scenes if s.kind == "gancho"]
        self.assertEqual(len(ganchos), 2)
        self.assertIs(ep.scenes[0], ganchos[0])
        q = self.b.lessons[0].pick_question()
        self.assertIn(q.opciones[q.correcta].rstrip("."), ganchos[1].narration)
        self.assertEqual(ep.scenes[-1].kind, "cierre")

    def test_en_pantalla_solo_queda_una_frase_ancla(self):
        for i in range(3):
            for fmt in SW.FORMATS:
                ep = SW.lesson_episode(self.b, i, fmt)
                for s in ep.scenes:
                    if s.kind in ("idea", "puente", "texto", "cierre"):
                        self.assertLessEqual(T.n_words(s.view.get("text") or ""), SW.ANCHOR_MAX_WORDS + 5, s.view.get("text"))
                avisos = [str(x) for x in lint_episode(ep, self.b) if "en pantalla" in x.message]
                self.assertEqual(avisos, [])

    def test_el_ancla_es_siempre_un_trozo_literal(self):
        larga = "Una de las inversiones más contraintuitivas del autor respecto a la negociación convencional de toda la vida: el sí prematuro es una señal de peligro."
        ancla = T.anchor_clause(larga, 16)
        self.assertTrue(ancla.startswith("…"))
        self.assertIn(ancla.lstrip("…"), larga)
        sin_tesis = "La sabiduría convencional de ventas busca obtener síes pequeños que creen impulso hacia el sí final, la técnica del pie en la puerta de siempre."
        corta = T.anchor_clause(sin_tesis, 16)
        self.assertTrue(corta.endswith("…"))
        self.assertTrue(sin_tesis.startswith(corta.rstrip("…")))
        self.assertEqual(T.anchor_clause("Frase breve.", 16), "Frase breve.")

    def test_la_escalera_acumula_los_pasos_ya_dados(self):
        # Sin figura guiable el desarrollo conserva la escalera; con figura la sustituye el mini-esquema.
        b = libro()
        b.lessons[0].diagramas = []
        ep = SW.lesson_episode(b, 0)
        pasos = [s for s in ep.scenes if s.section == "Desarrollo"]
        self.assertTrue(all("guide" not in s.view for s in pasos))
        if len(pasos) > 1:
            self.assertEqual([len(s.view["trail"]) for s in pasos], list(range(len(pasos))))
            for s in pasos:
                for rotulo in s.view["trail"]:
                    self.assertLessEqual(T.n_words(rotulo), SW.STEP_LABEL_WORDS)

    def test_el_control_avisa_si_hay_demasiado_texto_en_pantalla(self):
        ep = SW.lesson_episode(self.b, 0)
        idea = next(s for s in ep.scenes if s.kind == "idea")
        idea.view["text"] = "palabra " * 60
        self.assertTrue(any("en pantalla" in x.message for x in lint_episode(ep, self.b)))


class EsquemaRecorrido(unittest.TestCase):
    PASOS = {"plantilla": "pasos", "titulo": "T", "datos": {"pasos": [{"t": "Uno", "d": "Primero esto"}, {"t": "Dos", "d": "Luego aquello"}, {"t": "Tres"}]}}
    COMPARAR = {"plantilla": "comparar", "titulo": "T", "datos": {"izq": {"t": "A", "items": ["a1", "a2"]}, "der": {"t": "B", "items": ["b1"]}}}

    def test_piezas_en_orden_de_lectura(self):
        self.assertEqual(SW.diagram_walk(self.PASOS), [["Uno", "Primero esto"], ["Dos", "Luego aquello"], ["Tres"]])
        self.assertEqual(SW.diagram_walk(self.COMPARAR), [["A", "a1", "a2"], ["B", "b1"]])

    def test_no_se_recorre_lo_que_no_es_de_cajas_ni_lo_muy_largo(self):
        self.assertEqual(SW.diagram_walk({"plantilla": "ciclo", "datos": {"nodos": [{"t": "x"}]}}), [])
        largo = {"plantilla": "pasos", "datos": {"pasos": [{"t": "palabra " * 40}, {"t": "palabra " * 60}]}}
        self.assertEqual(SW.diagram_walk(largo), [])

    def test_sin_piezas_guiables_el_esquema_se_ensena_entero(self):
        b = libro()
        b.lessons[0].diagramas = [{"tipo": "diagrama", "plantilla": "cifras", "titulo": "Cifras", "pie": "Del texto.", "datos": {"items": [{"n": "85 %", "t": "Una cifra"}]}}]
        ep = SW.lesson_episode(b, 0)
        esc = [s for s in ep.scenes if s.kind == "esquema"]
        self.assertEqual(len(esc), 1)
        self.assertFalse(any(s.kind == "guia" for s in ep.scenes))


class EsquemaGuia(unittest.TestCase):
    MAPA = {"tipo": "diagrama", "plantilla": "mapa", "titulo": "Tres cosas del anclaje", "pie": "Tesis de Kahneman.",
            "datos": {"centro": "Anclaje", "nodos": [{"t": "Número inicial", "d": "Sesga la estimación posterior"}, {"t": "Cifras absurdas", "d": "La ruleta también ancla"}, {"t": "Fijar tu cifra", "d": "Antes de escuchar la ajena"}]}}

    def setUp(self):
        self.b = libro()
        self.b.lessons[1].diagramas = [self.MAPA]
        self.ep = SW.lesson_episode(self.b, 1)

    def test_la_clase_abre_con_la_vision_de_conjunto_y_nombra_las_piezas(self):
        previa = next(s for s in self.ep.scenes if s.kind == "guia" and s.view["mode"] == "legend")
        self.assertEqual(previa.section, "Idea")
        self.assertIn("La lección en una imagen: Tres cosas del anclaje.", previa.narration)
        self.assertEqual([b.patch["active"] for b in previa.beats], [0, 1, 2, -1])
        for t in ("Número inicial.", "Cifras absurdas.", "Fijar tu cifra."):
            self.assertIn(t, previa.narration)
        self.assertEqual(self.ep.scenes.index(previa), next(i for i, s in enumerate(self.ep.scenes) if s.kind == "idea") + 1)

    def test_el_desarrollo_lleva_el_mini_esquema_y_no_los_terminos_sueltos(self):
        dev = [s for s in self.ep.scenes if s.section == "Desarrollo"]
        self.assertTrue(dev)
        for s in dev:
            self.assertTrue(s.view["guide"])
            self.assertEqual(s.view["n"], 3)
            self.assertEqual(s.view["order"], [0, 2, 1])  # el mapa dibuja primero la columna izquierda (nodos 0 y 2)
            self.assertNotIn("chips", s.view)
            self.assertNotIn("trail", s.view)

    def test_la_pieza_se_ilumina_cuando_la_voz_la_nombra(self):
        dev = next(s for s in self.ep.scenes if s.section == "Desarrollo" and "ruleta" in s.narration.lower() or "cifras absurdas" in s.narration.lower())
        self.assertTrue(dev.beats or dev.view["active"] >= 0)
        palabras = dev.narration.split()
        for b in dev.beats:
            self.assertLess(b.at_word, len(palabras))

    def test_la_recuperacion_oculta_piensa_y_revela(self):
        esc = [s for s in self.ep.scenes if s.section == "Esquema"]
        self.assertEqual([s.view["mode"] for s in esc], ["ask", "ask", "piece", "piece", "piece", "done"])
        ask, think, *reveal, done = esc
        self.assertEqual(ask.view["shown"], 0)
        self.assertIn("Antes de seguir, intenta recordar las piezas del esquema: Tres cosas del anclaje.", ask.narration)
        self.assertEqual(think.narration, "")
        self.assertEqual(think.hold_s, 5.0)
        self.assertEqual([b.patch["countdown"] for b in think.beats], [3, 2, 1])
        self.assertEqual([(s.view["active"], s.view["shown"]) for s in reveal], [(0, 1), (1, 2), (2, 3)])
        self.assertIn("Número inicial. Sesga la estimación posterior.", reveal[0].narration)
        self.assertEqual(done.narration, "Tesis de Kahneman.")
        self.assertEqual(done.view["shown"], 3)
        self.assertFalse(any(s.kind == "esquema" for s in self.ep.scenes))

    def test_lo_que_se_lee_es_literal_de_la_figura_y_pasa_el_control(self):
        for fmt in SW.FORMATS:
            ep = SW.lesson_episode(self.b, 1, fmt)
            self.assertFalse(has_errors(lint_episode(ep, self.b)), [str(x) for x in lint_episode(ep, self.b)])

    def test_el_corto_enseña_la_silueta_con_su_pie_sin_recuperacion(self):
        corto = SW.lesson_episode(self.b, 1, "corto")
        self.assertFalse(any(s.view.get("mode") == "ask" for s in corto.scenes))
        esq = [s for s in corto.scenes if s.section == "Esquema"]
        self.assertEqual(len(esq), 1)
        self.assertIn("Tesis de Kahneman.", esq[0].narration)

    def test_si_las_piezas_son_muchas_palabras_solo_se_leen_los_titulos(self):
        largo = {"tipo": "diagrama", "plantilla": "pasos", "titulo": "Largo", "pie": "Pie.", "datos": {"pasos": [{"t": f"Paso {i}", "d": "palabra " * 30} for i in range(1, 5)]}}
        self.b.lessons[1].diagramas = [largo]
        ep = SW.lesson_episode(self.b, 1)
        reveal = [s for s in ep.scenes if s.view.get("mode") == "piece"]
        self.assertEqual([s.narration for s in reveal], ["Paso 1.", "Paso 2.", "Paso 3.", "Paso 4."])
        self.assertTrue(all(not s.view["pieces"][s.view["active"]]["d"] for s in reveal))

    def test_se_mantiene_cada_pieza_con_su_caja_en_el_svg(self):
        from tools.video import guia as G

        mapa5 = {"plantilla": "mapa", "datos": {"nodos": [{"t": f"N{i}"} for i in range(5)]}}
        self.assertEqual(G.order(G.pieces(mapa5)), [0, 3, 1, 4, 2])
        comparar = {"plantilla": "comparar", "datos": {"izq": {"t": "A", "items": ["a"]}, "der": {"t": "B", "items": ["b"]}}}
        self.assertEqual(G.order(G.pieces(comparar)), [0, 1])


class Bloques(unittest.TestCase):
    def test_los_parrafos_largos_se_parten_por_frases_enteras(self):
        frase = "Esta es una frase de relleno que tiene exactamente doce palabras en total. "
        cuerpo = (frase * 20).strip()
        bloques = SW.chunk_body(cuerpo)
        self.assertGreater(len(bloques), 1)
        self.assertEqual(" ".join(bloques), cuerpo)
        self.assertTrue(all(T.n_words(b) <= 110 for b in bloques))
        self.assertTrue(all(b.endswith(".") for b in bloques))


class Serie(unittest.TestCase):
    def setUp(self):
        self.b = libro()
        self.serie = SW.book_series(self.b)

    def test_presentacion_lecciones_y_repaso(self):
        self.assertEqual([e.kind for e in self.serie], ["presentacion", "leccion", "leccion", "leccion", "repaso"])
        self.assertEqual([e.key[:2] for e in self.serie], ["00", "01", "02", "03", "99"])
        for ep in self.serie:
            self.assertFalse(has_errors(lint_episode(ep, self.b)), [str(x) for x in lint_episode(ep, self.b)])

    def test_la_presentacion_ensena_mapa_y_recorrido(self):
        p = self.serie[0]
        self.assertEqual(p.sections, ["El libro", "Ideas", "Recorrido"])
        ruta = [s for s in p.scenes if s.kind == "ruta"]
        self.assertEqual(len(ruta), 3)
        self.assertEqual(ruta[-1].view["shown"], 3)

    def test_el_repaso_repite_las_mismas_frases_de_la_serie(self):
        r = self.serie[-1]
        voz = " ".join(s.narration for s in r.scenes)
        for lec in self.b.lessons:
            self.assertIn(lec.thread()[0], voz)
        self.assertIn("Pensar bien es frenar a tiempo.", voz)
        self.assertEqual(sum(1 for s in r.scenes if s.kind == "pregunta" and s.view["reveal"]), 2)

    def test_recorrido_largo_no_lee_todos_los_titulos(self):
        b = libro()
        base = b.lessons[0]
        b.lessons = [type(base)(id=f"x-{i}", titulo=f"Lección número {i}", orden=i, cuerpo="Texto de la lección. Otra frase.") for i in range(1, 13)]
        p = SW.presentation_episode(b)
        ruta = [s for s in p.scenes if s.kind == "ruta"]
        self.assertEqual(len(ruta), 1)
        self.assertEqual(len(ruta[0].beats), 12)


class CalidadDelGuion(unittest.TestCase):
    def test_detecta_locucion_que_no_esta_en_el_corpus(self):
        b = libro()
        ep = SW.lesson_episode(b, 0)
        desarrollo = next(s for s in ep.scenes if s.section == "Desarrollo")
        desarrollo.parts[0].text += " Y un dato inventado: el 87 % lo confirma."
        errores = [i for i in lint_episode(ep, b) if i.level == "error"]
        self.assertTrue(any("no es literal" in e.message for e in errores))

    def test_detecta_pregunta_sin_respuesta_valida(self):
        b = libro()
        ep = SW.lesson_episode(b, 0)
        next(s for s in ep.scenes if s.kind == "pregunta").view["correct"] = 9
        self.assertTrue(has_errors(lint_episode(ep, b)))

    def test_avisa_si_la_leccion_no_tiene_esquema(self):
        b = libro()
        avisos = [i.message for i in lint_episode(SW.lesson_episode(b, 1), b) if i.level == "aviso"]
        self.assertTrue(any("esquema" in a for a in avisos))


if __name__ == "__main__":
    unittest.main()
