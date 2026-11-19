# Esquemas de las 624 lecciones que no tenían (19 nov 2026)

Hasta hoy, 624 de las 3.719 lecciones activas (98 libros; en 76 de ellos ninguna) no tenían esquema en `datos/diagramas.json`.
Ahora las 3.719 lo tienen (comprobado contra Supabase) y `lib/diagram.js` dibuja las 624 figuras nuevas.

## Cómo se hicieron
1. **Redacción** (16 agentes, un lote de ~39 lecciones cada uno, libros enteros por lote): una figura principal por lección con la ficha `ficha-redactor.md`. Regla central: la figura no dice nada que la lección no diga; las tesis van como «según X»; el pie recoge la salvedad del `autocorreccion`.
2. **Controles mecánicos** (obligatorios antes de entregar):
   - `node tools/datos/agregar.mjs diagramas lote.json --solo-lint` (límites y formas de cada plantilla).
   - `node tools/datos/apoyo.mjs lote.json lecciones.json` (**nuevo**): cifras de 2+ dígitos y nombres propios de la figura que no estén en la lección = ERROR; frases con poco apoyo léxico = aviso. Calibrado contra las 3.095 figuras ya existentes: 22 con ERROR (lista en `figuras-existentes-sin-apoyo.txt`).
3. **Verificación independiente, primera pasada** (16 verificadores nuevos, uno por lote, con `ficha-verificador.md`; ninguno vio al redactor): 386 OK, 227 CORREGIR (313 retoques), 11 REHACER. Registro: `revision-1-todas.json`. Se aplicó con un script que exige que el texto «antiguo» coincida letra por letra.
4. **Segunda pasada sobre una muestra** (111 figuras: las 11 rehechas, 40 retocadas y 60 que habían salido OK; 4 verificadores nuevos que no sabían el veredicto anterior): 79 OK, 32 CORREGIR (41 retoques), 0 REHACER. Registro: `revision-2-muestra.json`.

## Qué encontraron los verificadores
- **Estructura:** casi nunca falla. Los casos graves fueron `comparar` con elementos en el lado equivocado (p. ej. «comprarte su parte» en vez de «tu parte» en *El Sr. Mercado*), un orden inventado entre pasos que el texto presenta como base común, y figuras que solo recogían la mitad de la lección (se rehicieron 11).
- **Contenido:** una inversión de sentido (la mordedura que «fue solo un roce») y un caso en que los expertos «apenas superaban» a modelos sencillos cuando el texto dice que quedaban por debajo.
- **Lo más frecuente, con diferencia:** afirmaciones más fuertes que el texto (se pierden «a veces», «puede», «muchos», «según…»), pies que no recogen el límite del `autocorreccion`, y tonos `ok`/`mal` que la lección no respalda.
- No apareció ninguna cifra, nombre o fecha inventados (lo que ya impiden el redactor y `apoyo.mjs`).

## Límites (leer antes de fiarse)
- **Una sola verificación independiente para 513 de las 624 figuras; dos para 111.** La segunda pasada retocó aún el 22 % de las 60 que habían salido OK y el 37 % de las ya retocadas, siempre en matices de fuerza o atribución, nunca de estructura. Por extrapolación, quedan unas decenas de figuras con algún matiz por afinar. Cada pasada nueva sigue encontrando algo, así que el criterio de parada es de coste, no de «cero hallazgos».
- Los verificadores no tenían los libros: comprueban la figura contra el texto de la lección, no contra el libro. Si la lección es inexacta, la figura lo hereda.
- Los esquemas son sobrios: el 43 % son `mapa` (concepto con facetas, sin orden) frente al 12 % del resto de la biblioteca, porque muchas lecciones no estructuran su contenido de otra manera y se prefirió una figura fiel a una vistosa e inventada. 323 de las 624 las recorre el vídeo pieza a pieza.
- Incidente de proceso: varios verificadores compartían un `show.py` en la misma carpeta y se lo pisaron; los que lo detectaron (09, 10, 12, 14, 15) rehicieron su pasada. Un retoque que no case con la figura se rechaza, y ninguno se rechazó, lo que indica que todos trabajaron sobre las figuras de su lote.

## Reutilizar
Para un libro nuevo, el mismo flujo (redactor → `agregar.mjs --solo-lint` → `apoyo.mjs` → verificador independiente) está en `.claude/skills/nuevo-libro/SKILL.md`. Las dos fichas de esta carpeta son los prompts.
