# Esquemas de las 624 lecciones que no tenían (19 nov 2026)

Hasta hoy, 624 de las 3.719 lecciones activas (98 libros; en 76 de ellos ninguna) no tenían esquema en `datos/diagramas.json`.
Ahora las 3.719 lo tienen (comprobado contra Supabase) y `lib/diagram.js` dibuja las 624 figuras nuevas.

## Cómo se hicieron
1. **Redacción** (16 agentes, un lote de ~39 lecciones cada uno, libros enteros por lote): una figura principal por lección con la ficha `ficha-redactor.md`. Regla central: la figura no dice nada que la lección no diga; las tesis van como «según X»; el pie recoge la salvedad del `autocorreccion`.
2. **Controles mecánicos** (obligatorios antes de entregar):
   - `node tools/datos/agregar.mjs diagramas lote.json --solo-lint` (límites y formas de cada plantilla).
   - `node tools/datos/apoyo.mjs lote.json lecciones.json` (**nuevo**): cifras de 2+ dígitos y nombres propios de la figura que no estén en la lección = ERROR; frases con poco apoyo léxico = aviso. Calibrado contra las 3.095 figuras ya existentes: 22 con ERROR (lista en `figuras-existentes-sin-apoyo.txt`).
3. **Primera verificación independiente** (16 verificadores nuevos, uno por lote, con `ficha-verificador.md`; ninguno vio al redactor): 386 OK, 227 CORREGIR (313 retoques), 11 REHACER. Registro: `revision-1-todas.json`. Se aplicó con un script que exige que el texto «antiguo» coincida letra por letra.
4. **Segunda verificación independiente de TODAS las figuras** (otros verificadores que no sabían el veredicto anterior): 111 en una primera tanda de muestra (`revision-2-muestra.json`: 79 OK, 32 retocadas) y las 513 restantes (`revision-2-resto.json`: 271 OK, 237 retocadas con 374 retoques, 5 rehechas).
5. **Figuras antiguas marcadas por `apoyo.mjs`** (22; `marcas-figuras-antiguas.json`): un verificador las revisó con las marcas delante (`revision-figuras-antiguas.json`). **Ninguna salió OK:** 13 se rehicieron y 9 se retocaron. 16 de las 26 marcas eran falsos positivos (cifras escritas en palabras: «años veinte», «diez días»…) y 10 eran datos sin respaldo en la lección (fechas y nombres añadidos de memoria); en una (`54ec3211`) la figura entera era de otra lección.

Cada figura nueva tiene por tanto **dos revisiones independientes**.

## Qué encontraron los verificadores
- **Estructura:** casi nunca falla. Los casos graves fueron `comparar` con elementos en el lado equivocado (p. ej. «comprarte su parte» en vez de «tu parte» en *El Sr. Mercado*), un orden inventado entre pasos que el texto presenta como base común, y figuras que solo recogían la mitad de la lección (se rehicieron 11).
- **Contenido:** una inversión de sentido (la mordedura que «fue solo un roce») y un caso en que los expertos «apenas superaban» a modelos sencillos cuando el texto dice que quedaban por debajo.
- **Lo más frecuente, con diferencia:** afirmaciones más fuertes que el texto (se pierden «a veces», «puede», «muchos», «según…»), pies que no recogen el límite del `autocorreccion`, y tonos `ok`/`mal` que la lección no respalda.
- No apareció ninguna cifra, nombre o fecha inventados (lo que ya impiden el redactor y `apoyo.mjs`).

## Límites (leer antes de fiarse)
- **La verificación no converge a cero.** La segunda revisión retocó el 45 % de las figuras que la primera había dado por buenas y el 50 % de las que ya había retocado (una tercera pasada aún encontraría matices). Casi todo son matices de fuerza o de atribución («puede», «según X», un pie sin la salvedad del `autocorreccion`), no estructura; aun así son justo el tipo de detalle que genera conceptos ligeramente erróneos. El criterio de parada fue de coste, no de «cero hallazgos».
- Los verificadores no tenían los libros: comprueban la figura contra el texto de la lección, no contra el libro. Si la lección es inexacta, la figura lo hereda.
- **Las figuras antiguas no se han auditado en general.** Solo se revisaron 22 (las marcadas por `apoyo.mjs`) y ninguna estaba bien. Quedan 3.073 antiguas sin revisión independiente; las 154 con «aviso» de apoyo léxico son las candidatas más claras (`node tools/datos/apoyo.mjs` sobre `datos/diagramas.json`).
- Los esquemas nuevos son sobrios: el 43 % son `mapa` (un concepto con facetas, sin orden) frente al 12 % del resto de la biblioteca, porque muchas lecciones no estructuran su contenido de otra manera y se prefirió una figura fiel a una vistosa e inventada.
- Incidente de proceso: varios verificadores compartían un `show.py` en la misma carpeta y se lo pisaron; los que lo detectaron rehicieron su pasada. Un retoque que no case con la figura se rechaza, y ninguno se rechazó, lo que indica que todos trabajaron sobre las figuras de su lote.

## Reutilizar
Para un libro nuevo, el mismo flujo (redactor → `agregar.mjs --solo-lint` → `apoyo.mjs` → verificador independiente) está en `.claude/skills/nuevo-libro/SKILL.md`. Las dos fichas de esta carpeta son los prompts.
