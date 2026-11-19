# Ficha del verificador independiente de esquemas

Otro agente ha escrito una figura (esquema JSON) para cada lección de tu lote. **Tú no la escribiste y no la defiendes**: tu trabajo es encontrar lo que esté mal. Un esquema falso es peor que no tener esquema: quien lo mira se lleva la idea de la figura, no la del texto.

Compara cada figura SOLO con el texto de su lección (`titulo`, `idea_clave`, `cita_memorable` —es una idea redactada por la app, no una cita—, `cuerpo`, `autocorreccion`, `aplicacion_practica`; `conexion_cruzada` es contexto y NO sirve de fuente). No juzgues si la lección tiene razón (eso ya se verificó); juzga si la figura la cuenta bien.

## Qué comprobar en cada figura
1. **Trazabilidad:** cada bloque, descripción, cifra, nombre y fecha debe estar en la lección (o ser un resumen fiel). Lo que no esté → ERROR (quitar o reformular).
2. **Estructura fiel:** ¿el orden de `pasos`/`niveles`/`nodos` es el de la lección? ¿`comparar` pone cada cosa en su lado (¡mira que no estén cambiados!)? ¿lo que está en `ciclo` realmente vuelve al principio según la lección? ¿la `piramide` va de la cima a la base como dice el texto? ¿las `marcas` del espectro están en el lugar que la lección sugiere? ¿la `matriz` cruza los ejes que el texto cruza?
3. **Atribución y fuerza:** lo que la lección presenta como tesis, hipótesis o interpretación de un autor no puede aparecer como hecho. Palabras más fuertes que las del texto («siempre», «nunca», «todos», «demuestra», «causa», «prueba», «único») → suavizar al grado del texto. Si el `autocorreccion` discute o limita la idea y el `pie` no lo reconoce, eso es un fallo del pie.
4. **Tonos:** `ok`/`mal` solo si la lección valora así; no marques `mal` algo que el texto no condena.
5. **Utilidad:** la figura debe mostrar la idea central de la lección. Si es decorativa, trivial o recoge una idea secundaria dejando fuera la principal, dilo (REHACER).
6. Tildes, erratas y claridad: corrige lo evidente.

## Qué entregar
Escribe en tu fichero de revisión un JSON `{ "<id lección>": {"estado": "OK" | "CORREGIR" | "REHACER", "fixes": [ … ], "nota": "…"} }` con TODAS las lecciones del lote.
- `OK`: la figura es fiel y útil. `fixes` vacío.
- `CORREGIR`: retoques de texto. Cada fix: `{"ruta":"datos.izq.items[1]","antiguo":"texto EXACTO actual de ese campo","nuevo":"texto corregido","motivo":"qué decía el texto de la lección"}`. `ruta` usa el mismo camino que ves en la figura (`titulo`, `pie`, `datos.pasos[2].d`, `datos.der.t`…); `antiguo` debe coincidir letra por letra. Mantén los límites (bloque ≤ 40, descripción ≤ 90, título ≤ 64, pie ≤ 130).
- `REHACER`: la estructura está mal (lados cambiados, orden incorrecto, plantilla que inventa una relación, figura vacía de contenido). Pon en `nueva_figura` la figura completa corregida (con el mismo formato y reglas de `FICHA.md`) o, si no hay una figura honesta posible, `"nueva_figura": null` y explica en `nota`.
Sé estricto: es preferible quitar una frase buena que dejar pasar una falsa. No uses la web ni otras fuentes: solo el texto de la lección.

## Comprobaciones antes de entregar
Desde `/home/user/Mf`: `node tools/datos/agregar.mjs diagramas <fichero con tus nueva_figura> --solo-lint` si hiciste figuras nuevas. No modifiques el repositorio.
Devuelve un resumen: nº OK / CORREGIR / REHACER, los 5 fallos más serios que encontraste (id de 8 caracteres + qué estaba mal) y los patrones que se repiten.
