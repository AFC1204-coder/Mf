# Tarjeta de idea para compartir

Botón «Compartir idea» en la lección (bajo la idea clave) y «Compartir» en las fichas de idea del mazo. Abre una ventana con la imagen (1080×1350) y dos ajustes: **tema** (oscuro o claro) y **añadir** «solo la idea», «+ Matiz» o «+ Esquema». Se comparte con el menú del móvil (imagen y enlace de invitado a la lección) o se descarga.

## Reglas de exactitud
- El texto es **siempre el de la lección**: la idea clave tal cual; si no hay, la idea redactada (`cita_memorable`); si tampoco, el arranque del cuerpo (la ventana lo avisa). Nunca se reescribe.
- Si no cabe, se quitan **frases enteras del final** (y solo si una frase sola no cabe se corta por palabras con «…»). La ventana avisa: «La idea es larga: la tarjeta lleva sus primeras frases».
- **El matiz** son las primeras frases de la autocorrección: lleva la salvedad junto a la idea.
- **El esquema** es el de la lección (el mismo verificado que se ve en ella) y **lleva su pie**, que declara lo ilustrativo, lo inferido o lo calculado.
- Todo se dibuja en el dispositivo: sin servidor, sin coste y sin datos personales. El enlace compartido es el de invitado (solo lectura).

## Piezas
`lib/tarjeta.js` (texto, ajuste y diseño; 13 pruebas en `tests/tarjeta.test.js`, incluida la garantía de que la idea nunca se desborda y de que lo mostrado es un prefijo del original) · `tarjeta-ui.js` (ventana, dibujo en canvas, compartir/descargar) · estilos `.tj-*` y `.idea-share` en `styles.css`.

## Límites
- Probada en Chromium con datos simulados; no en un móvil real (menú de compartir, tipografías cargadas desde Google Fonts).
- El esquema se rasteriza con los estilos de la página y la tipografía de sistema (no la de la app): sale algo más pequeño y de menor contraste que en la lección.
- No incluye cifras ni textos que no estén en la lección. No hay versión para lecciones sin idea ni cuerpo.
