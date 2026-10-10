# Infografías de libros (estilo «imagen de GPT»)

10 oct 2026 · estado: **implementado y probado con simulaciones; falta tu clave de API, aplicar una migración y revisar la primera tanda**

## Qué es

Un **mapa visual por libro**: una infografía vertical con el título, 4–6 ideas numeradas y conectadas, y un
cierre. Se muestra en la página del libro (se amplía al tocarla) y como botón «Ver el mapa visual del
libro» dentro de cada lección. Sirve para retener: una imagen con la estructura del libro enganchada
a las ideas que luego lees lección a lección.

Es **complementaria** a los diagramas del motor propio (`lib/diagram.js`): los diagramas explican *una*
lección con exactitud y legibilidad garantizadas; la infografía da la *visión de conjunto* del libro.

## Cómo funciona

```
libros + lecciones (Supabase)
        │  lib/infografia.js: elige 4–6 lecciones repartidas por el libro, saca etiquetas cortas
        ▼
  encargo con TEXTO EXACTO ──► modelo de imagen (OpenAI) ──► webp 1024×1536
        ▼
  Storage «infografias» ──► libros.infografia_url, estado = «pendiente»
        ▼
  admin.html → Infografías: tú apruebas o rechazas
        ▼
  la app solo muestra las «aprobadas»  (las rechazadas se rehacen en la siguiente tanda)
```

**Salvaguardas contra contenido inventado** (los modelos de imagen escriben bien, pero no siempre bien):
- El modelo no decide el contenido: recibe una lista cerrada de etiquetas (títulos de tus lecciones, acortados) y se le exige copiarlas literalmente.
- Se le prohíbe añadir párrafos, citas, cifras, fechas o nombres, y se exige español con tildes y eñes.
- Sin fotografías, sin personas reconocibles, sin logotipos, sin reproducir la portada del libro.
- **Nada se publica sin tu revisión**: cada imagen entra como «pendiente».
- Se guarda el encargo exacto (`infografia_prompt`) y el modelo usado, para poder repetir o auditar.

## Lo que ya está hecho

| Pieza | Dónde |
|---|---|
| Constructor del encargo, etiquetas cortas y cálculo de coste (con tests) | `lib/infografia.js`, `tests/infografia.test.js` |
| Generador por línea de comandos: **simulación por defecto**, tope de coste, reintentos, login como administrador (sin service role) | `tools/infografias/generar.mjs` |
| Pruebas del flujo completo contra un servidor simulado (Supabase + API de imágenes) | `tests/infografias.test.js` |
| Workflow manual (también desde el móvil) | `.github/workflows/infografias.yml` |
| Migración: columnas en `libros`, bucket público y permisos solo para administradores | `supabase/migrations/20261012_infografias.sql` |
| Vista en la app: página del libro y botón en la lección (solo aprobadas) | `app.js`, `styles.css` |
| Pantalla de revisión | `admin.html` → pestaña «Infografías» |

## Coste

Precio oficial por imagen de 1024×1536 según las fichas de modelo de OpenAI (consultadas el 10 oct 2026; pueden cambiar, comprueba antes de lanzar tandas grandes):

| Modelo | Baja | Media | Alta |
|---|---|---|---|
| `gpt-image-1.5` (por defecto) | $0,013 | $0,05 | $0,20 |
| `gpt-image-1` | $0,016 | $0,063 | $0,25 |
| `gpt-image-1-mini` | $0,006 | $0,015 | $0,052 |

Un `gpt-image-2` aparece en páginas de terceros, pero no encontré su precio oficial: no lo doy por válido.

**256 libros**, a calidad *media* con `gpt-image-1.5` ≈ **$13**; a *alta* ≈ **$51**. Las rechazadas que haya que rehacer suman. El generador calcula el coste estimado antes de empezar y se niega si supera `--max-coste` (3 USD por defecto).

Recomendación: empezar con **3 libros en calidad media** y mirar el resultado antes de lanzar más.

## Cómo ponerlo en marcha (se puede hacer desde el móvil)

1. **Aplicar la migración** `supabase/migrations/20261012_infografias.sql`. Prompt listo para Claude en Chrome: `docs/prompt-claude-chrome-infografias.md` (o pegarla en el SQL Editor de Supabase).
2. **Fusionar el PR en `main`** (pendiente): un workflow solo aparece en la pestaña *Actions* cuando está en la rama por defecto.
3. **Crear una clave de API de OpenAI** (platform.openai.com) y **ponle un límite de gasto mensual**.
4. En GitHub → repositorio → *Settings → Secrets and variables → Actions → New repository secret*, crear:
   - `OPENAI_API_KEY`
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: un usuario de `public.admins`. Mejor un usuario **dedicado** (alta con `supabase/admin_alta.sql`) que tu cuenta personal, así puedes rotar su contraseña sin tocar la tuya.
5. *Actions → «Infografías de libros» → Run workflow*:
   - primero **sin marcar «ejecutar»**: solo simula y muestra los encargos y el coste;
   - después marca **«ejecutar»** con límite 3 y calidad media.
6. Entra en `admin.html` → **Infografías**, mira cada imagen (texto, tildes, que no invente nada) y **aprueba o rechaza**.
7. Abre el libro en la app: debe aparecer el mapa visual bajo la ficha.

## Qué revisar en cada imagen

- Que **todas las palabras** coincidan con las etiquetas (los modelos a veces cambian una letra o inventan una etiqueta extra).
- Tildes y eñes.
- Que no haya cifras, citas o nombres que el libro no sustente.
- Que el texto se lea bien en el móvil (si no, rechazar).
- Que el orden numerado tenga sentido para ese libro.

Si muchas salen mal, se puede ajustar el estilo o la plantilla en `lib/infografia.js` (hay tests) y rehacer.

## Siguientes pasos (no hechos)

- **Por lección**: la misma tubería sirve para infografías de lección. Hoy 1.550 lecciones dependen de un SVG antiguo ilegible (ver `docs/auditoria-svg.md`); para esas es mejor rehacer el **diagrama con el motor propio** (barato y legible). Reservar la infografía de imagen para libros y para lecciones clave de las rutas.
- **Verificación automática del texto** de cada imagen (OCR o modelo de visión) para descartar las que no coinciden con las etiquetas antes de que las veas.
- **Estilo por eje** (una paleta distinta por eje temático) si quieres reconocer el área de un vistazo.
- **Infografía en el modo carta** (compartir): incluirla al enviar un libro.

## Decisiones que son tuyas

1. **Proveedor y modelo**: `gpt-image-1.5` por defecto; se cambia con `--modelo` o la variable `IMAGE_MODEL`.
2. **Calidad y presupuesto**: media ≈ $13 para todos los libros.
3. **Alcance**: libros (256) ahora; lecciones más adelante.
4. **Quién revisa**: hoy, tú desde `admin.html`.

Fuentes de precios: [gpt-image-1](https://developers.openai.com/api/docs/models/gpt-image-1) · [gpt-image-1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5) · [gpt-image-1-mini](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
