# Retos de pensamiento

Sustituyen al test de cada lección. **Sin respuesta correcta ni nota**: una pregunta que obliga a pensar, una respuesta corta (1–3 líneas, apta
para dictado) que se guarda con fecha y vuelve más adelante. Esta guía recoge el diseño pedido por el usuario y lo que ya está hecho.

## Los cinco tipos (uno por lección, elegido según el contenido)
| Tipo | Pregunta | Cuándo encaja |
|---|---|---|
| `predecir` | «Si esta idea es cierta, ¿qué debería pasar con [situación concreta y actual]?» | La idea implica algo observable en unas semanas. Vuelve a los 30 días: ¿acertaste? sí / no / a medias / aún no se sabe. |
| `primeros_principios` | «¿De qué supuesto básico sale esta idea? ¿Se sostiene si lo quitas?» | La idea descansa en un supuesto que no se ve a primera vista. |
| `choque` | Enfrenta la lección con la de **otro autor de la biblioteca**: «¿Qué le respondería B? ¿Quién tiene más razón y por qué?» | Hay una lección real de otro autor que la contradice o la matiza (`leccion_contraste_id`). |
| `otra_cara` | «¿Cuál es el mejor argumento en contra? ¿En qué caso falla esta idea?» | La idea es fuerte y tiene límites reales. |
| `vida_real` | «¿Dónde has visto este mecanismo esta semana?» (una línea) | El mecanismo es cotidiano y reconocible. |
| `explicalo` (opcional, no es un reto escrito) | «Explícalo en 30 segundos como a alguien que no lo conoce.» | Cuadro de texto para dictar por voz; se puede saltar. Lo genera la app, no el generador. |

Siempre hay un botón **«Saltar»** visible y sin penalización.

## Reglas de generación
1. **El reto sale de la lección** (concepto, mecanismo, tensión, aplicación práctica, conexión cruzada), pero **no se puede contestar copiando el texto**. Prohibido «¿qué dice el autor?», «resume…», «según la lección…», «¿cuál es la idea central?». Si se contesta sin pensar, se reescribe.
2. **No inventa nada**: una pregunta no afirma hechos que la lección no sostenga. En un `choque`, la postura de B es la que figura en la lección de B, atribuida con prudencia.
3. **Una predicción es comprobable**: sobre algo que el usuario pueda observar en ~30 días (su vida, su trabajo, algo público y cercano), con plazo explícito. Nada de pronósticos que no se puedan resolver.
4. **Rotar según el contenido, no al azar**: en un libro deben aparecer varios tipos, y el `choque` como mucho en 2–3 lecciones.
5. 40–700 caracteres (restricción de la tabla), 1–3 preguntas, lenguaje llano.

## Datos (migración `20261102_retos_pensamiento.sql`, ya aplicada)
- `retos(leccion_id, libro_id, tipo, texto, leccion_contraste_id, activo)`: contenido; lectura pública solo si `activo`; escritura solo admin. Un reto principal por lección.
- `respuestas_reto(reto_id, leccion_id, tipo, texto, creada_at, nivel, proxima_revision, resultado, resuelta_at)`: lo que escribe el usuario; en `predecir`, `resultado` ∈ acerto · fallo · a_medias · aun_no.
- `revisiones_reto(respuesta_id, fecha, veredicto, texto)`: cada vez que se contesta «¿sigues pensando lo mismo?» (igual · matizo · cambio, con el texto nuevo si cambia).
- Por ahora la seguridad es la de las demás tablas personales (usuario único `default`); la fase de cuenta obligatoria las cerrará todas a la vez.

## Repaso espaciado
En vez de repetir la pregunta, reaparece **tu respuesta** con «¿sigues pensando lo mismo?». Las predicciones vuelven a los 30 días con «¿acertaste?». El registro de predicciones (por idea o autor: aciertos, fallos, pendientes) es una vista aparte.

## Proceso (como los libros nuevos)
generador (`tools/retos/prompts/generador.md`) → `node tools/retos/lint.js` → verificador independiente (`prompts/verificador.md`) → corrector → carga en borrador (`activo=false`) → comprobación por huella → activar.

## Estado
- Hecho: migración aplicada y comprobada, lint de retos con pruebas, guía y prompts.
- Piloto cargado: *How Minds Change* (9) y *In Sheep's Clothing* (8). Cada lote pasó por un verificador independiente, que corrigió 10 de 17: varias respuestas estaban escritas en la propia lección («autocorrección») y se podían copiar, y dos predicciones venían ya hechas.
- Pantalla (`lib/retos.js` lógica pura + `retos-ui.js`):
  - **Fin de la lección**: el reto con su caja de respuesta (1–3 líneas), **Saltar** siempre visible (no se guarda ni penaliza) y «Explícalo con tus palabras» opcional, con dictado si el navegador lo trae. Con reto activo el test antiguo se oculta; sin reto (o en modo invitado) sigue como antes.
  - **Repaso**: bloque «Retos de pensamiento» con una tarjeta cada vez. Reflexiones: tu respuesta + «¿sigues pensando lo mismo?» (lo mismo / con matices / he cambiado; intervalos 7·21·60·150 días, «he cambiado» reinicia). Predicciones: a los 30 días «¿acertaste?» (sí / no / a medias / aún no se sabe → vuelve en 30 días).
  - **Registro de predicciones** por autor o por idea, con aciertos, fallos, a medias y pendientes. Avisa de que con menos de 5 comprobadas aún no dice nada fiable.
- Los retos se cargan inactivos (`activo=false`) y se activan a mano.
- Pendiente: más libros (ampliar con el mismo proceso), migrar las preguntas antiguas (el usuario dijo «para después»), usar estos datos en el perfil.
