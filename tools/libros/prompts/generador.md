# Generador de un libro nuevo — instrucciones

Escribes UN paquete de libro (JSON) con la anatomía exacta de los libros del corpus «Mente fría». Esquema al final.

## Antes de escribir
1. Consulta 2–3 lecciones reales del corpus del mismo eje con `execute_sql` para captar el tono y la densidad:
   `select l.titulo,l.cuerpo,l.conexion_cruzada,l.autocorreccion,l.aplicacion_practica,l.idea_clave from lecciones l join libros b on b.id=l.libro_id where b.eje_principal=<eje> and l.idea_clave is not null order by random() limit 3;`
2. Consulta qué otros libros del corpus se relacionan con este (títulos y autores) para la «conexión cruzada»: `select autor,titulo from libros where eje_principal=<eje> order by random() limit 25;` y usa `tools/libros/autores-corpus.json`.

## Honestidad (lo más importante)
La auditoría del corpus mostró que el fallo típico es **presentar como tesis del autor lo que es síntesis propia**, inventar cifras y parafrasear citas como literales. Por eso:
- Cada lección se apoya en lo que el libro realmente defiende. Si no recuerdas con seguridad un capítulo, escribe la lección a un nivel de generalidad que SÍ puedas sostener, o no la escribas. Menos lecciones (mínimo 4) es mejor que lecciones inventadas.
- **Cifras**: toda cifra, año o porcentaje que escribas en cuerpo/conexión/autocorrección/aplicación debe estar declarada en `cifras` con `valor` (idéntico al texto), `fuente` (obra, capítulo, estudio, año) y `estado:"verificada"` solo si estás seguro. Si no estás seguro, no escribas la cifra: usa «una gran parte», «varias décadas».
- **Citas**: no entrecomilles frases como literales salvo que las conozcas verbatim; entonces decláralas en `citas_literales`. Si no, parafrasea sin comillas. El campo `cita_memorable` es una IDEA redactada por ti: sin comillas, sin atribuirla como cita.
- **Atribuciones**: «X sostiene…» solo para tesis centrales y conocidas. Los vínculos con otros autores del corpus (`conexion_cruzada`) son una lectura propia: redáctalos como «Esto conecta con…», «Puede leerse junto a…», no como «X dice que…» salvo que lo sepas con certeza.
- **Autocorrección**: crítica real y concreta (réplicas fallidas, objeciones conocidas, límites del método), no vaguedades.
- Marca `confianza`: alta (dominas el libro), media, baja. Con baja, escribe pocas lecciones y hazlas más generales.

## Anatomía de cada lección
- `titulo` 8–90 car. · `cuerpo` 850–2700 car. (ideal ≈1750), 3–6 párrafos de prosa clara, sin viñetas: idea → mecanismo → ejemplo → implicación. · `idea_clave` 40–220 · `cita_memorable` 30–240 (una frase-idea).
- `conexion_cruzada` 200–900: nombra al menos un autor del corpus y explica el vínculo sin inventar lo que ese autor dice.
- `autocorreccion` 150–800 · `aplicacion_practica` 120–700 (acción concreta y pequeña con ejemplo) · `autores_relacionados` 2–6 apellidos (al menos uno del corpus).
- 2–4 `preguntas` por lección, de tipos distintos (concepto central no obvio, conexión, aplicación, límite/autocorrección).

## Preguntas (las reglas que más importan)
- Respondibles con lo que dice la propia lección (cuerpo/explicación). Nada de opinión («cuál es la crítica más importante») ni «según el autor» sobre cosas que el libro no trata.
- 4 opciones. **Las 3 incorrectas con 80–120 % de la longitud de la correcta, mismo nivel de detalle y misma estructura**; cada una un error conceptual realista y distinto (inversión causa/efecto, sobregeneralización, confusión con un concepto cercano). Que ninguna sea defendible. La correcta NO puede ser la más larga ni la más matizada.
- Prohibido «todas las anteriores», «ninguna», «A y B», «ambas», remisiones a otras opciones.
- `explicacion` 40–500 car.: por qué la correcta lo es y qué falla en las demás. `dificultad` 1–3. `correcta` índice 0–3 (se barajará después; no importa cuál).

## Salida
Escribe el JSON en la ruta que se te indique con este esquema (sin comentarios):
{"confianza":"alta|media|baja","libro":{"autor","titulo","año","eje","eje_principal","sub_eje","descripcion_breve"},
 "cifras":[{"valor":"1998","fuente":"…","estado":"verificada"}],
 "citas_literales":[{"texto":"…","fuente":"…","verificada":true}],
 "lecciones":[{"orden":1,"titulo","cuerpo","idea_clave","cita_memorable","conexion_cruzada","autocorreccion","aplicacion_practica","autores_relacionados":["…"],"dominio_aplicacion":["…"],
   "preguntas":[{"texto","opciones":[4],"correcta":0,"explicacion","dificultad":2}]}]}
`eje_principal` ∈ {Pensamiento y Civilización, Psicología y Conducta, Economía y Mercados, Neurociencia y Biología, Desarrollo Humano}.
Después ejecuta `node tools/libros/barajar.js <ruta>` y `node tools/libros/lint.js <ruta> tools/libros/autores-corpus.json`, y corrige hasta que diga OK (los AVISOS revísalos con criterio).
