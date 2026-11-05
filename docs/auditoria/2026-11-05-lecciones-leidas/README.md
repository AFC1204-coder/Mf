# Verificación de las 71 lecciones leídas (5 nov 2026)

Las lecciones de febrero–abril de 2026 se generaron antes de existir verificación independiente. Se verificaron las 71 que el dueño ya había leído (38 libros) con tres verificadores independientes con búsqueda web (`prompt-base.txt`).

- `lote1.json`, `lote2.json`, `lote3.json`: hallazgos por lección (severidad, problema, evidencia) con la corrección mecánica (campo, texto antiguo exacto, texto nuevo) y el estado de cada pregunta.
- Resultado: 0 lecciones sin hallazgos; 47 con al menos un ERROR y 24 solo con DUDA; 85 ERROR + 250 DUDA; 335 correcciones; 45 preguntas revisadas (35 bien, 1 clave mala, 9 ambiguas).
- Limitación: los verificadores no pudieron abrir los libros (reseñas, resúmenes y webs de los autores); donde no pudieron confirmar algo, se suavizó la atribución en vez de dar otro dato.
- Las correcciones aplicadas quedan registradas en la tabla `correcciones_contenido` (texto antiguo y nuevo, estado de aplicación) y se pueden revertir con el `replace` inverso.
