# Prueba en plataformas: qué subir y qué mirar

Nada de lo que hay en `DISEÑO-COMPARTIBLE.md` se ha visto dentro de una red social. Esta hoja es para la primera subida de prueba: cinco piezas, en privado, y una lista corta de cosas que mirar en el móvil.

## Qué subir

Cinco piezas que entre todas cubren los casos distintos. Los nombres son los de la carpeta de cada pieza dentro de `tools/video/output/<libro>/compartir/9x16/`; dentro están `video.mp4`, `miniatura.png` y `publicacion.txt` (el texto de cada red, listo para pegar).

| # | Pieza | Por qué esta |
|---|---|---|
| 1 | `decisive/…/idea-01-los-cuatro-villanos-de-la-decision` | Idea con esquema en cadena que se enciende entero |
| 2 | `decisive/…/idea-02-ampliar-las-opciones` | Esquema en mapa, con su centro |
| 3 | `four-thousand-weeks…/…/idea-02-la-trampa-de-la-eficiencia` | Esquema en ciclo, texto largo en pantalla |
| 4 | `decisive/…/pregunta-01-los-cuatro-villanos-de-la-decision` | Pieza corta, con la pausa de 3 s |
| 5 | `decisive/…/fondo-01-los-cuatro-villanos-de-la-decision` | La larga (más de 3 min): solo YouTube y LinkedIn |

Dónde: YouTube (1-4 como Short, 5 como vídeo normal), TikTok e Instagram Reels (1-4), todas en privado o «solo yo».

## Qué mirar, en el móvil

Para cada pieza y cada red, basta con apuntar «bien» o qué falla.

**Encuadre**

- [ ] ¿La interfaz de la red (botones a la derecha, descripción abajo, barra de arriba) tapa texto o el esquema?
- [ ] ¿Se ve entero el crédito del libro, abajo a la izquierda?
- [ ] ¿La red recorta los bordes?

**Lectura**

- [ ] ¿Se lee el texto más pequeño (rótulos del esquema, crédito) sin acercar el móvil?
- [ ] ¿Da tiempo a leer cada página de texto antes de que cambie?
- [ ] Con el esquema encima del texto, ¿se mira el esquema o estorba?

**Movimiento y sonido**

- [ ] ¿El empuje entre secciones y el dibujado del esquema se ven fluidos tras la compresión de la red?
- [ ] ¿La voz se oye a un volumen parecido al de otros vídeos de la red?
- [ ] ¿Algún nombre propio o título en inglés suena mal?

**Antes de darle a reproducir**

- [ ] ¿La miniatura se entiende en la cuadrícula del perfil?
- [ ] ¿El texto de `publicacion.txt` cabe sin que la red lo corte por donde no debe?

**Sin sonido**

- [ ] Viendo la pieza 1 sin sonido, ¿se entiende la idea?

## Qué hago con lo que apuntes

Cada fallo de encuadre o de tamaño es un ajuste de zona segura o de letra en `assets/compartir.css`; cada fallo de ritmo, un número en `compartir.py`. Con la lista, lo corrijo y vuelvo a medir en los tres aspectos.
