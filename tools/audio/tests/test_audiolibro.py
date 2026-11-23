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
