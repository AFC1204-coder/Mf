# Renderizar un lote de libros en tu ordenador

Para producir en serie sin depender de una sesión en la nube. Todo es gratuito y no pide claves.

## Una vez: preparar

Hace falta **Python 3.10+**, **ffmpeg** (con ffprobe) y **Google Chrome** o Chromium. En macOS: `brew install ffmpeg`.

Desde la raíz del repositorio, en la rama `claude/video-compartible`:

```bash
python3 -m venv tools/video/.venv
```

```bash
tools/video/.venv/bin/pip install -r tools/video/requirements.txt
```

## Lanzar el lote

Un libro entero, con todas sus piezas y con la voz elegida:

```bash
tools/video/.venv/bin/python -m tools.video.cli libro "Decisive" --format compartir
```

Los diez libros del lote de prueba, uno detrás de otro:

```bash
for libro in "Decisive" "Four Thousand Weeks" "Hábitos Atómicos" "El hombre en busca de sentido" "The War of Art" "Dopamine Nation" "Range" "Verbal Judo" "Attached" "Games People Play"; do tools/video/.venv/bin/python -m tools.video.cli libro "$libro" --format compartir; done
```

O los siguientes libros de la biblioteca que aún no estén completos, sin nombrarlos:

```bash
tools/video/.venv/bin/python -m tools.video.cli biblioteca --format compartir --limit 10
```

## Qué esperar

- **Tiempo.** Cada pieza tarda más o menos lo que dura (algo más en un equipo lento). Un libro son unas 25 piezas y 40 minutos de vídeo: cuenta con una hora por libro.
- **Se puede cortar y retomar.** Si lo paras o se va la red, vuelve a lanzar la misma orden: las piezas ya hechas se saltan («sin cambios») y sigue por donde iba.
- **Un fallo no detiene el lote.** La pieza que falle queda anotada y las demás siguen. Al terminar, lanza la misma orden otra vez: solo reintenta las que faltan.
- **La voz necesita conexión.** Es un servicio gratuito en línea y a ratos no responde; el generador reintenta solo durante minuto y medio antes de dar la pieza por fallida.
- **Varios libros a la vez.** Se puede abrir una terminal por libro. Con más de dos a la vez en un portátil normal no se gana tiempo.

## Dónde queda todo

`tools/video/output/<libro>/compartir/9x16/`

- Una carpeta por pieza con `video.mp4`, `video.srt`, `miniatura.png`, `guion.md` y `publicacion.txt` (el texto para cada red).
- `manifiesto.md`: las piezas del libro, su duración, el orden de publicación sugerido y lo que no ha salido, con su motivo.

Con varios libros hechos, el calendario de publicación:

```bash
tools/video/.venv/bin/python -m tools.video.cli calendario --por-dia 2
```

## Variantes útiles

| Quiero… | Añade |
|---|---|
| Solo las piezas cortas y las de idea | `--piezas idea,pregunta,practica,caso,libro` |
| Solo la versión larga | `--piezas fondo` |
| Las piezas de un minuto, sin explicación | `--breve` |
| Cuadrado u horizontal | `--aspecto 1:1` o `--aspecto 16:9` |
| Ver el aspecto sin gastar voz (rápido) | `--engine mudo` |
| Otra voz | `--voice es-ES-AlvaroNeural` |
| Solo la lección 3 de un libro | `--only 3` |
