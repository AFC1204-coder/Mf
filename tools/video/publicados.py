"""Vídeos publicados: del registro de subidas (`publicados.csv`) al índice que lee la web (`datos/videos.json`).

Los vídeos no viven en el repositorio: se suben a YouTube y aquí solo se apunta qué pieza es qué vídeo.

  - `publicados.csv` (una fila por pieza renderizada): `libro,pieza,tipo,titulo,youtube,guion`.
    La persona solo rellena `youtube` (el enlace o el identificador). Lo demás lo escribe esta orden.
  - `guion` es el vídeo y la huella del guion de la pieza **en el momento de registrarlo** (`<vídeo>:<huella>`). Si la pieza se vuelve
    a generar y su guion cambia (porque cambió la lección o el formato), el vídeo subido ya no dice lo mismo
    que el texto: deja de salir en la web hasta que se suba el nuevo y se cambie el enlace.
  - `datos/videos.json`: por lección y por libro, el identificador de YouTube y la duración de cada tipo de pieza.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

COLUMNAS = ["libro", "pieza", "tipo", "titulo", "youtube", "guion"]
ID_YT = re.compile(r"[A-Za-z0-9_-]{11}")
# Las formas de enlace que da YouTube al copiar: vídeo normal, Short, enlace corto, incrustado y Studio.
_EN_ENLACE = re.compile(r"(?:[?&]v=|youtu\.be/|/shorts/|/embed/|/live/|/video/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])")
VERSION = 1


def id_youtube(valor: str) -> str | None:
    """El identificador de 11 caracteres, a partir del identificador mismo o de cualquier enlace de YouTube. None si no lo hay."""
    v = (valor or "").strip()
    if not v:
        return None
    if ID_YT.fullmatch(v):
        return v
    m = _EN_ENLACE.search(v)
    return m.group(1) if m else None


def leer_csv(ruta: Path) -> list[dict[str, str]]:
    if not ruta.is_file():
        return []
    with ruta.open(encoding="utf-8", newline="") as f:
        return [{c: (fila.get(c) or "").strip() for c in COLUMNAS} for fila in csv.DictReader(f) if (fila.get("pieza") or "").strip()]


def escribir_csv(ruta: Path, filas: list[dict[str, str]]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, lineterminator="\n")
        w.writeheader()
        w.writerows({c: fila.get(c, "") for c in COLUMNAS} for fila in filas)


def piezas_renderizadas(output: Path, carpeta: str = "9x16") -> dict[tuple[str, str], dict[str, Any]]:
    """Las piezas con vídeo de todos los manifiestos: (libro, pieza) → lo que hace falta para el registro y el índice."""
    hechas: dict[tuple[str, str], dict[str, Any]] = {}
    for mf in sorted(output.glob(f"*/compartir/{carpeta}/manifiesto.json")):
        try:
            datos = json.loads(mf.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(datos, dict) or not isinstance(datos.get("piezas"), list):
            continue
        slug = mf.parent.parent.parent.name
        for x in datos["piezas"]:
            if not isinstance(x, dict) or not x.get("clave") or not x.get("video") or x.get("estado") not in (None, "ok", "sin-cambios"):
                continue
            try:
                huella = json.loads((mf.parent / x["clave"] / "pieza.json").read_text(encoding="utf-8")).get("huella", {})
            except (ValueError, OSError):
                huella = {}
            hechas[(slug, x["clave"])] = {
                "tipo": x.get("tipo") or "",
                "titulo": x.get("titulo") or "",
                "libro_id": datos.get("libro_id") or "",
                "leccion_id": x.get("leccion_id") or "",
                "duracion_s": float(x.get("duracion_s") or 0),
                "guion": str(huella.get("guion") or ""),
            }
    return hechas


def sincronizar(filas: list[dict[str, str]], hechas: dict[tuple[str, str], dict[str, Any]]) -> tuple[list[dict[str, str]], list[str]]:
    """Pone al día el registro con lo renderizado y devuelve (filas, avisos).

    Añade una fila por cada pieza nueva, apunta la huella del guion la primera vez que una fila trae vídeo y avisa
    de lo que no cuadra. Nunca borra una fila ni un enlace: lo que escribió la persona se conserva.
    """
    avisos: list[str] = []
    por_clave = {(f["libro"], f["pieza"]): f for f in filas}
    for clave, p in hechas.items():
        if clave not in por_clave:
            fila = {"libro": clave[0], "pieza": clave[1], "tipo": p["tipo"], "titulo": p["titulo"], "youtube": "", "guion": ""}
            filas.append(fila)
            por_clave[clave] = fila
    vistos: dict[str, str] = {}
    for f in filas:
        p = hechas.get((f["libro"], f["pieza"]))
        if p:
            f["tipo"], f["titulo"] = p["tipo"], p["titulo"]
        if not f["youtube"]:
            f["guion"] = ""  # sin vídeo no hay nada que comparar
            continue
        yt = id_youtube(f["youtube"])
        nombre = f"{f['libro']}/{f['pieza']}"
        if not yt:
            avisos.append(f"{nombre}: «{f['youtube']}» no es un enlace ni un identificador de YouTube; no se publica.")
            continue
        if yt in vistos:
            avisos.append(f"{nombre}: el mismo vídeo ({yt}) está apuntado también en {vistos[yt]}; revisa cuál es.")
        vistos.setdefault(yt, nombre)
        # La huella se apunta junto al vídeo al que corresponde: al cambiar el enlace por el del vídeo nuevo,
        # se vuelve a tomar sola.
        if p and p["guion"] and not f["guion"].startswith(f"{yt}:"):
            f["guion"] = f"{yt}:{p['guion']}"
    filas.sort(key=lambda f: (f["libro"], _orden(f["pieza"]), f["pieza"]))
    return filas, avisos


def _orden(pieza: str) -> tuple[int, int]:
    """Dentro de un libro: la pieza del libro, y luego lección a lección (idea, pregunta, práctica, caso, fondo)."""
    m = re.match(r"([a-z]+)-(\d+)", pieza)
    tipos = ["idea", "pregunta", "practica", "caso", "fondo"]
    if not m:
        return (0, 0)
    return (int(m.group(2)), tipos.index(m.group(1)) if m.group(1) in tipos else len(tipos))


def construir_indice(filas: list[dict[str, str]], hechas: dict[tuple[str, str], dict[str, Any]], previo: dict[str, Any] | None = None) -> tuple[dict[str, Any], list[str]]:
    """El índice de la web y los avisos de lo que se queda fuera.

    Una pieza entra si tiene un vídeo válido y su guion registrado coincide con el de la pieza generada. Una pieza
    registrada que no está generada en este equipo conserva lo que ya decía el índice anterior (`previo`): generar
    solo un libro no borra de la web los vídeos de los demás.
    """
    avisos: list[str] = []
    previo = previo if isinstance(previo, dict) else {}
    indice: dict[str, Any] = {"v": VERSION, "lecciones": {}, "libros": {}}
    descartados: set[str] = set()
    ids = [id_youtube(f["youtube"]) for f in filas if f["youtube"]]
    repetidos = {i for i in ids if i and ids.count(i) > 1}
    registrados = {id_youtube(f["youtube"]) for f in filas if f["youtube"]} - {None}
    for f in filas:
        yt = id_youtube(f["youtube"])
        if not yt or yt in repetidos:
            continue
        nombre = f"{f['libro']}/{f['pieza']}"
        p = hechas.get((f["libro"], f["pieza"]))
        if not p:
            continue  # no está generada aquí: se resuelve abajo con el índice anterior
        if p["guion"] and f["guion"] and f["guion"] != f"{yt}:{p['guion']}":
            descartados.add(yt)
            avisos.append(f"{nombre}: el guion ha cambiado desde que se subió el vídeo; no se publica hasta subir el nuevo y cambiar el enlace.")
            continue
        entrada = {"yt": yt, "s": int(round(p["duracion_s"]))}
        if p["leccion_id"]:
            indice["lecciones"].setdefault(p["leccion_id"], {})[p["tipo"]] = entrada
        elif p["libro_id"]:
            indice["libros"].setdefault(p["libro_id"], {})[p["tipo"]] = entrada
        else:
            avisos.append(f"{nombre}: el manifiesto no dice de qué lección ni de qué libro es; no se publica.")
    # Lo que ya estaba publicado y sigue registrado, pero no se ha generado en este equipo.
    presentes = {e["yt"] for grupo in ("lecciones", "libros") for tipos in indice[grupo].values() for e in tipos.values()}
    for grupo in ("lecciones", "libros"):
        for ident, tipos in (previo.get(grupo) or {}).items():
            if not isinstance(tipos, dict):
                continue
            for tipo, e in tipos.items():
                yt = e.get("yt") if isinstance(e, dict) else None
                if yt in registrados and yt not in presentes and yt not in repetidos and yt not in descartados and tipo not in indice[grupo].get(ident, {}):
                    indice[grupo].setdefault(ident, {})[tipo] = {"yt": yt, "s": int(e.get("s") or 0)}
    return indice, avisos


def actualizar(csv_ruta: Path, indice_ruta: Path, output: Path, carpeta: str = "9x16") -> tuple[dict[str, int], list[str]]:
    """Todo el paso: sincroniza el registro, escribe el índice y devuelve (recuento, avisos)."""
    hechas = piezas_renderizadas(output, carpeta)
    filas, avisos = sincronizar(leer_csv(csv_ruta), hechas)
    try:
        previo = json.loads(indice_ruta.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        previo = None
    indice, mas = construir_indice(filas, hechas, previo)
    escribir_csv(csv_ruta, filas)
    indice_ruta.parent.mkdir(parents=True, exist_ok=True)
    indice_ruta.write_text(json.dumps(indice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    publicados = sum(len(t) for g in ("lecciones", "libros") for t in indice[g].values())
    recuento = {"filas": len(filas), "con_enlace": sum(1 for f in filas if f["youtube"]), "publicados": publicados}
    return recuento, avisos + mas
