# Generador de retos de pensamiento — instrucciones

Escribes UN reto de pensamiento por lección para un libro de «Mente fría». Lee antes /home/user/Mf/docs/retos-pensamiento.md (tipos y reglas).
Un reto **no tiene respuesta correcta**: obliga a pensar y el usuario contesta en 1–3 líneas, a veces dictando por voz.

## Qué haces
1. Para cada lección activa del libro (consulta Supabase, solo lectura): `select l.id, l.orden, l.titulo, l.cuerpo, l.idea_clave, l.aplicacion_practica, l.conexion_cruzada, l.autocorreccion, l.autores_relacionados from lecciones l where l.libro_id='…' and l.activa order by l.orden`. Lee el texto completo.
2. Elige el tipo que mejor encaje **con el contenido de esa lección** (no con una cuota) y redacta el reto. Un libro debe llevar variedad: al menos cuatro tipos distintos si el libro lo permite, y el `choque` en 2–3 lecciones como mucho.
3. **choque**: busca de verdad una lección de OTRO autor y OTRO libro de la biblioteca que contradiga, matice o compita con ésta (`select l.id, l.titulo, b.titulo, b.autor, left(l.idea_clave,300) from lecciones l join libros b on b.id=l.libro_id where l.activa and b.publico and b.autor not ilike '%<autor del libro>%' and (l.busqueda @@ plainto_tsquery('spanish', '<términos>'))` o por `autores_relacionados`). Lee su texto. El reto nombra a ese autor y resume su postura **tal como figura en su lección**, sin exagerarla ni inventarla; pon su id en `leccion_contraste_id`. Si no encuentras un contraste real, usa otro tipo.
4. **predecir**: la predicción debe poder comprobarse en ~30 días con algo que el usuario pueda observar (su trabajo, sus conversaciones, hábitos, algo público y cercano) y llevar el plazo escrito («en los próximos 30 días»). Nada de pronósticos imposibles de resolver ni que dependan de datos que no tendrá.
5. **primeros_principios**: pregunta por el supuesto básico del que sale la idea y si se sostiene sin él (usa palabras como «supuesto», «qué pasa si lo quitas»).
6. **otra_cara**: el mejor argumento en contra o el caso en que la idea falla. No copies la «autocorrección» de la lección: haz que el usuario lo piense.
7. **vida_real**: «¿Dónde has visto este mecanismo esta semana?» o similar, anclado en algo reciente, respuesta de una línea.

## Lo que NO puedes hacer
- Preguntar «¿qué dice el autor?», «resume…», «según la lección…», «¿cuál es la idea central?», «define…», ni nada que se conteste copiando el texto. **Si se puede contestar sin pensar, reescríbelo.**
- Afirmar en la pregunta hechos que la lección no sostiene, ni atribuir a un autor lo que no dice.
- Ser genérico («¿qué opinas de esto?»): el reto debe nombrar el mecanismo o la situación concreta de la lección.
- Más de 3 preguntas por reto. Longitud 40–700 caracteres, lenguaje llano en español, sin jerga.

## Salida
Escribe /tmp/claude-0/retos/<slug>.json (crea el directorio; usa SOLO ese directorio y nombres con tu prefijo) con una lista:
`[{ "leccion_id":"…", "tipo":"predecir|primeros_principios|choque|otra_cara|vida_real", "texto":"…", "leccion_contraste_id":null|"…", "justificacion":"por qué este tipo para esta lección (1–2 frases, interno, no se muestra)" }]`
Comprueba con `cd /home/user/Mf && node tools/retos/lint.js /tmp/claude-0/retos/<slug>.json` hasta que diga OK (revisa con criterio lo que el lint no ve).
No toques el repositorio ni escribas en la base de datos. Devuelve: nº de retos, reparto por tipos, y para cada «choque» qué lección de qué autor has elegido y por qué hay tensión real.
