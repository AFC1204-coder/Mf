# agent.md — Guía para agentes de IA en SCS (Segundo Cerebro Soberano)

Documento de referencia para cualquier agente (Claude, Copilot, Codex, etc.) que
trabaje sobre este repositorio. Léelo completo antes de editar código.

---

## 1. Qué es SCS

Progressive Web App de gestión de conocimiento personal con:

- Biblioteca de libros y lecciones (≈131 libros / 1166 lecciones).
- Quizzes y tests adaptativos con scoring y repaso.
- Spaced Repetition System (SRS) y seguimiento de racha.
- Favoritos, notas, citas y esquemas estáticos por autor
  (Kahneman, Taleb, Tetlock, McGilchrist, Cialdini, Weinstein…).
- Notificaciones push vía Service Worker.
- Panel admin protegido por contraseña para editar el corpus.

Se sirve como sitio estático bajo la ruta `/Mf/` (GitHub Pages).
El estado persistente vive en **Supabase** (PostgREST) con fallback a
`localStorage` cuando la red falla.

---

## 2. Stack

| Capa        | Tecnología                                          |
|-------------|-----------------------------------------------------|
| UI          | HTML + CSS + JS vanilla (sin framework, sin bundler)|
| Backend     | Supabase (REST directo vía `fetch`, tabla pública)  |
| PWA         | `sw.js` + `manifest.json` + notifications API       |
| Tests       | Vitest + jsdom                                      |
| CI          | GitHub Actions (`apply-changes.yml`)                |
| Despliegue  | Estático, ruta `/Mf/`                               |

No hay paso de build. `index.html` carga directamente `app.js` y `styles.css`.

---

## 3. Mapa del repo

```
/
├── index.html           # App pública (vista principal)
├── app.js               # Lógica completa del front (~126 KB, monolítico)
├── styles.css           # Estilos globales
├── admin.html/.js/.css  # Panel admin (login por SHA-256 del password)
├── mapa.html/.js/.css   # Vista mapa / visualización transversal
├── sw.js                # Service Worker (cache + push)
├── notifications.js     # Capa de notificaciones in-app
├── manifest.json        # Manifest PWA (scope /Mf/)
├── lib/
│   └── core.js          # Funciones PURAS extraídas para testing
├── tests/               # Suite Vitest (jsdom)
│   ├── utils.test.js
│   ├── fmt.test.js
│   ├── filtros.test.js
│   ├── persistencia.test.js
│   ├── quiz.test.js
│   └── streak.test.js
├── esquemas/            # Páginas HTML estáticas de autores
├── changes.json         # Buzón de cambios pendientes (se vacía al aplicarse)
├── changes_history/     # Snapshots de changes.json ya aplicados
├── .github/
│   ├── workflows/apply-changes.yml
│   └── scripts/apply_changes.py
├── package.json         # Solo declara vitest y jsdom
└── vitest.config.js     # environment: jsdom, globals: true
```

---

## 4. Comandos

```bash
npm install          # instala vitest + jsdom
npm test             # vitest run  (modo CI, una vez)
npm run test:watch   # vitest en watch
```

No existe servidor de desarrollo: para probar visualmente abre `index.html`
con un servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
# luego http://localhost:8000/
```

Si tocas CSS/JS verás en la consola del navegador mensajes del
Service Worker: usa *hard reload* (Ctrl+Shift+R) o desregistra el SW para
evitar leer versiones cacheadas.

---

## 5. Arquitectura y patrones

### 5.1 Front-end monolítico
`app.js` es un único módulo global (IIFE-style, sin ES modules). Mantén
ese estilo: las funciones que exponen al HTML se asignan a `window` o se
declaran en el top-level y se llaman desde atributos `onclick="..."`.

### 5.2 Estado
Variables top-level en `app.js`:

```js
let libros=[], lecs=[], preg=[], prog=[];
let libroActual=null, lecActual=null;
let ejeActivo=null, subEjeActivo=null, searchQ='', lecFilter='all';
let testPregs=[], testIdx=0, testResp=[], testCorr=0, testErr=0;
```

No introduzcas gestores de estado; mantén la mutación directa.

### 5.3 Supabase
Dos helpers al inicio de `app.js`:

- `sb(path, opts)` — un request REST.
- `sbAll(path, opts)` — pagina en lotes de 1000.

La clave `anon` está **embebida en el cliente** porque el proyecto
depende de RLS para proteger datos. No la ocultes ni la muevas a
`.env`: esto es intencional para un sitio 100% estático.

### 5.4 Funciones puras → `lib/core.js`
Todo lo testeable se duplica allí (fmt, hl, normalizeEje, calcStreak,
buildTestQueue, responderLogic, createLS, loadFavoritosFromDB, …).
Regla: **si cambias la lógica en `app.js`, replícala idéntica en
`lib/core.js`** y actualiza el test correspondiente. El comentario en
cabecera de `lib/core.js` lo deja explícito.

### 5.5 Persistencia con fallback
Patrón canónico (`saveNota`, `loadFavoritosFromDB`, etc.):

1. Intenta Supabase.
2. Si falla, escribe/lee `localStorage` mediante `createLS(storage)`.
3. Devuelve siempre un valor utilizable; nunca lanza al caller.

### 5.6 Escapado de HTML
Usa **siempre** el helper `esc()` o la utilidad `hl()` antes de inyectar
contenido de usuario en `innerHTML`. Hay tests XSS en `utils.test.js`
que fallarán si rompes esto.

---

## 6. Tests

- Framework: **Vitest 4** con `environment: 'jsdom'` y `globals: true`.
- Archivos `*.test.js` en `tests/`.
- Se prueban exclusivamente las funciones puras de `lib/core.js`.
- Para persistencia se usan `vi.fn()` mocks de `sbFetch` y un
  `mockStorage()` en memoria.

Reglas:

- Cualquier PR que modifique `lib/core.js` o `app.js` (lógica
  compartida) debe mantener la suite en verde: `npm test`.
- Al añadir una función pura nueva, añade su test.
- No conviertas los tests a `async` si no lo necesitan; sigue el estilo
  actual (`describe` → `it` → `expect`).

---

## 7. Flujo `changes.json` (IMPORTANTE)

Este repo tiene un pipeline automatizado de edición vía GitHub Actions:

1. Se hace push de un `changes.json` no vacío en la raíz.
2. El workflow `.github/workflows/apply-changes.yml` ejecuta
   `.github/scripts/apply_changes.py`.
3. El script aplica las operaciones, archiva el JSON en
   `changes_history/changes_YYYYMMDD_HHMMSS.json` y vacía `changes.json`
   a `[]`.
4. El bot commit/pushea los cambios como “SCS Bot”.

### Schema de una operación

```json
{
  "action": "replace" | "create" | "delete" | "append",
  "file":   "ruta/relativa.ext",
  "old":    "texto exacto a buscar",      // replace
  "new":    "texto con el que reemplazar",// replace
  "content":"contenido del archivo"       // create / append
}
```

Notas:

- `replace` hace una sustitución **una sola vez** (`str.replace(find,
  replace, 1)` en Python) y **falla si `old` no aparece literalmente**.
- Si se omite `action` pero hay `find`+`replace`, se asume `replace`.
- `find`/`replace` son alias aceptados de `old`/`new`.

### Cuándo usar este flujo
Si un agente solo puede entregar parches vía commit de `changes.json`
(por ejemplo, desde un runner remoto sin acceso al repo), éste es el
canal. Para trabajo local normal, edita los archivos directamente y
**deja `changes.json` como `[]`**.

---

## 8. Convenciones de código

- **Idioma**: UI y comentarios en español; nombres de variables
  mayoritariamente en español (`libros`, `leccion`, `prog`, `racha`).
  Mantén la coherencia.
- **Estilo**: sin prettier/eslint. Código compacto, a menudo una línea
  por sentencia; no reformatees archivos existentes solo por gusto.
- **Sin ES modules en `app.js`**: no añadas `import/export` fuera de
  `lib/` y `tests/`.
- **Sin dependencias nuevas en runtime**. Cualquier librería externa
  se carga vía `<script src="https://cdn...">` (ej. jsPDF) y debe ser
  opcional.
- **Sin emojis en el código** salvo cuando ya existan como parte del
  diseño visible (la UI usa algunos en botones y notificaciones).
- **Comentarios**: escasos y en bloques decorativos `═══` para separar
  secciones grandes; no los añadas a cada función.

---

## 9. Seguridad / admin

- El panel admin (`admin.html`) se desbloquea con un password cuyo
  SHA-256 está hardcodeado (`ADMIN_HASH`). **Nunca cambies el hash**
  sin coordinación con el owner.
- La app principal activa modo admin con 3 clicks rápidos sobre el logo
  y valida contra otro `ADMIN_HASH` en `app.js`.
- No loguees el password en consola, no lo persistas en localStorage,
  no lo envíes a Supabase.
- La RLS de Supabase es la que protege escrituras; no elimines filtros
  `usuario_id=eq.default` en queries a menos que sepas lo que haces.

---

## 10. PWA / Service Worker

- `sw.js` usa cache versionada (`CACHE_NAME = 'scs-cache-v14'`).
- **Al modificar cualquier archivo en `urlsToCache` incrementa la
  versión del cache** (`v14` → `v15`). Si no, los usuarios reciben
  assets antiguos.
- Estrategia: network-first con fallback a cache; requests a
  `supabase.co`, Google Fonts y `openlibrary` se bypassean.
- Los handlers `message`, `notificationclick` y `push` están en `sw.js`;
  la capa in-app vive en `notifications.js`.

---

## 11. Git / ramas

- Rama por defecto: `main`.
- Los agentes automatizados desarrollan en ramas `claude/<slug>-<id>`.
- Commits breves, en presente, en español o inglés indistintamente
  (ver `git log`).
- **Nunca** push force a `main`. **Nunca** `--no-verify`.
- No crees PRs salvo petición explícita del usuario.

### Checklist antes de cerrar una tarea

- [ ] `npm test` pasa.
- [ ] Si tocaste `app.js`, replicaste la lógica pura en `lib/core.js`.
- [ ] Si tocaste assets cacheados, incrementaste `CACHE_NAME` en `sw.js`.
- [ ] `changes.json` sigue siendo `[]` (o contiene lo que esperas
      aplicar via CI).
- [ ] No hay claves/credenciales nuevas hardcodeadas más allá de las
      ya existentes.
- [ ] No hay `console.log` de depuración olvidados en rutas calientes
      (render de lista, quiz, SRS).

---

## 12. Tareas típicas — recetas rápidas

**Añadir una función utilitaria testeable**
1. Escríbela en `lib/core.js` como `export function`.
2. Cópiala tal cual a `app.js` (sin `export`) donde haga falta.
3. Añade un `describe` en `tests/utils.test.js` o crea un nuevo archivo
   `tests/<nombre>.test.js`.

**Añadir una vista nueva**
1. Añade `<div class="view" id="view-xxx">…</div>` dentro de `<main>`
   en `index.html`.
2. Añade botones de navegación en `nav` y `.bottom-nav` con
   `onclick="showView('xxx')"`.
3. Implementa el renderer en `app.js` y llámalo desde `showView`.
4. Añade los archivos nuevos al array `urlsToCache` de `sw.js` y sube
   `CACHE_NAME`.

**Cambiar un texto o fragmento corto por CI**
1. Edita `changes.json` con una op `replace` (el `old` debe existir
   textualmente en el archivo, un único match).
2. Commit + push a la rama objetivo.

---

## 13. Qué **no** hacer

- No introducir React/Vue/Svelte/bundlers.
- No refactorizar `app.js` en módulos ES sin discusión previa.
- No añadir TypeScript.
- No mover las claves Supabase a variables de entorno: rompes el
  despliegue estático.
- No reformatear archivos enteros con prettier/eslint.
- No tocar `changes_history/`: es el log auditable.
- No desactivar hooks de git ni workflows.

---

Mantén este archivo actualizado cuando cambie la arquitectura o el
flujo de CI. Si algo aquí contradice el código, el código es la fuente
de verdad — abre un parche al doc.
