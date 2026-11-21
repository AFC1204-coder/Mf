# Ejemplos de piezas compartibles

## Con voz real — empieza por aquí

`con-voz/` tiene seis piezas con **voz de Edge TTS** (`es-ES-AlvaroNeural`, la gratuita por defecto). Son las que hay que **oír** para juzgar el ritmo, las pausas, si las fórmulas («Del libro X, de Y», «El matiz») suenan naturales y cómo se pronuncian los títulos en inglés.

**Las piezas 01-05 y todo lo que hay fuera de `con-voz/` son de la versión breve** (30-60 s, hoy `--breve`). La `06-decisive-idea-con-explicacion` es la pieza `idea` actual: lleva la explicación del cuerpo antes del esquema y el matiz entero, con la voz elegida (`fr-FR-RemyMultilingualNeural`), el esquema junto a la explicación y el empuje entre secciones (1 min 15 s).

| Archivo | Pieza | Duración |
|---|---|---|
| `01-decisive-idea.mp4` | *Decisive* · idea (patrón radial) | 50 s |
| `02-decisive-pregunta.mp4` | *Decisive* · pregunta (con pausa para pensar) | 33 s |
| `03-war-of-art-caso.mp4` | *The War of Art* · caso | 39 s |
| `04-frankl-idea-no-sino.mp4` | *El hombre en busca de sentido* · idea con «no X, sino Y» | 46 s |
| `05-decisive-libro.mp4` | *Decisive* · el libro en 5 ideas | 50 s |

El resto de esta carpeta está renderizado **sin voz** (motor `mudo`), para juzgar el aspecto.

## Sin voz

Renderizados con el motor `mudo`, para juzgar el aspecto y el guion. Sus duraciones son las de ese motor; con voz real cambian algo.

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
