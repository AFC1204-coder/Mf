# Ejemplos de piezas compartibles

Renderizados **sin voz** (motor `mudo`) con el código de esta rama, para juzgar el aspecto, el ritmo y el guion. Las duraciones son las del motor mudo (2,4 palabras/s); con voz real variarán.

- `hojas/` — una hoja de fotogramas por pieza (18 instantes repartidos por el vídeo). Lo más rápido de mirar.
- `videos/` — nueve de las piezas, en MP4.
- `miniaturas/` — la portada de cada pieza.
- `textos/` — el guion (`*.guion.md`: qué se oye, qué se ve y de qué campo sale) y el texto de publicación de cada una.
- `manifiesto-decisive.md|json` — el manifiesto de un libro entero (21 piezas, orden de publicación sugerido).

| n.º | Pieza | Qué enseña |
|---|---|---|
| 01 | *Decisive* · libro | El libro en una frase y sus 5 ideas (mapa) |
| 02 | *Decisive* · idea | Arco completo con patrón **silueta** (figura tipo mapa) |
| 03 | *Decisive* · idea | Arco completo con patrón **cadena** (figura de pasos) |
| 04 | *Decisive* · pregunta | Pregunta → cuenta atrás → respuesta → matiz |
| 05 | *Decisive* · práctica | Qué probar → la idea detrás → matiz *(solo hoja)* |
| 06 | *Dopamine Nation* · idea | Lección sin idea redactada: abre con el esquema (**contraste**) |
| 07 | *Economics in One Lesson* · idea | Eje Economía; título con paréntesis *(solo hoja)* |
| 08 | *Tao Te King* · idea | Eje Pensamiento *(solo hoja)* |
| 09 | *Chi Self-Massage* · idea | Pieza larga (78 s) con salvedad médica conservada |
| 10 | *Coercion, Capital…* · idea | Figura no recorrible (espectro): pieza sin esquema |
| 11 | *When Prophecy Fails* · pregunta | Título de 115 caracteres y tres autores *(solo hoja)* |
| 12 | *Decisive* · idea · 1:1 | Aspecto cuadrado |
| 13 | *Decisive* · idea · 16:9 | Aspecto horizontal |

Para rehacerlos: `python -m tools.video.cli libro "Decisive" --format compartir --engine mudo`.
