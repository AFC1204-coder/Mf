"""Libro de ejemplo (inventado para las pruebas) con la misma forma que las filas de Supabase."""

from __future__ import annotations

from tools.video.corpus import Book, book_from_rows

LIBRO = {
    "id": "b-1",
    "titulo": "El libro de prueba",
    "autor": "Ana Autora",
    "eje_principal": "Psicología y Conducta",
    "sub_eje": "Sesgos",
    "descripcion_breve": "Un recorrido breve por tres ideas. Cada una se apoya en la anterior.",
    "publico": True,
}

LECCIONES = [
    {
        "id": "l-2",
        "orden": 2,
        "titulo": "La segunda idea",
        "cuerpo": (
            "La segunda lección empieza aquí. Daniel Kahneman lo llamó «efecto de anclaje» en sus trabajos.\n\n"
            "Esto ocurre incluso con cifras absurdas — por ejemplo, la ruleta — y nadie lo nota. "
            "El Dr. Pérez midió 3.5 puntos de diferencia.\n\n"
            "Por eso conviene fijar el propio número antes de escuchar el ajeno."
        ),
        "idea_clave": "",
        "cita_memorable": "",
        "autocorreccion": "El efecto no es igual de fuerte en expertos. Hay réplicas que lo matizan.",
        "aplicacion_practica": "Antes de negociar, escribe tu cifra. Luego compárala con la que te ofrezcan.",
        "autores_relacionados": ["Tversky", "Thaler"],
        "dominio_aplicacion": ["negociación"],
    },
    {
        "id": "l-1",
        "orden": 1,
        "titulo": "La primera idea",
        "cuerpo": "Todo empieza con una pregunta sencilla. La respuesta rápida suele ser la equivocada.\n\nPensar despacio cuesta, pero corrige.",
        "idea_clave": "Lo primero que se nos ocurre no siempre es lo cierto.",
        "cita_memorable": "Una idea redactada.",
        "autocorreccion": "No toda intuición falla.",
        "aplicacion_practica": "Cuenta hasta tres antes de responder.",
        "autores_relacionados": None,
        "dominio_aplicacion": None,
    },
    {
        "id": "l-3",
        "orden": 3,
        "titulo": "La tercera idea",
        "cuerpo": "La última lección cierra el círculo. Reúne las dos anteriores en una regla práctica.",
        "idea_clave": "",
        "cita_memorable": "Dos frenos valen más que un acelerador.",
        "autocorreccion": "",
        "aplicacion_practica": "",
    },
]

PREGUNTAS = [
    {
        "id": "q-1",
        "leccion_id": "l-1",
        "texto": "¿Qué suele pasar con la primera respuesta?",
        "opciones": ["Que es la correcta", "Que puede ser equivocada", "Que no existe", "Que tarda mucho"],
        "correcta": 1,
        "explicacion": "La respuesta rápida suele ser la equivocada. Las demás opciones no lo dicen.",
        "dificultad": 1,
    },
    {
        "id": "q-9",
        "leccion_id": None,
        "texto": "¿De cuántas ideas trata el libro?",
        "opciones": ["De dos", "De tres"],
        "correcta": 1,
        "explicacion": "Son tres ideas.",
        "dificultad": 2,
    },
]

DIAGRAMAS = {
    "l-1": [
        {
            "tipo": "diagrama",
            "plantilla": "comparar",
            "titulo": "Rápido y despacio",
            "pie": "Dos modos de responder.",
            "datos": {
                "izq": {"t": "Respuesta rápida", "tono": "mal", "items": ["Inmediata", "A veces falla"]},
                "der": {"t": "Pensar despacio", "tono": "ok", "items": ["Cuesta", "Corrige"]},
            },
        }
    ]
}

MAPAS = {
    "b-1": {
        "titulo": "El libro de prueba",
        "autor": "Ana Autora",
        "eje": "Psicología y Conducta",
        "nodos": [
            {"icono": "bombilla", "etiqueta": "Primera idea", "texto": "Dudar de lo inmediato"},
            {"icono": "diana", "etiqueta": "Segunda idea", "texto": "Fijar el propio número"},
            {"icono": "ciclo", "etiqueta": "Tercera idea", "texto": "Unirlas en una regla"},
        ],
        "cierre": "Pensar bien es frenar a tiempo.",
    }
}


def libro() -> Book:
    return book_from_rows(LIBRO, LECCIONES, PREGUNTAS, DIAGRAMAS, MAPAS)
