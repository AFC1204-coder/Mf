# Prompt para Claude en Chrome — abrir el PR y fusionar en `main`

Copia todo lo que hay debajo de la línea y pégalo en Claude en Chrome.
Antes, inicia sesión en GitHub en esa pestaña (no le des tus credenciales a Claude).

---

Necesito que fusiones una rama en `main` del repositorio `AFC1204-coder/Mf` en GitHub. Hazlo tú en el navegador, paso a paso.

## Reglas
- Trabaja solo en este repositorio. No cambies ajustes, ramas protegidas, secretos, Pages ni colaboradores.
- No hagas force-push, no borres ramas, no cierres ni fusiones ningún otro PR.
- Si te pide iniciar sesión, para y avísame; yo me identifico.
- Si GitHub exige revisiones, checks o permisos que no tengo, o la fusión está bloqueada, para y cuéntame exactamente qué dice; no intentes saltártelo.
- Si hay conflictos o `main` ya no es la base esperada, para y avísame.

## Pasos
1. Abre https://github.com/AFC1204-coder/Mf/compare/main...claude/mente-fria-daily-redesign-pt8obx
   Comprueba que la base es `main` y la rama a comparar es `claude/mente-fria-daily-redesign-pt8obx`, y que pone "Able to merge" (sin conflictos). Debe mostrar unos 16 commits y unos 24 archivos cambiados (más de 4.000 líneas añadidas). Dime los números que ves.
2. Pulsa **Create pull request** y rellena:
   - Título: `Rediseño para el uso diario: sesión de hoy, repaso sin deuda, navegación en cinco, onboarding y constancia semanal`
   - Descripción (pégala tal cual):

```
## Qué cambia
- **Sesión de hoy**: Recuerda → Lee → Comprueba → Lleva, con cierre «Hasta mañana», modo «Solo recordar» y lectura de 2 minutos o completa.
- **Repaso sin deuda**: solo entra lo leído; las 5.333 tarjetas nunca vistas quedan dormidas; curva de repaso de 1 a 90 días; la cola nunca pasa de 20.
- **Día hasta las 04:00**: leer a las 00:30 cuenta como la noche anterior; repasar también cuenta como día.
- **Navegación en cinco**: Hoy · Biblioteca · Repaso · Tú · Buscar.
- **Onboarding** de 3 preguntas, ruta activa que decide la lección del día, constancia semanal, resumen de la semana y mapa de dominios.
- Rutas nuevas («Emociones y atención», «Economía básica»), motor de diagramas didácticos y rutas de aprendizaje (ya incluidos en la rama).
- Sin avisos de culpa («Racha perdida», «N repasos pendientes»).
- Medición: eventos de uso y compromisos.

## Base de datos
Las migraciones ya están aplicadas en Supabase y son compatibles con la versión anterior: `supabase/migrations/20261010_quick_wins.sql` y `20261011_sesion_eventos.sql`.

## Antes de usarlo
- Admin: el panel `admin.html` ahora usa Supabase Auth y exige que el usuario esté en la tabla `public.admins` (hoy vacía). La web pública no se ve afectada.

## Pruebas
- `npx vitest run`: 208 tests pasan.
- Probado en Chromium con ancho de móvil con datos simulados; falta probarlo con datos reales.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XATNwFgRdGmsMUvADBG84u
```
3. Antes de fusionar, mira la pestaña **Checks**/estado del PR y dime si hay checks fallando. (El repositorio solo tiene un workflow que se activa al cambiar `changes.json`, así que lo normal es que no haya ninguno.)
4. Fusiona con **"Create a merge commit"** (no "Squash" ni "Rebase", para conservar el historial). Confirma la fusión.
5. NO borres la rama al terminar (si GitHub ofrece "Delete branch", ignóralo).
6. Después, comprueba y dime:
   - el último commit de `main` (mensaje y hash corto) y que es el de la fusión;
   - si en la pestaña **Actions** apareció algún workflow nuevo y cómo terminó;
   - si en **Settings → Pages** (solo mirar, sin cambiar nada) figura una URL publicada y en qué rama se construye; y si hay un despliegue reciente en **Deployments**.
7. Dime en una lista corta qué pasó en cada paso.
