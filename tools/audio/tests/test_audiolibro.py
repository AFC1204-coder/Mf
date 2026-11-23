"""Audiolibro: lo que se dice es el texto de la lección y la huella coincide con la de la app."""

from tools.audio import generar_audiolibro as G


def test_huella_igual_que_en_la_app():
    # El mismo valor está fijado en tests/audio.test.js: si una de las dos cuentas cambia, falla uno de los dos.
    assert G.huella_texto("Señal — antojo", "Uno.\n\nDos «tres» 😀.", "Pero no siempre.") == "f5bf28c3"
    assert G.huella_texto(None, None, None) == G.huella_texto("", "", "")
    assert G.huella_texto("a", "b", "c") != G.huella_texto("a", "b ", "c")


def test_partes_solo_texto_de_la_leccion_y_las_dos_formulas():
    partes = G.partes_de_leccion(3, "El ancla", "Primero esto.\n\nLuego **aquello**.", "No vale siempre.")
    assert partes == [["Lección 3: El ancla."], ["Primero esto.", "Luego aquello."], ["El matiz.", "No vale siempre."]]
    assert G.partes_de_leccion(1, "¿Por qué?", "Cuerpo.", "")[0] == ["Lección 1: ¿Por qué?"]
    assert len(G.partes_de_leccion(1, "T", "Cuerpo.", "Matiz.", con_matiz=False)) == 2


def test_parrafo_largo_se_corta_entre_frases():
    frases = [f"Frase número {i} con algo de relleno para ocupar." for i in range(40)]
    trozos = G._trozos(" ".join(frases), maximo=300)
    assert len(trozos) > 1 and all(len(t) <= 300 for t in trozos)
    assert " ".join(trozos) == " ".join(frases)


def test_al_dia_y_receta(tmp_path):
    mp3 = tmp_path / "a.mp3"
    mp3.write_bytes(b"x" * 2000)
    assert G.al_dia({"h": "aa", "r": "bb"}, "aa", "bb", mp3)
    assert not G.al_dia({"h": "aa", "r": "bb"}, "ab", "bb", mp3)
    assert not G.al_dia({"h": "aa", "r": "bb"}, "aa", "cc", mp3)
    assert not G.al_dia({"h": "aa", "r": "bb"}, "aa", "bb", tmp_path / "no.mp3")
    assert G.huella_receta("voz-a") != G.huella_receta("voz-b")
    assert G.huella_receta("voz-a") != G.huella_receta("voz-a", con_matiz=False)


def test_duracion_esperada_cuenta_las_pausas():
    # título | dos párrafos | rótulo y matiz: pausa larga al acabar cada parte, corta entre párrafos, ninguna al final
    d = G.duracion_esperada([[2.0], [10.0, 12.0], [1.0, 8.0]])
    assert abs(d - (33.0 + 2 * G.PAUSA_PARTE_S + 2 * G.PAUSA_PARRAFO_S)) < 1e-9
    assert G.duracion_esperada([[5.0]]) == 5.0


def test_locucion_cortada_se_detecta():
    from tools.video.tts.base import WordTiming
    from tools.video.tts.edge_tts_engine import incompleta

    texto = "Uno dos tres cuatro cinco seis siete ocho nueve diez."
    marcas = [WordTiming(text=w, start_s=i * 0.4, end_s=i * 0.4 + 0.3) for i, w in enumerate(texto.rstrip(".").split())]
    assert incompleta(texto, marcas, 4.3) == ""
    assert "marcas" in incompleta(texto, marcas[:6], 2.7)  # llegaron marcas para seis de diez palabras
    assert "dura" in incompleta(texto, marcas, 2.5)  # el audio acaba antes que la última palabra
    assert incompleta("El matiz.", marcas[:2], 1.2) == ""  # las frases muy cortas no se juzgan por el recuento
    assert incompleta(texto, [], 4.0) != ""


def test_verificar_encuentra_la_frase_que_no_se_oye():
    from tools.audio import verificar as V

    texto = V.palabras("El matiz. Epstein lo presenta como universal. Además, los estudios son de laboratorio con tareas simples.")
    assert V.faltan(texto, texto) == [] and V.parecido(texto, texto) == 1.0
    cortado = V.palabras("El matiz. Epstein lo presenta como universal.")
    assert V.faltan(texto, cortado) == ["ademas los estudios son de laboratorio con tareas simples"]
    # un nombre mal transcrito no es un hueco
    assert V.faltan(texto, V.palabras("El matiz. Eptain lo presenta como universal. Además, los estudios son de laboratorio con tareas simples.")) == []
