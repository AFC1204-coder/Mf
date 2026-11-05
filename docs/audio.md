# Escuchar la lección (con la pantalla apagada)

Botón «Escuchar lección» al final del texto. Dos motores:
- **Google Cloud (voz neuronal)**: se genera el audio completo, se guarda en el dispositivo (IndexedDB, `scs-tts-cache-v3`) y se reproduce con un elemento de audio normal. **Es el que sigue sonando con la pantalla apagada o en reposo**, porque no depende de la red mientras suena y el navegador trata el audio como multimedia.
- **Voz del navegador (Web Speech)**: solo si falla el anterior. **Se detiene al apagar la pantalla** (limitación del navegador); el reproductor lo avisa.

## Qué hace (5 nov 2026)
- **Sesión multimedia** (`navigator.mediaSession`): título de la lección, autor, libro e icono en la pantalla de bloqueo y en la notificación; botones de reproducir, pausa, parar y saltar ±15 s, y barra de posición.
- **Primer play dentro del toque** (`ttsDesbloquear`): se crea el audio y se «abre» con 0,1 s de silencio durante el gesto, porque iOS/Safari exigen que el play() ocurra ahí y el audio llega varios segundos después.
- Cambiar de lección o parar mientras se genera **no deja sonar el audio de la otra**; al repintar la lección el reproductor refleja lo que de verdad suena.
- Lógica pura y pruebas: `lib/audio.js`, `tests/audio.test.js`.

## Límites conocidos
- Probado con Chromium y un audio simulado: metadatos, estado, cambio de lección y repintado. **No probado con la pantalla apagada en un móvil real**: la garantía viene del comportamiento estándar de los navegadores móviles con audio multimedia.
- La primera vez que se escucha una lección hay que esperar a que se genere (unos segundos); las siguientes salen de la caché del dispositivo.
- Si se cambia de aplicación o se apaga la pantalla **durante la generación**, el audio puede no empezar; mejor esperar a que diga «Reproduciendo».
- **Pendiente de seguridad:** la clave de la API de Google Text-to-Speech está escrita en `app.js` y el repositorio es público; conviene restringirla (por dominio y solo a esa API) o moverla a una función de servidor.
