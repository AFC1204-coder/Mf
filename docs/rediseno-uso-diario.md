# Mente fría — rediseño para el uso diario

Documento de diseño · 10 oct 2026 · base: rama `claude/amazing-fermi-uhpapu`
(diagramas, rutas, «Compruébalo»), que ya incluye todo `main`.
**Estado: fusionado en `main` el 11 oct 2026 (PR #7).**

---

## 0. Resumen

**El problema no es el contenido; es que la app no tiene un día.** Hay 2.120
lecciones bien hechas, pero el uso real dice que la app se abre en rachas de
entusiasmo y se abandona: 31 días activos en 7 meses, 46 de las 62 lecciones
leídas cayeron en marzo, y desde abril el ritmo es de menos de dos al mes. Los
frenos son de producto, no de voluntad:

1. **El repaso es una deuda impagable.** 5.333 tarjetas vencidas, nunca vistas,
   de libros que no se han leído. Abrir «Repaso» es encontrarse un muro.
2. **No hay sesión con fin.** Leer, testear, repasar y anotar viven en cuatro
   pantallas y tres tablas; la racha solo cuenta una de ellas.
3. **Los recordatorios no llegan, y los que se generan culpan.** El aviso diario
   es un `setTimeout` que solo vive con la app abierta; el servidor escribe
   «💀 Racha perdida» en un panel que nadie abre desde mayo.
4. **Inicio es una biblioteca, no un plan.** 9 botones abajo, 256 tomos debajo
   del atril, tres entradas distintas a «repasar».

**La propuesta:** una única **Sesión de hoy** de 5–8 minutos —*Recuerda (3
tarjetas) → Lee (una lección) → Lleva (una acción)*— con fin explícito
(«Hasta mañana»), alimentada por un repaso que solo contiene lo que ya has
leído y que nunca enseña deuda. Alrededor: rutas por objetivo, versión de 2
minutos, constancia semanal en vez de racha frágil, y avisos con contenido o
ninguno.

**Prioridad:** primero *desatascar* (quick wins: una semana, casi sin datos
nuevos), luego *la sesión* (medio plazo), y por último *push real, grafo y
cuentas* (apuesta grande).

---

## 1. Diagnóstico

### 1.1 Lo que dicen los datos

Consultas sobre Supabase (`aduizdiiacrvpoavjmab`), 10 oct 2026. Un solo
usuario (`default`), así que son datos de un caso, no de una población; y la
app **no registra aperturas ni lectura sin marcar**, de modo que todo lo de
abajo es un suelo, no el uso total.

| Señal | Valor | Lectura |
|---|---|---|
| Lecciones marcadas (`progreso`) | 62 de 2.120 (2,9 %) | El corpus excede con mucho el consumo. |
| Días con actividad | 31 (20 feb – 30 ago) | Hueco medio entre días: **6,4 días**; hueco máximo: **67**. |
| Ritmo por mes | feb 7 · **mar 46** · abr 3 · may 1 · jun 3 · jul 0 · ago 2 · sep 0 | Luna de miel de 6 semanas y caída. |
| Días «atracón» (≥3 lecciones) | 8 de 31 | Se consume en bloque, no en hábito. |
| Preguntas de test respondidas | 60, todas entre 20 feb y 1 mar (+1 en ago) | El test se usó al principio y se abandonó. |
| `sesiones` de test | 4 (feb) | — |
| `repaso` (SRS) | 5.358 tarjetas activadas **en bloque** (9–21 mar) | 25 revisadas alguna vez. **5.333 vencidas hoy.** |
| `notas` / `subrayados` | 0 / 0 | «Al margen» no se usa. |
| `favoritos_usuario` | 7 | — |
| `notificaciones` | 101 generadas; 41 sin leer, todas desde 21 may | Desde mayo nadie abre el panel. |
| Hora de uso (Madrid) | **54 % entre 22:00 y 03:59**; pico a las 00:00 (35 de 122 eventos) | Es una app de noche. El día *no* debería acabar a medianoche. |
| Lección mediana | 498 palabras (cuerpo 264) ≈ **2,6 min** a 190 ppm | El atril promete «~20 minutos». |
| Diagramas | 563 lecciones (27 %) con `imagenes_inline` | Hay base para formato visual corto. |
| Preguntas | 29 por libro, ligadas a `libro_id`, **no a la lección** | Impide «3 preguntas de lo que acabas de leer» sin heurística. |
| Taxonomía real | 5 `eje_principal` · 13 `sub_eje` (el campo `eje` antiguo tiene variantes: «Neurociencia» / «Neurológico-Biológico») | Los «9 ejes» son sub_ejes; conviene fijarlo antes del mapa de dominios. |

### 1.2 El flujo actual, paso a paso

```
Inicio (atril)          → "Abrir el libro"
  Cuaderno 3 actos       (marco · mañana · giro) → "Cerrar por hoy"
  ↳ marca progreso, pone "Hasta mañana" en el atril
Inicio                  → (nada más que hacer aquí)
  "Cinco tarjetas"       → obtener_cola_repaso(limit 5)
                           ⚠ no filtra por libro: saca las 5 de nivel más bajo
                             de las 5.333, aunque el texto dice "del mismo hilo"
Test (otra pestaña)     → configurar eje / nº → 10 preguntas → tabla sesiones
Repaso (otra pestaña)   → "Pendientes hoy: 5.333"
```

Lo que funciona y hay que conservar: el **atril** (una sola lección propuesta),
el **hilo** («Anoche te quedaste aquí» + la frase), el **cuaderno de 3 actos**
(marco → qué haces → dónde se rompe), las **lámparas** (noches del mes, no
racha), el tono. Es ya el 60 % de la sesión diaria; falta cerrarla.

### 1.3 Frenos, ordenados por impacto

| # | Freno | Evidencia (código / datos) |
|---|---|---|
| F1 | **Deuda de repaso visible e impagable.** Se activan libros enteros (29 preguntas + ~8 reflexiones cada uno) sin haberlos leído. La cola ordena por `nivel ASC` → siempre salen tarjetas nuevas. El panel enseña el total. | `activar_libro_repaso`, `obtener_cola_repaso`, `renderSRSDashboard`; 5.333 vencidas. |
| F2 | **Curva de repaso corta y sin graduación.** Niveles 1–4 = 0 h / 1 d / 3 d / 7 d; el nivel 4 vuelve cada 7 días para siempre. Reflexión «Pendiente» cuenta como fallo (castiga la honestidad). | `registrar_repaso`. |
| F3 | **Sin sesión con fin.** Lectura, test, SRS y notas son vistas separadas; no hay un «hecho por hoy» que las agrupe. | 9 entradas en la barra inferior. |
| F4 | **La constancia cuenta mal.** `calcStreak`, `nochesEsteMes` y `check_racha` cortan el día a medianoche (54 % del uso es de noche) y solo miran `progreso`: repasar no cuenta; leer en el cuaderno sin pulsar «Cerrar por hoy» tampoco. | `calcStreak`, `check_racha`. |
| F5 | **Promesa de esfuerzo inflada.** «~20 minutos» para algo de ~3. Un coste percibido alto es el peor enemigo del hábito. | `renderAtril`. |
| F6 | **Recordatorios rotos y con culpa.** `scheduleReminder` es un `setTimeout` (muere al cerrar la PWA); lee `scs_last_study_date`, que nada escribe (si sonara, sonaría aunque hayas estudiado). `check_racha` inserta «Racha en peligro crítico» / «💀 Racha perdida»; el badge los excluye → invisibles y culposos a la vez. | `notifications.js`, `check_racha`. |
| F7 | **Inicio = biblioteca.** Atril + estantería + 4 botones rápidos + filtros por eje + 256 tomos paginados + rutas. La pregunta «¿qué hago hoy?» compite con «¿qué podría leer?». | `index.html` `#view-home`. |
| F8 | **Preguntas no ligadas a lecciones.** No se puede cerrar el bucle leer → recuperar con precisión. `Didactica.preguntasParaLeccion` lo aproxima por tokens. | esquema `preguntas`. |
| F9 | **Conexiones sin grafo.** `autores_relacionados` en 1.684 lecciones y `conexion_cruzada` en texto libre; `mapa.js` es un grafo escrito a mano con la taxonomía antigua. | — |
| F10 | **Sin identidad ni eventos.** Todo es `usuario_id='default'`, la anon key escribe en todas las tablas; no hay forma de medir D1/D7/D30 ni duración de sesión. | — |

---

## 2. Principios

1. **Un día, una sesión, un final.** El éxito de hoy es ver «Hasta mañana»,
   no pasar más tiempo. «Seguir» existe, pero es secundario.
2. **Deuda cero a la vista.** Nunca se muestra cuánto falta. El sistema decide
   qué cabe hoy y reprograma el resto en silencio.
3. **Solo se repasa lo que se ha leído.** Leer una lección es lo que mete sus
   tarjetas en el repaso. Nada de «activar libros».
4. **Minutos reales.** Cada promesa de tiempo sale de `Didactica.minutosLectura`.
5. **Profundidad opcional.** 2 minutos → cuaderno → folio completo → ensayo /
   esquema. Cada capa invita a la siguiente; ninguna la exige.
6. **Constancia sin castigo.** Se cuentan días por semana frente a un objetivo
   elegido; perder un día no borra nada; no hay mensajes de pérdida.
7. **El aviso trae valor o no se envía.** Un aviso es la idea del día, no «vuelve».

---

## 3. La Sesión de hoy (bucle de 5–8 min)

### 3.1 Composición

| Paso | Qué es | Tiempo | Fuente |
|---|---|---|---|
| **1. Recuerda** | 3 tarjetas. Prioridad: (a) la acción que te llevaste ayer («¿La hiciste?»), (b) vencidas de lecciones leídas, (c) una de otro eje (intercalado). | 1–2 min | `repaso` (solo leídas) |
| **2. Lee** | La lección del atril, en cuaderno de 3 actos. Selector **2 min / completa**. | 2–5 min | `lecciones` |
| **3. Comprueba** | 1 pregunta de esa lección (ya existe «Compruébalo»). Si fallas, entra al repaso para mañana. | 20 s | `preguntas.leccion_id` |
| **4. Lleva** | La acción de `aplicacion_practica`: *Hoy · Esta semana · No aplica*. Opcional: una frase «al margen». | 20 s | `compromisos`, `notas` |
| **Cierre** | Sello «Ex libris», lámpara encendida, frase-hilo de mañana. Botones secundarios: *Otra de este tomo* · *Más tarjetas (5)*. | — | — |

**Por qué Recuerda va primero.** (1) Es lo que más se pierde si la sesión se
corta tras leer; (2) la pregunta sobre lo de ayer es el gancho de continuidad
(«ayer leíste X…»), igual que el hilo; (3) son 3, nunca 30. En el primer día,
sin tarjetas, la sesión empieza en *Lee*.

**Día mínimo.** Si solo hay un minuto: «Solo recordar» (las 3 tarjetas) cuenta
como día hecho. Así un día malo no rompe la semana.

**Reglas de borde**
- Volver tras 10 días: misma sesión, mismas 3 tarjetas, ninguna mención a los
  días perdidos. El resto vencido se reparte en los días siguientes.
- Sesión a medias: cada paso se guarda; si se lee la lección, el día cuenta.
- **El día termina a las 04:00** (hora local, configurable). Leer a las 00:30 es
  «esta noche», no «mañana».
- Una sola lección nueva por sesión. «Otra de este tomo» existe al final, no antes.

### 3.2 Wireframes (móvil, 375 px)

**Inicio — antes de la sesión**
```
┌───────────────────────────────────┐
│ § Mente fría            ●●●○○○○ 3/5│  ← lámparas: días de esta semana / objetivo
│                                   │
│ HOY · 6 min                       │
│ ┌───────────────────────────────┐ │
│ │ Anoche te quedaste aquí:      │ │
│ │ «El ruido no se ve en un      │ │
│ │  juicio; solo en muchos.»     │ │
│ │                               │ │
│ │ ① Recuerda   3 tarjetas  1 min│ │
│ │ ② Lee        El precio del    │ │
│ │              ruido · 3 min    │ │
│ │ ③ Lleva      una acción       │ │
│ │                               │ │
│ │ [   Empezar   ]  Solo recordar│ │
│ └───────────────────────────────┘ │
│                                   │
│ TU RUTA · Pensar con claridad     │
│ ▓▓▓▓▓▓░░░░░░░░  9 de 21 sesiones  │
│                                   │
│ IDEA DEL DÍA                      │
│ «Una decisión buena puede salir   │
│  mal.» — Duke, Thinking in Bets   │
│                          Enviar ↗ │
├───────────────────────────────────┤
│  Hoy   Biblioteca  Repaso   Tú  🔍│
└───────────────────────────────────┘
```

**Paso 1 — Recuerda**
```
┌───────────────────────────────────┐
│ ‹ Salir          ━━━ ─── ─── 1/3  │  ← barra segmentada por pasos
│ RECUERDA · ayer                   │
│ Te llevaste: «Antes de decidir,   │
│ escribe qué te haría cambiar de   │
│ opinión».                         │
│                                   │
│ ¿Lo hiciste?                      │
│ [ Sí ]  [ A medias ]  [ No tocó ] │
└───────────────────────────────────┘
→ tarjeta 2 (quiz, A–D, explicación tras responder)
→ tarjeta 3 (reflexión: «¿Tienes ya tu posición?» Aún no / En ello / Sí)
```

**Paso 2 — Lee** (cuaderno actual, con selector)
```
┌───────────────────────────────────┐
│ ‹        ━━━ ━━━ ─── 2/3   A− A+ ♪│
│ [ 2 min ]  Completa · 4 min       │
│                                   │
│ ACTO I · EL MARCO                 │
│ El precio del ruido               │
│ A Flaw in Human Judgment — Kahneman│
│                                   │
│ IDEA CLAVE                        │
│ Dos jueces ante el mismo caso…    │
│ [diagrama: espectro]              │
│                                   │
│              ↓ el giro            │
└───────────────────────────────────┘
2 min  = idea_clave + diagrama + aplicación + giro (1 párrafo)
Completa = cuerpo + detalles + cruce
```

**Paso 3+4 — Comprueba y Lleva** (una pantalla)
```
┌───────────────────────────────────┐
│ ━━━ ━━━ ━━━ 3/3                   │
│ COMPRUÉBALO                       │
│ ¿Qué distingue ruido de sesgo?    │
│ ○ A …  ○ B …  ○ C …               │
│ ───────────────────────────────── │
│ LLÉVATELO                         │
│ «Pide dos estimaciones            │
│  independientes antes de una      │
│  decisión importante.»            │
│ [ Hoy ] [ Esta semana ] [No aplica]│
│ Al margen: ______________________ │
│                                   │
│ [         Cerrar por hoy        ] │
└───────────────────────────────────┘
```

**Cierre**
```
┌───────────────────────────────────┐
│ La lámpara sigue encendida        │
│                                   │
│ Hasta mañana.                     │
│ 3 recordadas · 1 leída · 1 acción │
│ Esta semana: ●●●●○ (4 de 5)       │
│                                   │
│ Mañana abre aquí:                 │
│ «…y si nadie mide el ruido, nadie │
│  lo corrige.»                     │
│                                   │
│ Ex libris · 10 oct                │
│                                   │
│  Otra de este tomo · Más tarjetas │
└───────────────────────────────────┘
```

**Inicio — sesión hecha:** la tarjeta HOY colapsa a «Hecho por hoy · Mañana:
⟨frase⟩» y debajo aparece la exploración libre (ruta, biblioteca). No hay un
segundo «objetivo».

### 3.3 Cómo se arma (lógica)

Un RPC `sesion_del_dia(p_usuario)` (o función pura en `lib/sesion.js`, con
tests, que reciba `lecs/prog/repaso`) devuelve:

```json
{
  "dia": "2026-10-10",
  "hecha": false,
  "minutos": 6,
  "recuerda": [ {"repaso_id": "…", "tipo": "compromiso"}, {"tipo": "quiz"}, {"tipo": "reflexion"} ],
  "lee": { "leccion_id": "…", "min_corta": 2, "min_completa": 4, "ruta_id": "pensar", "paso": 9 },
  "comprueba": { "pregunta_id": "…" },
  "lleva": { "texto": "…" }
}
```

Selección de la lección: siguiente paso pendiente de la ruta activa → si no
hay, el hilo (`siguienteLeccionMismoLibro`) → si no, `pickNocheLeccion`.

---

## 4. Repaso unificado: «Hoy decide»

Un solo motor, una sola tabla (`repaso`), una sola pestaña. Test, SRS,
«Repaso rápido» y notas pasan a ser *tipos de tarjeta* y *modos de práctica*.

**Entrada automática.** Al leer una lección se crean: 1–2 tarjetas *quiz* (sus
preguntas), 1 *reflexión* (su `aplicacion_practica`) y, si se eligió en
«Lleva», 1 *compromiso* para el día indicado. Al guardar una nota, 1 tarjeta
*nota* («Escribiste: … ¿Sigue valiendo?») a los 7 días. Fallar en un test
libre mete esa pregunta.

**Migración de la deuda.** Las 5.333 tarjetas nunca revisadas pasan a
`estado='dormida'` salvo las de lecciones ya leídas: su reflexión y hasta 3 preguntas afines
(`preguntasParaLeccion`) — 62 lecciones → unas 250 tarjetas, repartidas en 14 días. Se despiertan solas al leer su lección.

**Intervalos** (Leitner ampliado, sencillo y explicable):

| nivel | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| próxima | hoy | 1 d | 3 d | 7 d | 16 d | 35 d | 90 d → «asentada» |

- Acierto: +1. Fallo: −2 (mínimo 1), vuelve mañana (no «hoy otra vez»).
- Reflexión «Aún no»: no baja; vuelve en 3 días. «En ello»: +0. «Sí»: +1.
- Compromiso: se pregunta una vez; «A medias / No tocó» lo reprograma a 7 días una sola vez.
- Más adelante, si hay volumen: FSRS (ver Apuesta grande).

**Presupuesto diario.** 3 tarjetas en la sesión; «Más tarjetas» añade bloques
de 5 hasta 20. Si hay más vencidas, se eligen por (nivel bajo, más atrasada,
eje distinto) y el resto se **reprograma** con jitter a los próximos 7 días.
El número total no se muestra en ningún sitio.

**Pestaña Repaso** (práctica libre, fuera de la sesión)
```
REPASO
  Hoy ya está hecho ✓            (o: 3 tarjetas te esperan en Hoy)
  Practicar
   · 5 tarjetas al azar de lo leído
   · Test de un tomo           (los leídos primero)
   · Test de un eje
  Asentado
   Psicología y Conducta  ▓▓▓▓░  41 ideas
   …
```

---

## 5. Organización didáctica

### 5.1 Rutas por objetivo

Hoy hay 8 rutas en `Didactica.RUTAS`, resueltas por fragmento de título y con
**libros enteros** como pasos (6 libros × 8 lecciones ≈ 48 sesiones: demasiado
largo para sentir avance). Propuesta:

- **Una ruta = 15–25 lecciones escogidas**, no libros completos: 2–4 lecciones
  troncales por libro, en orden. Duración visible: «21 sesiones · ~3 semanas».
- **Objetivos de entrada** (lo que se pregunta en el onboarding) mapeados a rutas:

| Objetivo | Ruta(s) | Estado |
|---|---|---|
| Decidir mejor | Pensar con claridad → Decidir con riesgo | existen |
| Entender a la gente | Influencia y poder | existe |
| Pensar económicamente | Dinero y mercados · Instituciones y civilización | existen; falta una ruta de economía básica (incentivos, coste de oportunidad, precios) sobre los 54 libros de Economía |
| Gestionar emociones | Estoicismo y sentido + Cuerpo y cerebro (parcial) | **falta** «Emociones y atención» (Dopamine Nation, The Body Keeps the Score, Fluir, estoicos…) |
| Entender la historia | Instituciones · Estrategia y conflicto | existen |

- **Prerrequisitos blandos**: una lección puede *sugerir* otra antes («Antes
  te conviene: Sistema 1 y Sistema 2 · 3 min»). Nunca bloquea.
- Las rutas pasan de código a tablas (`rutas`, `ruta_pasos`) para poder
  editarlas desde `admin.html`.

### 5.2 Grafo de conexiones

- **Fase automática**: cada nombre de `autores_relacionados` que coincida con
  `libros.autor` crea una arista lección → libro (tipo `cita`). Cubre gran parte
  de las 1.684 lecciones con autores sin trabajo manual.
- **Fase curada**: clasificar `conexion_cruzada` en `amplía · contradice ·
  aplica · precede` (lote asistido por LLM + revisión en admin; sin inventar
  citas, solo etiquetar relaciones ya escritas).
- **Uso en la interfaz**: el bloque «Cruce» gana un enlace «Leer el cruce · 3
  min»; el chip «Quién se pelea» usa aristas `contradice`; el final del tomo
  sugiere por aristas en vez de por sub_eje; `mapa.html` se regenera desde la
  tabla (hoy es un grafo escrito a mano con la taxonomía antigua).

---

## 6. Formatos cortos

| Formato | Qué | Dónde | Coste |
|---|---|---|---|
| **2 min** | `idea_clave` + diagrama + aplicación + giro resumido | Selector en cuaderno; por defecto si `minutos_dia ≤ 5` | Bajo: datos ya existen |
| **Idea del día** | Una `cita_memorable` o `idea_clave` de la ruta (632 lecciones con cita) | Inicio, aviso diario, carta compartible | Bajo |
| **Solo recordar** | 3 tarjetas, 1 min, cuenta como día | Botón secundario de HOY | Bajo |
| **Escuchar la sesión** | TTS encadena lección + acción (motor actual + caché IndexedDB) | Botón ♪ en la barra del cuaderno | Medio |
| **Más diagramas** | Ampliar `imagenes_inline` del 27 % a todas las lecciones de las rutas primero | Pipeline de contenido | Medio (contenido) |

---

## 7. Motivación sobria

- **Constancia semanal, no racha frágil.** El usuario elige 3, 5 o 7 días por
  semana. Las lámparas pasan de «noches del mes» a «días de esta semana / objetivo».
  La cifra que se arrastra es «semanas cumplidas seguidas»; un día perdido no
  borra nada.
- **Mapa de dominios.** Rejilla 5 ejes × 13 sub_ejes con tres estados por
  celda: *visto* (lección leída) · *en repaso* · *asentado* (tarjetas en nivel ≥ 5).
  «Dominado» mide retención, no lectura.
- **Resumen semanal** (domingo noche, en «Tú» y como carta): días, lecciones,
  ideas asentadas, una frase tuya (nota o compromiso cumplido) y qué viene en
  la ruta. Sin comparaciones.
- **Fuera**: partículas y logros emergentes (`spawnAchievementParticles`),
  mensajes «Racha perdida», contadores de deuda, insignias con número rojo,
  feeds infinitos, «solo te faltan 2 para…».

---

## 8. Primera impresión

**Onboarding (3 preguntas, < 30 s)**
```
1/3  ¿Qué quieres entrenar?
     ○ Decidir mejor        ○ Entender a la gente
     ○ Pensar en economía   ○ Gestionar emociones
     ○ Entender la historia ○ Solo explorar

2/3  ¿Cuánto tiempo al día?
     ○ 3 min (2 min + recordar)   ● 7 min   ○ 15 min (completa + más tarjetas)

3/3  ¿Cuándo sueles leer?
     ○ Mañana   ○ Mediodía   ● Noche   → hora de aviso + tema noche

→  Tu ruta: Pensar con claridad · 21 sesiones
   Primera sesión: 4 min, sin repaso todavía.
   [ Empezar ]
```
Se guarda en `perfil_usuario`; se puede cambiar en «Tú». Para el usuario
actual se precarga desde su historial (ruta con más lecciones leídas, noche).

**Navegación: de 9 a 5**

| Antes | Después |
|---|---|
| Inicio, Favoritos, Test, Buscar, Esquemas, Ensayos, Repaso, Rápido ⚡, Notificaciones | **Hoy** · **Biblioteca** (estantería, rutas, esquemas, ensayos) · **Repaso** (práctica libre, test) · **Tú** (constancia, mapa, resumen, guardados, notas, ajustes) · 🔍 |

---

## 9. Recordatorios que no molestan

**Reglas**: como máximo uno al día; a la hora elegida; solo si la sesión no
está hecha; el texto es la idea del día (que aporta aunque no se abra);
tras 3 avisos seguidos ignorados, pasa a semanal y lo dice una vez; nunca
pérdidas ni urgencia.

**Ejemplo**: «*Una decisión buena puede salir mal.* — Hoy: El precio del ruido · 3 min».

**Implementación real** (hoy no existe): Web Push con VAPID →
tabla `push_suscripciones`, Edge Function `enviar-recordatorios`, `pg_cron`
cada 15 min que elige a quién toca. En iOS solo funciona con la PWA instalada
(iOS 16.4+), así que el permiso se pide **después de la tercera sesión
completada**, no al entrar.

**Antes del push** (quick win): dejar de insertar avisos de racha, corregir
`scs_last_study_date` y mostrar la idea del día dentro de la app.

---

## 10. Métricas de éxito

### 10.1 Qué medir

- **Norte**: días con sesión cerrada por semana (por usuario).
- **Hábito**: % de semanas con objetivo cumplido; días activos / 30.
- **Sesión**: tasa de finalización (cerradas / empezadas); mediana de minutos;
  pasos completados; uso de «Solo recordar».
- **Aprendizaje**: acierto en tarjetas maduras (intervalo ≥ 7 d); ideas
  asentadas por semana; compromisos «Sí» / respondidos.
- **Avisos**: aviso → sesión en < 2 h.
- **Retención D1/D7/D30**: solo tiene sentido con más de un usuario (requiere
  cuentas; ver Apuesta grande). Con n = 1, la equivalente es «¿abrió el día
  siguiente / la semana siguiente / el mes siguiente tras una sesión?».

**Objetivos iniciales** (para el uso propio): ≥ 5 días/semana en 6 de 8
semanas; finalización ≥ 80 %; mediana 5–9 min; acierto maduro ≥ 85 %.

### 10.2 Con las tablas actuales (ya se puede)

```sql
-- Días activos por semana (corte 04:00, Madrid)
select date_trunc('week', d) semana, count(*) dias
from (select distinct ((fecha at time zone 'Europe/Madrid') - interval '4 hours')::date d
      from progreso where usuario_id = 'default') x
group by 1 order by 1;

-- Acierto en tarjetas maduras
select round(100.0*sum(veces_correcta)/nullif(sum(veces_correcta+veces_incorrecta),0)) pct
from repaso where nivel >= 3 and modo = 'quiz';
```

Límite: no hay aperturas, duración, ni pasos. Por eso hace falta:

### 10.3 Tabla de eventos (mínima)

```sql
create table eventos (
  id bigserial primary key,
  usuario_id text not null default 'default',
  ts timestamptz not null default now(),
  dia date not null,              -- día lógico con corte 04:00, calculado en cliente
  tipo text not null,             -- app_abierta · sesion_inicio · paso_hecho · sesion_cerrada
                                  -- leccion_leida · tarjeta · aviso_enviado · aviso_abierto · onboarding
  props jsonb not null default '{}'  -- {paso:'recuerda', modo:'corta', segundos:142, resultado:'ok', ...}
);
create index on eventos (usuario_id, dia);
```

Con ella, las métricas son vistas (`v_dias`, `v_sesiones`, `v_retencion`) y un
panel en `admin.html`. Se escribe con *fire-and-forget* (cola en
`localStorage` si no hay red), sin bloquear la UI.

---

## 11. Cambios de datos

| Cambio | Para qué | Fase |
|---|---|---|
| `repaso.estado text default 'activa'` (`activa · dormida · asentada`) + migración de las 5.333 | Deuda cero | QW |
| Reescribir `registrar_repaso` (niveles 0–6, fallo −2, reflexión sin castigo) | Curva útil | QW |
| `obtener_cola_repaso(p_usuario, p_limite, p_libro_id null)` filtrando `estado='activa'` | «5 tarjetas del mismo hilo» de verdad | QW |
| `check_racha`: sin inserts de notificación; corte 04:00; contar `repaso.ultima_revision` | Constancia honesta | QW |
| `preguntas.leccion_id uuid null` + backfill (heurística `preguntasParaLeccion` → revisión en admin / lote LLM) | Comprueba y Recuerda precisos | M |
| `repaso.modo` admite `compromiso`, `nota`; `repaso.origen text` | Repaso unificado | M |
| `compromisos (id, usuario_id, leccion_id, texto, para date, resultado text null, created_at)` | Paso «Lleva» | M |
| `perfil_usuario (usuario_id pk, objetivo, minutos_dia, momento, hora_aviso time, ruta_id, dias_semana int, corte_hora int default 4, onboarding_at)` | Onboarding y sesión | M |
| `eventos` (§10.3) | Medir | M |
| `rutas (id, titulo, sub, descripcion, objetivo, orden)` · `ruta_pasos (ruta_id, orden, leccion_id, por, opcional bool)` | Rutas editables, por lecciones | M |
| `conexiones (id, origen_leccion uuid, destino_libro uuid, destino_leccion uuid null, tipo, nota, fuente)` | Grafo | G |
| `push_suscripciones (usuario_id, endpoint, p256dh, auth, created_at, ultimo_envio, ignorados int)` | Push real | G |
| Supabase Auth + RLS por `auth.uid()` en lugar de `'default'` | Multiusuario y D1/D7/D30 | G |

---

## 12. Plan priorizado

### Quick wins · ~1 semana · casi sin datos nuevos

| # | Cambio | Archivos | Hecho cuando |
|---|---|---|---|
| QW0 | ✅ Fusionar en `main` (diagramas, rutas, Compruébalo y todo el rediseño) | — | `main` despliega diagramas. **Hecho el 11 oct 2026 (PR #7)** |
| QW1 | **Desatascar el repaso**: migración `estado`, nueva curva, cola solo activas, «Cinco tarjetas» filtrado por libro | SQL, `app.js` (SRS) | La pestaña Repaso nunca muestra > 20; las 5 tarjetas son del tomo |
| QW2 | **Corte del día a las 04:00** en `hoyISO`, `calcStreak`, `nochesEsteMes`, `isNocheCerrada`, `check_racha` | `lib/core.js`, `app.js`, SQL | Test de racha con eventos a las 00:30 |
| QW3 | Repasar cuenta como día (racha/lámparas) | `app.js`, SQL | — |
| QW4 | Minutos reales en el atril (`Didactica.minutosLectura`) | `app.js` | Desaparece «~20 minutos» |
| QW5 | **Apagar la culpa**: sin inserts de racha, sin partículas, `scs_last_study_date` escrito al cerrar | `notifications.js`, SQL | Ningún mensaje con «perdida» / «peligro» |
| QW6 | Barra inferior a 5 entradas (Hoy · Biblioteca · Repaso · Tú · 🔍) moviendo vistas, sin borrarlas | `index.html`, `app.js`, `styles.css` | Todas las vistas siguen alcanzables |

**Estado (10 oct 2026):** QW1–QW6 hechos en código (`lib/dia.js`, `app.js`,
`notifications.js`, `index.html`, `styles.css`). La parte de servidor está en
`supabase/migrations/20261010_quick_wins.sql`, **aplicada el 10 oct 2026**
(5.333 tarjetas dormidas, 25 activas, 6 funciones, cola ≤ 20). QW0 (fusionar en `main`): **hecho el 11 oct 2026** con el PR #7, que llevó a `main` el rediseño, los 1.550 diagramas de lección (`datos/diagramas.json`) y los 256 mapas de libro (`datos/mapas.json`); desplegado en GitHub Pages y comprobado en producción.
De paso: el modo «Mixto» del repaso nunca devolvía tarjetas (`p_modo='mixto'`
no coincidía con ningún `modo`); corregido en cliente y en la migración.

### Medio plazo · 3–6 semanas · la sesión

| # | Cambio | Depende de |
|---|---|---|
| M1 | **Sesión de hoy** v1 en cliente: `lib/sesion.js` (puro, con tests) + vista de 4 pasos + cierre + tarjeta HOY en Inicio | QW1–QW4 |
| M2 | Tarjetas creadas al leer + `preguntas.leccion_id` (backfill heurístico + revisión en admin) | M1 |
| M3 | Paso **Lleva** + `compromisos` + «¿Lo hiciste?» al día siguiente | M1 |
| M4 | `eventos` + vistas + panel de métricas en admin | — (empezar pronto para tener línea base) |
| M5 | **Onboarding** + `perfil_usuario` + constancia semanal | M1 |
| M6 | Modo **2 min** en cuaderno | — |
| M7 | Rutas a tablas, por lecciones (15–25), + rutas «Emociones y atención» y «Economía básica» | — |
| M8 | Resumen semanal + mapa de dominios en «Tú» | M2, M4 |

**Estado (10 oct 2026):** M1 (sesión de hoy v1), M3 (paso «Lleva» con
compromisos), M4 (eventos, en el cliente) y la parte de M2 que no necesita
datos nuevos (tarjetas al leer) están en código: `lib/sesion.js` (+ tests),
`sesion-ui.js`, tarjeta «Hoy» en el atril. Tablas `eventos` y `compromisos` y
vistas de métricas en `supabase/migrations/20261011_sesion_eventos.sql`
(**aplicada el 10 oct 2026**, sin RLS: ver §14). **Estado (10 oct 2026, 2.ª entrega):** M5 hecho (onboarding de 3 preguntas
—objetivo, tiempo, días por semana—, ruta activa que decide la lección de la
sesión, constancia semanal con «semanas seguidas con tu objetivo»; el perfil
vive en el navegador, sin tabla), M8 hecho (resumen de la semana y mapa de
dominios en «Tú»; «asentadas» sale de las reflexiones en nivel ≥ 4), M6
cubierto por el modo «2 min» de la sesión, y M7 a medias (rutas «Emociones y
atención» y «Economía básica» añadidas en `lib/didactica.js`; falta pasarlas a
tablas editables). Pendiente: M2 (`preguntas.leccion_id`, requiere migración y
backfill), `perfil_usuario` en base de datos (hoy solo local), resumen
semanal como carta compartible, y la apuesta grande (push, grafo, cuentas).

### Apuesta grande · 2–3 meses

| # | Cambio | Por qué es grande |
|---|---|---|
| G1 | **Push real** (VAPID + Edge Function + `pg_cron`) con las reglas del §9 | Infraestructura nueva; iOS solo con PWA instalada |
| G2 | **Grafo** `conexiones` (auto + curado) → cruces navegables, «quién se pelea», `mapa.html` generado | Curación de 2.120 lecciones |
| G3 | **Cuentas** (Supabase Auth, magic link) + RLS + migrar `'default'` | Requisito para crecer y para D1/D7/D30 |
| G4 | Programación **FSRS** con los datos de `eventos` | Solo merece la pena con meses de historial |
| G5 | **Escuchar la sesión** completa (TTS encadenado, descargable) | Coste de TTS y UX de audio en segundo plano |

### Secuencia

```
Semana 1  QW0 · QW1 · QW2 · QW3 · QW4 · QW5      ← y M4 (eventos) para medir desde ya
Semana 2  QW6 · M6
Sem. 3–4  M1 (sesión) · M2
Sem. 5–6  M3 · M5 · M7
Sem. 7–8  M8 · revisión de métricas (¿≥ 5 días/semana?)
Después   G1 → G2 → G3 → G4/G5, según lo que digan los datos
```

Cada fase: tests en `tests/` (vitest ya montado; `lib/sesion.js` y el nuevo
cálculo de día deben entrar con tests), commits pequeños y sin PR salvo
petición.

---

## 13. Decisiones abiertas

1. **Orden de la sesión**: Recuerda → Lee → Lleva (recomendado) o Lee primero.
2. **Constancia**: objetivo semanal elegido (recomendado) o racha diaria con comodín.
3. **Las 5.333 tarjetas**: dormirlas (recomendado, reversible) o borrarlas.
4. **Barra inferior**: ¿Esquemas y Ensayos dentro de Biblioteca (recomendado) o conservar acceso directo?
5. **Cuentas**: ¿la app seguirá siendo de un usuario (se aplaza G3) o se quiere abrir a más gente (G3 sube a medio plazo)?

---

## 14. Nota de seguridad (10 oct 2026)

Las tablas `eventos` y `compromisos` se crearon **sin RLS**, igual que el resto
(`repaso`, `progreso`, `notas`…): la app usa la clave anónima, que es pública, con
un usuario único `default`, así que cualquiera con esa clave puede leerlas y
escribirlas. El contenido es de baja sensibilidad (eventos de uso y el texto de
las acciones, que sale de las lecciones), pero la solución real es G3: Supabase
Auth + RLS por `auth.uid()`. Hasta entonces, no guardar en la base de datos nada
más sensible que lo que ya hay.

---

## 15. Imágenes (oct 2026)

- **Auditoría de los SVG antiguos** (`docs/auditoria-svg.md`): ≈ 90 % con texto ilegible en móvil, 205+ con faltas de tilde, 22 corruptos. Se propone rehacerlos como especificaciones para el motor de diagramas, no como SVG libre.
- **Infografías por libro** (`docs/infografias.md`): tubería generadora con revisión humana, lista para usarse cuando haya clave de API y se aplique `20261012_infografias.sql`.

---

## 15. Engagement y didáctica · entrega del 11 oct 2026

Código hecho y desplegado (PR #8). Migración `supabase/migrations/20261013_preguntas_leccion_perfil.sql` **aplicada el 11 oct 2026** (2.178 de 7.044 preguntas emparejadas automáticamente; `perfil_usuario` sin RLS, como el resto):

| Mejora | Qué hay | Estado |
|---|---|---|
| **Panel de métricas** | Admin → «Métricas»: sesiones empezadas/cerradas/abandonadas, finalización, duración mediana, dónde se abandona, retención D1/D7/D30, compromisos cumplidos, onboarding y actividad diaria. Lógica pura en `lib/metricas.js` (+ tests); lee `eventos`, no necesita migración nueva | Hecho |
| **Pregunta ↔ lección (M2)** | `preguntas.leccion_id` + `leccion_origen` (`auto`/`manual`). La migración rellena solo las parejas claras (la mejor lección puntúa ≥ 1,3× la segunda; ≈ 30 % en una muestra de 400). `Didactica.preguntasParaLeccion` usa primero las asignadas y después el parecido de texto. Admin → «Preguntas» permite confirmar o reasignar | Hecho |
| **Perfil en la base** | Tabla `perfil_usuario` (usuario `default`); `perfilSincronizar()` al arrancar y `perfilSubir()` al guardar. Gana el perfil más reciente; si la tabla no existe, no pasa nada | Hecho |

Siguiente (sin empezar): modo «completa el diagrama / ordena los pasos» con las figuras existentes,
calibración («¿cuánto crees que sabes?») en «Comprueba», enlaces entre libros, rutas a tablas (M7),
cuentas + recordatorios (G3). El panel de métricas debe leerse unas semanas antes de decidir el orden.

---

## 16. Del impulso a la atención profunda (diseño, 11 oct 2026)

**Objetivo.** Que el impulso de coger el móvil en un hueco acabe aquí y no en X: entrada instantánea,
consumo breve pero activo y, cuando hay tiempo, paso natural a leer o reflexionar en profundidad.

### 16.1 Arranque instantáneo (requisito previo)
Cada apertura descargaba todo el corpus (≈ 17 MB de lecciones, de ellos 5,5 MB del índice de búsqueda
`busqueda` y 3,8 MB de SVG antiguos ya sustituidos por diagramas, + 6 MB de preguntas) sin caché de datos.
Solución: columnas explícitas (sin `busqueda` ni SVG antiguos), páginas en paralelo y corpus guardado en
IndexedDB; la app arranca con lo guardado y se actualiza en segundo plano.

**Estado (11 oct 2026): hecho.** `lib/corpus.js` (+ tests): columnas explícitas, páginas en paralelo,
corpus y datos del usuario en IndexedDB (contenido caduca a las 6 h; usuario se refresca en cada apertura),
SVG antiguo solo bajo demanda. Service worker «caché primero» para los archivos de la app.
Prueba en Chromium con Supabase simulado: segunda apertura con la red retrasada 4 s → app lista en ~0,2 s.

### 16.2 Mazo de fichas
Al abrir: 5 fichas, se pasa deslizando, **finito** («Has terminado por ahora»). Cada ficha pide algo:
1. Reanudar lo que quedó a medias (o una tarjeta de repaso pendiente).
2–3. Ideas de la **próxima lección de la ruta** (idea clave + diagrama): preparan la lectura.
4. Contraste con algo ya leído (cita o matiz hasta tener enlaces entre lecciones).
5. Cierre con una única oferta de subir.
El mazo siguiente se precalcula y se guarda: la primera ficha aparece en < 1 s aunque no haya red.
El mazo sustituye a Inicio al abrir (botón discreto «Ir a la biblioteca»).

### 16.3 La escalera
| Peldaño | Qué | Tiempo |
|---|---|---|
| 0 · Ficha | idea + diagrama, pregunta de recuerdo o cita | 20–40 s |
| 1 · Ampliar | en la misma pantalla: razonamiento (16.4), matiz y aplicación | 1 min |
| 2 · Lección | completa, abierta por el fragmento de la ficha | 5–10 min |
| 3 · Contraste | lección de otro libro que coincide o choca; «¿en qué coinciden y en qué chocan?» | 3–5 min |
| 4 · Tu posición | una frase propia, guardada, que reaparece semanas después | 1–2 min |

Reglas (cada una evita un fallo concreto):
- **Sin scroll infinito disfrazado**: nada encadena solo; subir siempre es un toque tuyo, salir también.
- **Sin presión**: una sola oferta de subir por mazo, al final, según una señal tuya (ficha en la que te
  detuviste, pregunta fallada, ficha ampliada). Decir que no no cuesta nada.
- **Sin salto en frío**: la lección se abre por el fragmento relacionado, con la ficha como ancla y el tiempo restante.
- **Interrupciones**: posición guardada siempre; la siguiente apertura empieza por «Seguías en… · quedan N min».
  La lectura profunda se reparte entre huecos.
- **Las fichas no sustituyen a la lectura**: salen de la próxima lección de la ruta; en «Tú» se ve la
  proporción semanal fichas / lecturas completas.

Métricas: tasa de ascenso (aperturas que llegan al peldaño ≥ 2), lecturas reanudadas y, como freno,
que el ascenso no suba a costa de menos aperturas.

### 16.4 Razonamiento desde primeros principios
Para cada libro y, por tandas, cada lección argumentativa: **premisas** (2–3) → **pasos** (2–4) →
**conclusión** → **supuesto crítico** (si cae, cae todo) → **qué lo refutaría** (opcional).
Objetivo: aceptar una idea porque se sostiene y es contrastable, no por el prestigio del autor.
- Peldaño 1 de la escalera; ficha de recuerdo («¿qué premisa sostiene esto?»); en el contraste, dos
  esquemas lado a lado muestran **en qué premisa** divergen los autores.
- Reglas: sale del texto de la lección (nada que no esté); «no aplica» en lecciones técnicas,
  históricas o biográficas; plantilla `razonamiento` en el motor con validación; datos en archivo.
- Orden: muestra de 20 libros para revisar el formato → 256 libros → lecciones de las rutas activas → resto.

### 16.5 Orden de construcción
1. Arranque instantáneo. 2. Mazo + peldaños 0–2 + reanudación. 3. Eventos y métricas de la escalera.
4. Razonamientos (muestra → libros → lecciones). 5. Contraste (enlaces entre lecciones). 6. Tu posición.

