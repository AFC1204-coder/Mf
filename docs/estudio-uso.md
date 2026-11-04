# Tu estudio (Tú → Tu estudio)

Panel con cifras sobre cómo usas la herramienta. Lógica pura y pruebas en `lib/estudio.js`; pantalla en `perfil-ui.js`.
Todo sale de datos que ya se guardan (`progreso`, `repaso`, `respuestas_reto`, `revisiones_reto`); no hay seguimiento nuevo.

## Qué se mide y por qué
| Bloque | Cifras | Para qué sirve |
|---|---|---|
| Constancia | días activos (30 d), racha actual y mejor, lecciones distintas por semana (8 sem.), por día de la semana, franja del día | Ver el hábito real frente al propósito |
| Variedad | libro con más tiempo (estimado), libros tocados / en 30 días / terminados / empezados sin terminar, reparto por eje, libro más leído, ejes sin tocar | Detectar si lees siempre de lo mismo o dispersas sin terminar |
| Retención | aciertos en el repaso espaciado (total y por eje), lecciones en repaso, asentadas (nivel ≥ 4), lecciones que más se escapan | Saber qué se queda y qué no |
| Retos | contestados, «Explícalo», revisiones (lo mismo / matices / cambio), predicciones (acertadas, falladas, a medias, pendientes) | Ver cuánto piensas y cuánto cambias de opinión |

## Reglas para no engañarse
- «Retención» sale del repaso espaciado (tarjetas activas, `veces_correcta` / `veces_incorrecta`). No es una prueba de memoria controlada: depende de qué tarjetas hayas activado.
- Cada bloque dice cuántos datos tiene detrás. Con menos de 15 respuestas de repaso se avisa de que no es una medida firme.
- Las observaciones en lenguaje llano («Lees sobre todo por la noche…») solo aparecen con muestra mínima (10 lecturas, 15 repasos, 5 revisiones o predicciones comprobadas). Con menos, el panel dice que hay pocos datos.
- Un día cuenta como activo si leíste, repasaste o contestaste un reto; el día acaba a las 04:00.
- «Terminado» = todas las lecciones activas del libro leídas.

## Límites conocidos
- «Tiempo por libro» es una estimación: minutos de lectura de la lección (≈190 palabras/min) × las veces leída (primera lectura + relecturas). No mide el tiempo real en pantalla porque no se guarda.
- **Relecturas**: se registran desde que existe esta función (fila `relectura` en `progreso`). Releer cuenta cuando se vuelve a leer la lección entera con los mismos criterios que la lectura automática (tiempo a la vista y llegar al final), como mucho una vez por lección y día. Antes no quedaba rastro, así que el historial de relecturas empieza vacío.
- El objetivo de esta cifra es ver qué libros te impactan: los que más relees suben solos.
- «Saltar» un reto no se guarda a propósito, así que no hay tasa de saltos.
- En modo invitado el panel sale vacío (no hay datos personales).

## Posible después
Curva de olvido real (acierto según días desde la lectura) si se empieza a guardar cada intento del repaso con su fecha; hoy solo hay contadores.
