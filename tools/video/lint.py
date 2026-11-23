"""Control de calidad del guion antes de renderizar. Un episodio con errores no se renderiza.

Lo importante es la fidelidad: cada tramo de locución que dice venir del corpus tiene que estar,
literal, en el campo del que dice venir. Así un cambio futuro del guionista no puede colar texto
que no esté en la biblioteca.
"""

from __future__ import annotations

import re
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from . import text as T
from .corpus import Book
from .frames import _STAGES
from .scriptwriter import Episode

REPO_ROOT = Path(__file__).resolve().parents[2]

# Duración razonable de cada tipo de episodio (segundos estimados).
LIMITES = {"clase": (75, 600), "corto": (40, 115), "presentacion": (25, 300), "repaso": (45, 900)}


@dataclass
class Issue:
    level: str  # "error" | "aviso"
    where: str
    message: str

    def __str__(self) -> str:
        return f"[{self.level}] {self.where}: {self.message}"


# Escenas cuyo contenido es una frase ancla (no una lista ni una pregunta con opciones).
SOLO_ANCLA = ("idea", "puente", "texto", "cierre", "gancho", "libro")
MAX_PALABRAS_EN_PANTALLA = 32


def _sources(book: Book, episode: Episode) -> dict[str, str]:
    """Texto de referencia de cada origen que puede declarar un tramo de locución."""
    src: dict[str, str] = {"libro.descripcion": book.descripcion}
    mapa = book.mapa or {}
    src["mapa.cierre"] = T.clean(mapa.get("cierre"))
    src["mapa.nodos"] = " ".join(f"{T.clean(n.get('etiqueta'))}. {T.clean(n.get('texto'))}." for n in (mapa.get("nodos") or []) if isinstance(n, dict))
    preguntas = [q for lec in book.lessons for q in lec.preguntas] + list(book.loose_questions)
    src["pregunta.texto"] = " ¶ ".join(q.texto for q in preguntas)
    src["pregunta.opcion"] = " ¶ ".join(o for q in preguntas for o in q.opciones)
    src["pregunta.explicacion"] = " ¶ ".join(q.explicacion for q in preguntas)

    def campos(prefijo: str, lec) -> None:
        for campo in ("cuerpo", "idea_clave", "cita_memorable", "autocorreccion", "aplicacion_practica", "conexion_cruzada", "titulo"):
            src[f"{prefijo}.{campo}"] = T.clean(getattr(lec, campo))
        src[f"{prefijo}.autores_relacionados"] = " ¶ ".join(T.clean(a) for a in lec.autores_relacionados)
        src[f"{prefijo}.etiquetas"] = " ¶ ".join(T.clean(a) for a in lec.etiquetas)
        src[f"{prefijo}.detalles"] = " ¶ ".join(f"{T.clean(x.get('titulo'))}. ¶ {T.clean(x.get('cuerpo'))}" for x in getattr(lec, "detalles", []) or [])

    for i, lec in enumerate(book.lessons):
        campos(f"leccion[{i + 1}]", lec)
        if lec.id == episode.lesson_id:
            campos("leccion", lec)
            if i > 0:
                campos("leccion_anterior", book.lessons[i - 1])
            src["esquema.datos"] = " ¶ ".join(_strings([d.get("datos") for d in lec.diagramas if isinstance(d, dict)]))
            src["esquema.pie"] = " ¶ ".join(T.clean(d.get("pie")) for d in lec.diagramas if isinstance(d, dict))
            src["esquema.titulo"] = " ¶ ".join(T.clean(d.get("titulo")) for d in lec.diagramas if isinstance(d, dict))
    return src


def _strings(o) -> list[str]:
    """Todos los textos de un esquema (rótulos), en orden."""
    if isinstance(o, str):
        return [T.clean(o)]
    if isinstance(o, dict):
        return [x for v in o.values() for x in _strings(v)]
    if isinstance(o, list):
        return [x for v in o for x in _strings(v)]
    return []


def _contained(part: str, source: str) -> bool:
    a = " ".join(part.split())
    b = " ".join(source.split())
    return bool(a) and (a in b or a.rstrip(".") in b)


def _desde_inicio_de_frase(part: str, source: str) -> bool:
    """Como `_contained`, pero el trozo tiene que empezar donde empieza una frase (o un rótulo) de la fuente.

    «toda intuición falla» está dentro de «No toda intuición falla», y dice lo contrario: un recorte literal
    solo vale si no se come el arranque de su frase.
    """
    a = " ".join(part.split())
    b = " ".join(source.split())
    for cand in {a, a.rstrip(".")}:
        pos = b.find(cand) if cand else -1
        while pos >= 0:
            previo = b[:pos].rstrip()
            # …o donde acaba una cita entre comillas simples que cierra su frase: «…diciendo 'Ahí estás tú!' La segunda…».
            if not previo or previo[-1] in ".!?…¶:;»”\")—–" or re.search(r"[.!?…]['’]$", previo):
                return True
            pos = b.find(cand, pos + 1)
    return False


def _check_diagrams(specs: list[dict]) -> list[bool] | None:
    """¿Sabe dibujar el motor de la app cada esquema? Usa Node si está; si no, devuelve None (sin comprobar)."""
    node = shutil.which("node")
    if not node or not specs:
        return None
    script = (
        "const D=require(process.argv[1]);let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(s).map(x=>!!D.svg(x))))})"
    )
    try:
        res = subprocess.run(
            [node, "-e", script, str(REPO_ROOT / "lib" / "diagram.js")],
            input=json.dumps(specs),
            capture_output=True,
            text=True,
            timeout=30,
        )
        return list(json.loads(res.stdout)) if res.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def lint_episode(episode: Episode, book: Book) -> list[Issue]:
    issues: list[Issue] = []
    src = _sources(book, episode)

    if not episode.scenes:
        return [Issue("error", episode.key, "el episodio no tiene escenas")]

    specs: list[dict] = []
    donde_spec: list[str] = []
    for i, scene in enumerate(episode.scenes, start=1):
        donde = f"{episode.key} · escena {i} ({scene.kind})"
        if scene.kind not in _STAGES:
            issues.append(Issue("error", donde, "plantilla visual desconocida"))
        if not scene.narration and scene.hold_s <= 0 and scene.pause_after_s <= 0:
            issues.append(Issue("error", donde, "escena sin voz ni duración"))
        for part in scene.parts:
            if not part.text.strip():
                issues.append(Issue("error", donde, "tramo de locución vacío"))
                continue
            if part.origin.startswith("plantilla"):
                continue
            ref = src.get(part.origin)
            if ref is None:
                issues.append(Issue("error", donde, f"origen desconocido: {part.origin}"))
            elif not _contained(part.text, ref):
                issues.append(Issue("error", donde, f"la locución no es literal de «{part.origin}»: {part.text[:70]!r}"))
            for frase in T.split_sentences(part.text):
                if T.n_words(frase) > 70:
                    issues.append(Issue("aviso", donde, f"frase de {T.n_words(frase)} palabras: difícil de seguir de oído"))
        if scene.kind == "pregunta":
            opts = scene.view.get("options") or []
            if len(opts) < 2 or not (0 <= int(scene.view.get("correct", -1)) < len(opts)):
                issues.append(Issue("error", donde, "pregunta sin opciones válidas o sin respuesta correcta"))
        if scene.kind == "esquema":
            specs.append(scene.view.get("spec") or {})
            donde_spec.append(donde)
        if scene.kind == "gancho" and not str(scene.view.get("question") or "").strip():
            issues.append(Issue("error", donde, "gancho sin pregunta"))
        if scene.kind in SOLO_ANCLA and scene.screen_words > MAX_PALABRAS_EN_PANTALLA:
            issues.append(
                Issue("aviso", donde, f"{scene.screen_words} palabras en pantalla (máximo orientativo {MAX_PALABRAS_EN_PANTALLA}): el texto largo debe oírse, no leerse")
            )
        if scene.kind in ("idea", "puente", "texto") and not str(scene.view.get("text") or "").strip():
            issues.append(Issue("error", donde, "no hay texto que mostrar"))
        for beat in scene.beats:
            if beat.at_word is None and beat.at_s is None:
                issues.append(Issue("error", donde, "cambio en pantalla sin momento asignado"))

    dibujables = _check_diagrams(specs)
    if dibujables is not None:
        for ok, donde in zip(dibujables, donde_spec):
            if not ok:
                issues.append(Issue("error", donde, "el motor de esquemas no sabe dibujar esta figura"))

    clave = episode.format if episode.kind == "leccion" else episode.kind
    minimo, maximo = LIMITES.get(clave, (0, 10**6))
    est = episode.estimated_seconds
    if est < minimo:
        issues.append(Issue("aviso", episode.key, f"dura ~{est:.0f} s: corto para un episodio «{clave}» (mínimo orientativo {minimo} s)"))
    if est > maximo:
        issues.append(Issue("aviso", episode.key, f"dura ~{est:.0f} s: largo para un episodio «{clave}» (máximo orientativo {maximo} s)"))
    if episode.kind == "leccion" and "Esquema" not in episode.sections:
        issues.append(Issue("aviso", episode.key, "la lección no tiene esquema en datos/diagramas.json: el vídeo va sin figura"))
    return issues


def has_errors(issues: list[Issue]) -> bool:
    return any(i.level == "error" for i in issues)


# ───────────────────────── piezas compartibles ─────────────────────────

def _formulas_permitidas(pieza, book: Book) -> set[str]:
    """Las únicas frases que una pieza puede decir sin que estén en el corpus: `compartir.FORMULAS` con los datos del libro."""
    from . import compartir as K

    titulos = {""}
    for lec in book.lessons:
        if lec.id == pieza.lesson_id:
            titulos |= {T.clean(d.get("titulo")).rstrip(".") for d in lec.diagramas if isinstance(d, dict)}
    nodos = len([n for n in ((book.mapa or {}).get("nodos") or []) if isinstance(n, dict) and T.clean(n.get("etiqueta"))])
    permitidas: set[str] = set()
    for plantilla in K.FORMULAS.values():
        for titulo in titulos:
            permitidas.add(plantilla.format(libro=K.titulo_corto(book.titulo), autor=book.autor, n=nodos, titulo=titulo))
    return permitidas


# Claves de las vistas que no llevan contenido (estructura, estilos, rótulos fijos que se comprueban aparte).
_CLAVES_SIN_TEXTO = {"spec", "style", "mode", "patron", "icon", "tone", "words", "pos", "order", "foto"}  # «foto» se comprueba aparte
_CLAVES_ROTULO = {"kicker", "brand", "lema", "cta", "recuerda_rotulo", "tag"}


def _textos_de_vista(view: dict) -> list[tuple[str, str]]:
    """(clave, texto) de todo lo que una vista pone en pantalla como contenido."""
    out: list[tuple[str, str]] = []

    def walk(clave: str, o) -> None:
        if isinstance(o, str):
            if o.strip():
                out.append((clave, o))
        elif isinstance(o, dict):
            for k, v in o.items():
                if k not in _CLAVES_SIN_TEXTO:
                    walk(k, v)
        elif isinstance(o, list):
            for v in o:
                walk(clave, v)

    walk("", view)
    return out


def _literal_en_alguna(texto: str, fuentes: list[str]) -> bool:
    t = " ".join(texto.split()).strip()
    candidatos = {t, t.rstrip(".:"), t.rstrip("…").rstrip(), t.rstrip("…").rstrip(" .:")}  # el «…» final es el del recorte; los de dentro son del texto
    return not t or any(_desde_inicio_de_frase(c, f) for c in candidatos if c for f in fuentes)


def _lint_lo_que_solo_se_ve(pieza, book: Book, src: dict[str, str]) -> list[Issue]:
    """Lo que se ve y no se dice (tarjetas, marco de la figura, tema, crédito, miniatura, textos de publicación)
    también tiene que ser literal del corpus o un rótulo declarado: que hoy lo sea por construcción no basta."""
    from . import compartir as K

    issues: list[Issue] = []
    nodos = sum(1 for s in pieza.scenes if s.kind == "c-nodo")
    rotulos = {r.format(n=nodos) for r in K.ROTULOS.values()} | set(K.FORMULAS.values())
    fuentes = [f for f in src.values() if f] + [book.titulo, book.autor, book.eje, K.titulo_corto(book.titulo)]
    vistas = [(f"{pieza.key} · escena {i} ({s.kind})", s.view) for i, s in enumerate(pieza.scenes, start=1)]
    vistas.append((f"{pieza.key} · miniatura", pieza.portada))
    for donde, view in vistas:
        for clave, texto in _textos_de_vista(view):
            if clave in _CLAVES_ROTULO or clave == "said":
                if texto not in rotulos:
                    issues.append(Issue("error", donde, f"rótulo no declarado en compartir.ROTULOS ({clave}): {texto[:60]!r}"))
            elif not _literal_en_alguna(texto, fuentes):
                issues.append(Issue("error", donde, f"texto en pantalla que no es literal del corpus ({clave}): {texto[:60]!r}"))

    def sin_prefijo(t: str) -> str:
        return next((t[len(pre):] for pre in K.PREFIJOS_PUB if t.startswith(pre)), t)

    en_ideas = f"{K.titulo_corto(book.titulo)} en {nodos} ideas"
    if not en_ideas.startswith(pieza.titulo_pub.rstrip("…")) and not _literal_en_alguna(sin_prefijo(pieza.titulo_pub), fuentes):
        issues.append(Issue("error", pieza.key, f"título de publicación que no es literal: {pieza.titulo_pub[:60]!r}"))
    for parrafo in [x for x in pieza.descripcion_pub.split("\n\n") if x.strip()]:
        if parrafo.startswith("Del libro «") or parrafo.startswith(K.ROTULOS["marca"]):
            continue
        trozos = sin_prefijo(parrafo).split(" · ") if pieza.tipo in ("libro", "recorrido") else [sin_prefijo(parrafo)]
        if not all(_literal_en_alguna(t, fuentes) for t in trozos):
            issues.append(Issue("error", pieza.key, f"descripción de publicación que no es literal: {parrafo[:60]!r}"))
    return issues


def lint_pieza(pieza, book: Book) -> list[Issue]:
    """Control de una pieza compartible: fidelidad literal, fórmulas declaradas, nada que ancle a la web y texto breve."""
    from . import compartir as K
    from . import compartir_frames as CF

    issues: list[Issue] = []
    if not pieza.scenes:
        return [Issue("error", pieza.key, "la pieza no tiene escenas")]
    src = _sources(book, pieza)
    permitidas = _formulas_permitidas(pieza, book)
    specs: list[dict] = []
    donde_spec: list[str] = []
    con_figura = False
    leccion = next((l for l in book.lessons if l.id == pieza.lesson_id), None) if pieza.lesson_id else None
    parrafos_cuerpo = set(T.paragraphs(leccion.cuerpo)) if leccion else set()
    for i, scene in enumerate(pieza.scenes, start=1):
        donde = f"{pieza.key} · escena {i} ({scene.kind})"
        if scene.kind not in CF.STAGES:
            issues.append(Issue("error", donde, "plantilla visual desconocida"))
            continue
        if not scene.narration and scene.hold_s <= 0:
            issues.append(Issue("error", donde, "escena sin voz ni duración"))
        for part in scene.parts:
            if not part.text.strip():
                issues.append(Issue("error", donde, "tramo de locución vacío"))
                continue
            if part.origin.startswith("plantilla"):
                if part.text not in permitidas:
                    issues.append(Issue("error", donde, f"fórmula no declarada en compartir.FORMULAS: {part.text[:70]!r}"))
                elif K.ANCLA_WEB.search(part.text):
                    # La fórmula es de las declaradas: lo que alude a «la lección» es el título del esquema que lleva dentro.
                    issues.append(Issue("aviso", donde, f"el texto del corpus alude a la lección o a la web: {part.text[:60]!r}"))
                continue
            ref = src.get(part.origin)
            if ref is None:
                issues.append(Issue("error", donde, f"origen desconocido: {part.origin}"))
            elif not _contained(part.text, ref):
                issues.append(Issue("error", donde, f"la locución no es literal de «{part.origin}»: {part.text[:70]!r}"))
            elif not _desde_inicio_de_frase(part.text, ref) and T.clean(part.text) not in parrafos_cuerpo:  # un párrafo entero empieza donde debe aunque el anterior acabe sin punto
                issues.append(Issue("error", donde, f"la locución empieza a media frase de «{part.origin}»: {part.text[:70]!r}"))
            if K.ANCLA_WEB.search(part.text):
                issues.append(Issue("aviso", donde, f"el texto del corpus alude a la lección o a la web: {part.text[:60]!r}"))
            if K.parece_ingles(part.text):
                issues.append(Issue("aviso", donde, f"tramo que parece estar en otro idioma: {part.text[:60]!r}"))
            for frase in T.split_sentences(part.text):
                if T.n_words(frase) > 60:
                    issues.append(Issue("aviso", donde, f"frase de {T.n_words(frase)} palabras: difícil de seguir en una pieza corta"))
        # Todo lo que se oye se ve: en el texto cinético, las palabras en pantalla son las de la locución.
        if scene.kind == "c-frase":
            dichas = scene.narration.split()
            vistas = scene.view.get("words") or []
            if vistas != dichas[len(dichas) - len(vistas):] or not vistas:
                issues.append(Issue("error", donde, "el texto en pantalla no coincide con la locución"))
        for vista in CF.estados(scene) if scene.kind != "c-cierre" else []:  # el cierre repite, entero, lo que ya se ha oído
            n = CF.palabras_en_pantalla(scene.kind, vista)
            if n > MAX_PALABRAS_EN_PANTALLA:
                issues.append(Issue("aviso", donde, f"{n} palabras en pantalla a la vez (máximo orientativo {MAX_PALABRAS_EN_PANTALLA})"))
                break
        if scene.kind == "c-figura" and scene.view.get("patron") == "silueta":
            specs.append(scene.view.get("spec") or {})
            donde_spec.append(donde)
        if scene.kind == "c-figura":
            con_figura = True
        # Lo que el cierre deja escrito para llevarse es un arranque literal de algo que la pieza ya dijo.
        recuerda = str(scene.view.get("recuerda") or "").rstrip("…").strip() if scene.kind == "c-cierre" else ""
        if recuerda and not any(_desde_inicio_de_frase(recuerda, ref) for ref in src.values() if ref):
            issues.append(Issue("error", donde, f"el mensaje de cierre no es literal del corpus: {recuerda[:60]!r}"))
        if recuerda and str(scene.view.get("recuerda") or "").endswith("…"):
            issues.append(Issue("aviso", donde, "el mensaje de cierre va recortado («…»): comprueba que no pierde su salvedad"))
        for beat in scene.beats:
            if beat.at_word is None and beat.at_s is None:
                issues.append(Issue("error", donde, "cambio en pantalla sin momento asignado"))

    issues.extend(_lint_lo_que_solo_se_ve(pieza, book, src))
    # Una imagen solo puede salir si está en el catálogo (aprobada, con licencia aceptada) y con su crédito exacto.
    fichas = {str(e.get("archivo")): e for e in K.IM.catalogo().values()}
    for i, scene in enumerate(pieza.scenes, start=1):
        foto = scene.view.get("foto")
        if foto is None:
            continue
        e = fichas.get(str(foto.get("src"))) if isinstance(foto, dict) else None
        if not e or foto.get("credito") != K.IM.credito(e) or not K.IM.licencia_aceptada(str(e.get("licencia"))):
            issues.append(Issue("error", f"{pieza.key} · escena {i} ({scene.kind})", "imagen que no está aprobada en tools/video/imagenes/ o con el crédito cambiado"))
    if pieza.tipo == "pregunta":
        # La respuesta que se da tiene que ser la opción correcta de ESA pregunta, no cualquier opción del libro.
        lec = next((l for l in book.lessons if l.id == pieza.lesson_id), None)
        q = next((x for x in (lec.preguntas if lec else []) if x.texto == pieza.gancho and x.valid), None)
        dichas = [p.text for s in pieza.scenes for p in s.parts if p.origin == "pregunta.opcion"]
        if not q or len(dichas) != 1 or dichas[0].rstrip(".") != T.clean(q.opciones[q.correcta]).rstrip("."):
            issues.append(Issue("error", pieza.key, "la respuesta que se da no es la opción correcta de la pregunta que se hace"))
        elif K.PREGUNTA_INVERSA.search(q.texto):
            issues.append(Issue("error", pieza.key, "pregunta en negativo o que depende de la lista de opciones: su «respuesta» suelta desinforma"))
    else:
        # En cualquier otra pieza, una opción de test solo puede decirse como respuesta a su pregunta, hecha en la
        # misma pieza, y tiene que ser la correcta.
        lec = next((l for l in book.lessons if l.id == pieza.lesson_id), None)
        # Una pieza larga puede hacer más de una pregunta: cada una, seguida de su respuesta, y ninguna dos veces.
        turnos = [(p.origin, p.text) for s in pieza.scenes for p in s.parts if p.origin in ("pregunta.texto", "pregunta.opcion")]
        validas = [x for x in (lec.preguntas if lec else []) if x.valid]
        bien = len(turnos) % 2 == 0 and len({t for o, t in turnos if o == "pregunta.texto"}) == len(turnos) // 2
        for (o1, hecha), (o2, dicha) in zip(turnos[0::2], turnos[1::2]):
            # (Una lección puede traer la misma pregunta dos veces: vale la respuesta correcta de cualquiera de las dos.)
            qs = [x for x in validas if x.texto == hecha]
            bien = bien and o1 == "pregunta.texto" and o2 == "pregunta.opcion" and any(dicha.rstrip(".") == T.clean(q.opciones[q.correcta]).rstrip(".") for q in qs)
        if turnos and not bien:
            issues.append(Issue("error", pieza.key, "la respuesta que se da no es la opción correcta de la pregunta que se hace"))
        elif any(K.PREGUNTA_INVERSA.search(t) for o, t in turnos if o == "pregunta.texto"):
            issues.append(Issue("error", pieza.key, "pregunta en negativo o que depende de la lista de opciones: su «respuesta» suelta desinforma"))
    for rotulo in [*K.ROTULOS.values(), *K.FORMULAS.values()]:
        if K.ANCLA_WEB.search(rotulo):
            issues.append(Issue("error", pieza.key, f"rótulo o fórmula que ancla a la web: {rotulo!r}"))
    # Toda pieza de una lección lleva su matiz (si la lección lo tiene) y todas dicen de qué libro salen.
    if not any(s.kind == "c-credito" for s in pieza.scenes):
        issues.append(Issue("error", pieza.key, "la pieza no dice de qué libro sale"))
    if pieza.lesson_id:
        lec = next((l for l in book.lessons if l.id == pieza.lesson_id), None)
        if lec and T.clean(lec.autocorreccion) and not any(p.origin == "leccion.autocorreccion" for s in pieza.scenes for p in s.parts):
            issues.append(Issue("error", pieza.key, "la lección tiene matiz y la pieza no lo lleva"))
        # La explicación es el cuerpo desde su principio, por párrafos enteros y sin saltos: una frase sacada de en
        # medio puede quedarse sin la salvedad que la sigue. Lo único que entra suelto es una salvedad de seguridad.
        if lec:
            parrafos = T.paragraphs(lec.cuerpo)
            j = 0
            dicho = " ".join(x.narration for x in pieza.scenes if x.kind == "c-frase" and x.section != "Explicación")
            if parrafos and all(f in dicho for f in T.split_sentences(parrafos[0])):
                j = 1  # la pieza abrió con el primer párrafo entero
            for s in pieza.scenes:
                if s.section != "Explicación":
                    continue
                for part in s.parts:
                    t = T.clean(part.text)
                    if j < len(parrafos) and parrafos[j] == t:
                        j += 1
                    elif j == 0 and parrafos and parrafos[0].endswith(t) and all(f in dicho for f in T.split_sentences(parrafos[0][: -len(t)])):
                        j = 1  # el arranque del primer párrafo ya lo dijo la pieza al abrir
                    elif K.SALVEDAD.search(t) and any(t in q for q in parrafos[j:]):
                        continue
                    else:
                        issues.append(Issue("error", pieza.key, f"la explicación no sigue el cuerpo por párrafos enteros desde el principio: {t[:60]!r}"))
                        break
        if pieza.tipo == "idea" and not con_figura:
            issues.append(Issue("aviso", pieza.key, "la figura de la lección no se puede recorrer por piezas: la pieza va sin esquema"))
    if not T.clean(pieza.gancho):
        issues.append(Issue("error", pieza.key, "pieza sin gancho"))

    dibujables = _check_diagrams(specs[:1])
    if dibujables is not None and specs and not dibujables[0]:
        issues.append(Issue("error", donde_spec[0], "el motor de esquemas no sabe dibujar esta figura"))

    minimo, maximo = K.LIMITES.get(pieza.tipo, (0, 10**6))
    est = pieza.estimated_seconds
    if est < minimo:
        issues.append(Issue("aviso", pieza.key, f"dura ~{est:.0f} s: corta para una pieza «{pieza.tipo}» (mínimo orientativo {minimo} s)"))
    if est > maximo:
        issues.append(Issue("aviso", pieza.key, f"dura ~{est:.0f} s: larga para una pieza «{pieza.tipo}» (máximo orientativo {maximo} s)"))
    return issues
