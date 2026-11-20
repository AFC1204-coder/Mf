# Ejemplos de piezas compartibles

Renderizados **sin voz** (motor `mudo`) con el código de esta rama, para juzgar el aspecto, el ritmo y el guion. Las duraciones son las del motor mudo (2,4 palabras/s); con voz real variarán.

- `hojas/` — una hoja de fotogramas por pieza (18 instantes repartidos por el vídeo). Lo más rápido de mirar.
- `videos/` — doce de las piezas, en MP4.
- `miniaturas/` — la portada de cada pieza.
- `textos/` — el guion (`*.guion.md`: qué se oye, qué se ve y de qué campo sale) y el texto de publicación de cada una.
- `manifiesto-decisive.md|json` — el manifiesto de un libro entero (21 piezas, orden de publicación sugerido).

| n.º | Pieza | Qué enseña |
|---|---|---|
| 01 | *Decisive* · libro | El libro en una frase y sus 5 ideas (mapa) |
| 02 | *Decisive* · idea | Patrón **radial**: un centro y lo que sale de él |
| 03 | *Decisive* · idea | Patrón **cadena** (figura de pasos) |
| 04 | *Decisive* · pregunta | Pregunta → cuenta atrás → respuesta → matiz |
| 05 | *Decisive* · práctica | Qué probar → la idea detrás → matiz *(solo hoja)* |
| 06 | *Dopamine Nation* · idea | Lección sin idea redactada: abre con el esquema (**contraste**) |
| 07 | *Four Thousand Weeks* · idea | Patrón **ciclo**: la cadena vuelve al principio |
| 08 | *Man's Search for Himself* · idea | Patrón **matriz**: dos ejes, cuatro cuadrantes |
| 09 | *A Beautiful Constraint* · idea | Patrón **espectro**; abre con la pregunta que la lección se hace |
| 10 | *Hábitos Atómicos* · idea | Patrón **cifra**: el número en grande |
| 11 | *El hombre en busca de sentido* · idea | «No X, sino Y»: lo negado se apaga, lo afirmado queda en color |
| 12 | *Chi Self-Massage* · idea | Pieza larga con salvedad médica conservada *(solo hoja)* |
| 13 | *When Prophecy Fails* · pregunta | Título de 115 caracteres y tres autores *(solo hoja)* |
| 14 | *Decisive* · idea · 1:1 | Aspecto cuadrado |
| 15 | *Decisive* · idea · 16:9 | Aspecto horizontal *(solo hoja)* |
| 16 | *The War of Art* · caso | Lo concreto primero: el ejemplo → la idea detrás → matiz. Su `publicacion.txt` trae ya el texto por red |

Para rehacerlos: `python -m tools.video.cli libro "Decisive" --format compartir --engine mudo`.
