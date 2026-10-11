/**
 * Didáctica — lógica pura para organizar el aprendizaje:
 * tiempo de lectura, avance de cada lección, libros relacionados,
 * pregunta de comprobación pertinente y rutas de aprendizaje.
 *
 * UMD: window.Didactica en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Didactica = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = s => String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const STOP = new Set(('para como pero este esta estos estas sobre entre desde hasta cuando donde porque tambien aunque '
    + 'cada solo mismo misma otros otras ellos ellas tiene tienen puede pueden hace hacen debe deben segun mucho muchos '
    + 'with that this from have which their there about into more than other because').split(' '));

  function tokens(s) {
    return norm(s).split(/[^a-z0-9ñ]+/).filter(t => t.length >= 5 && !STOP.has(t));
  }

  /** Minutos de lectura (≈190 palabras/min en pantalla), mínimo 1. */
  function minutosLectura(lec) {
    if (!lec) return 1;
    const det = Array.isArray(lec.detalles) ? lec.detalles.map(d => (d && (d.cuerpo || d.contenido)) || '').join(' ') : '';
    const txt = [lec.cuerpo, det, lec.aplicacion_practica, lec.conexion_cruzada, lec.autocorreccion].filter(Boolean).join(' ');
    const palabras = txt.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(palabras / 190));
  }

  /** Texto breve que adelanta la lección: idea clave o primera frase del cuerpo. */
  function avance(lec, max) {
    max = max || 130;
    if (!lec) return '';
    const plano = s => String(s || '').replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();
    const ya = plano(lec.idea_clave);
    if (ya) return ya;
    const cuerpo = plano(lec.cuerpo);
    if (!cuerpo) return '';
    const m = cuerpo.match(/^.+?[.!?](?=\s|$)/);
    const frase = m ? m[0] : cuerpo;
    if (frase.length <= max) return frase;
    const corte = frase.slice(0, max);
    const sp = corte.lastIndexOf(' ');
    return corte.slice(0, sp > max * 0.6 ? sp : max).replace(/[\s,;:—–-]+$/, '') + '…';
  }

  /** Libros para seguir leyendo: mismo tema y autores que aparecen cruzados en sus lecciones. */
  function relacionados(libro, libros, lecs, n) {
    if (!libro) return [];
    n = n || 3;
    const mios = lecs.filter(l => l.libro_id === libro.id);
    const nombres = new Set();
    mios.forEach(l => (l.autores_relacionados || []).forEach(a => {
      const ap = norm(a).split(/\s+/).filter(Boolean).pop();
      if (ap && ap.length >= 4) nombres.add(ap);
    }));
    const conLecs = new Set(lecs.map(l => l.libro_id));
    return libros
      .filter(b => b.id !== libro.id && conLecs.has(b.id))
      .map(b => {
        let s = 0;
        if (b.sub_eje && b.sub_eje === libro.sub_eje) s += 2;
        if (b.eje_principal && b.eje_principal === libro.eje_principal) s += 1;
        const au = norm(b.autor);
        nombres.forEach(ap => { if (au.includes(ap)) s += 3; });
        if (norm(b.autor) === norm(libro.autor)) s += 4;
        return { b, s };
      })
      .filter(x => x.s >= 3)
      .sort((p, q) => q.s - p.s || String(p.b.titulo).localeCompare(String(q.b.titulo)))
      .slice(0, n)
      .map(x => x.b);
  }

  /**
   * Preguntas para comprobar una lección. Primero las asignadas a ella (`leccion_id`, ver
   * supabase/migrations/20261013); después, por parecido con su texto, las del mismo libro que no
   * estén asignadas a otra lección.
   */
  function preguntasParaLeccion(lec, pregs, n) {
    if (!lec) return [];
    n = n || 1;
    const validas = p => Array.isArray(p.opciones) && p.opciones.length >= 2;
    const delLibro = pregs.filter(p => p.libro_id === lec.libro_id && validas(p));
    if (!delLibro.length) return [];
    const propias = delLibro.filter(p => lec.id && p.leccion_id === lec.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (propias.length >= n) return propias.slice(0, n);
    const tit = new Set(tokens(lec.titulo));
    const cuerpo = new Set(tokens([lec.cuerpo, lec.idea_clave, lec.autocorreccion].join(' ')));
    const parecidas = delLibro
      .filter(p => !p.leccion_id)
      .map(p => {
        let s = 0;
        const toks = new Set(tokens([p.texto, p.explicacion].join(' ')));
        toks.forEach(t => { if (tit.has(t)) s += 3; else if (cuerpo.has(t)) s += 1; });
        return { p, s };
      })
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || String(a.p.id).localeCompare(String(b.p.id)))
      .map(x => x.p);
    return propias.concat(parecidas).slice(0, n);
  }

  function progresoLibro(libro, lecs, completadas) {
    const ls = lecs.filter(l => l.libro_id === libro.id);
    const hechas = ls.filter(l => completadas.has(l.id)).length;
    return { total: ls.length, hechas, pct: ls.length ? Math.round((hechas / ls.length) * 100) : 0 };
  }

  /** Siguiente lección a leer: la primera no completada por orden (o la última si todo está hecho). */
  function siguienteLeccion(libro, lecs, completadas) {
    const ls = lecs.filter(l => l.libro_id === libro.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if (!ls.length) return null;
    return ls.find(l => !completadas.has(l.id)) || null;
  }

  /* ═══════════════ RUTAS DE APRENDIZAJE ═══════════════
     Secuencias de tomos en orden pedagógico. `m` es un fragmento del título
     (sin acentos, en minúsculas; con '=' delante, título exacto); si el libro no está publicado se omite. */
  const RUTAS = [
    {
      id: 'pensar', tono: 'info', icono: 'brain',
      titulo: 'Pensar con claridad',
      sub: 'De los errores de razonamiento al juicio calibrado.',
      descripcion: 'Empieza viendo cómo se equivoca la mente, aprende a decidir con probabilidades y termina entendiendo qué no se puede predecir.',
      libros: [
        { m: 'el arte de pensar', por: 'Un catálogo de errores de razonamiento: aprende a reconocerlos en el día a día.' },
        { m: 'thinking, fast and slow', por: 'La teoría de fondo: dos sistemas de pensamiento y por qué el rápido falla.' },
        { m: 'thinking in bets', por: 'Del sesgo a la práctica: decidir bien aunque el resultado sea incierto.' },
        { m: 'scout mindset', por: 'La actitud que lo sostiene todo: buscar lo cierto, no defender lo que ya creías.' },
        { m: 'superforecasting', por: 'Cómo se entrena y se mide un juicio calibrado, con datos reales.' },
        { m: 'el cisne negro', por: 'El límite: lo que ningún modelo anticipa, y cómo vivir con ello.' }
      ]
    },
    {
      id: 'riesgo', tono: 'a', icono: 'dado',
      titulo: 'Decidir con riesgo',
      sub: 'Suerte, ruido, incentivos y ganar con el desorden.',
      descripcion: 'Distinguir suerte de habilidad, medir el ruido en los juicios y diseñar posiciones que sobrevivan —o ganen— cuando las cosas salen mal.',
      libros: [
        { m: 'fooled by randomness', por: 'Primero: suerte y habilidad se confunden con más frecuencia de la que crees.' },
        { m: 'a flaw in human judgment', por: 'El otro error: no solo sesgo, también variabilidad injustificada en los juicios.' },
        { m: 'skin in the game', por: 'Por qué los incentivos y el riesgo propio filtran a quien decide bien.' },
        { m: 'antifragil', por: 'Pasar de resistir el desorden a beneficiarse de él.' },
        { m: 'poor charlie', por: 'Una caja de herramientas mental y las 25 tendencias que nos hacen errar.' }
      ]
    },
    {
      id: 'dinero', tono: 'a', icono: 'grafico',
      titulo: 'Dinero y mercados',
      sub: 'Conducta, valor, tendencias y ciclos.',
      descripcion: 'Del comportamiento frente al dinero al análisis de valor, la lectura de tendencias y la teoría de los ciclos económicos.',
      libros: [
        { m: 'psychology of money', por: 'Empieza por la conducta: el dinero se gana más con carácter que con fórmulas.' },
        { m: 'intelligent investor', por: 'El método de valor: margen de seguridad y el Sr. Mercado.' },
        { m: 'el arte de reflexionar sobre el dinero', por: 'Psicología de mercado vista por un veterano de la bolsa europea.' },
        { m: 'secretos para ganar en mercados', por: 'Leer la tendencia con los cuatro estadios de Weinstein.' },
        { m: 'trade like a stock market wizard', por: 'Un sistema operativo concreto, con reglas de entrada y salida.' },
        { m: 'alquimia de las finanzas', por: 'Reflexividad: cuando los precios cambian la realidad que miden.' },
        { m: 'dinero, credito bancario', por: 'La teoría austriaca del ciclo: por qué llegan los auges y las crisis.' }
      ]
    },
    {
      id: 'cuerpo', tono: 'ok', icono: 'cerebro',
      titulo: 'Cuerpo y cerebro',
      sub: 'Sueño, dopamina, trauma y los dos hemisferios.',
      descripcion: 'La base biológica de cómo sentimos, decidimos y nos recuperamos: del descanso a la neurobiología de la conducta.',
      libros: [
        { m: 'why we sleep', por: 'La base de todo: el sueño y lo que se rompe sin él.' },
        { m: 'outlive', por: 'Longevidad: ejercicio, nutrición y prevención con criterio.' },
        { m: 'dopamine nation', por: 'Placer, dolor y por qué el exceso de estímulo nos desequilibra.' },
        { m: 'the body keeps the score', por: 'Trauma y cuerpo: lo que la mente no procesa lo guarda el organismo.' },
        { m: 'comportate', por: 'La síntesis: la conducta como suma de biología, entorno e historia.' },
        { m: 'master and his emissary', por: 'El cierre: dos modos de atención y qué hace cada hemisferio con el mundo.' }
      ]
    },
    {
      id: 'influencia', tono: 'psi', icono: 'red',
      titulo: 'Influencia y poder',
      sub: 'Persuadir, negociar… y no ser manipulado.',
      descripcion: 'Desde lo básico de las relaciones hasta los mecanismos de influencia, negociación y obediencia a la autoridad.',
      libros: [
        { m: 'como ganar amigos', por: 'La base: interés genuino por el otro.' },
        { m: '=influencia', por: 'Los seis principios de la influencia y cómo detectarlos.' },
        { m: 'pre-suasion', por: 'Lo que ocurre antes del mensaje: el momento que predispone.' },
        { m: 'never split the difference', por: 'Negociar con empatía táctica, según un negociador del FBI.' },
        { m: 'leyes de la naturaleza humana', por: 'La mirada oscura y lúcida sobre motivaciones ocultas.' },
        { m: 'obedience to authority', por: 'El experimento que muestra hasta dónde llega la obediencia.' }
      ]
    },
    {
      id: 'sentido', tono: 'psi', icono: 'hoja',
      titulo: 'Estoicismo y sentido',
      sub: 'Serenidad, propósito y vida plena.',
      descripcion: 'Una conversación de dos mil años: la práctica estoica, el sentido en la adversidad y la experiencia del presente.',
      libros: [
        { m: 'meditaciones', por: 'El texto fundacional: un emperador hablándose a sí mismo.' },
        { m: 'letters from a stoic', por: 'Cartas prácticas: tiempo, miedo, muerte y amistad.', alt: 'cartas a lucilio' },
        { m: 'guide to the good life', por: 'El estoicismo traducido a ejercicios para hoy.' },
        { m: 'search for meaning', por: 'El sentido en el límite: lo que Frankl aprendió en los campos.', alt: 'busca de sentido' },
        { m: 'power of now', por: 'Atención al presente como práctica.' },
        { m: 'fluir', por: 'Cuando la atención está plena: la experiencia óptima.' }
      ]
    },
    {
      id: 'instituciones', tono: 'info', icono: 'columnas',
      titulo: 'Instituciones y civilización',
      sub: 'Por qué prosperan, se estancan y caen las sociedades.',
      descripcion: 'Reglas, incentivos y cultura: cómo se explican el crecimiento, el declive y los grandes ciclos históricos.',
      libros: [
        { m: 'institutions, institutional change', por: 'El marco: las instituciones como reglas de juego.' },
        { m: 'rise and decline of nations', por: 'Por qué los grupos de interés frenan a las sociedades maduras.' },
        { m: 'governing the commons', por: 'Cómo se gestiona lo común sin Estado ni mercado puro.' },
        { m: 'weirdest people', por: 'Cultura y psicología detrás de las sociedades modernas.' },
        { m: '=the fourth turning', por: 'La teoría cíclica de las generaciones.' },
        { m: 'seeing like a state', por: 'Cuando la planificación legible destruye el conocimiento local.' },
        { m: 'camino de servidumbre', por: 'Hayek: planificación central y libertad.', alt: 'road to serfdom' }
      ]
    },
    {
      id: 'emociones', tono: 'psi', icono: 'brain',
      titulo: 'Emociones y atención',
      sub: 'Entender lo que sientes y proteger tu atención.',
      descripcion: 'De cómo se construye una emoción a cómo se recupera la atención: pensamiento, aceptación, estímulo y concentración.',
      libros: [
        { m: 'feeling good', por: 'Terapia cognitiva aplicada: detectar los pensamientos distorsionados que alimentan el ánimo bajo.' },
        { m: 'how emotions are made', por: 'La teoría de la emoción construida: el cerebro predice y categoriza lo que sientes.' },
        { m: 'get out of your mind', por: 'Aceptación y compromiso: actuar según tus valores sin pelear con cada pensamiento.' },
        { m: 'dopamine nation', por: 'Placer y dolor se compensan: por qué el exceso de estímulo desgasta.' },
        { m: 'digital minimalism', por: 'Recuperar la atención decidiendo qué tecnología entra en tu vida.' },
        { m: 'deep work', por: 'Trabajo concentrado: proteger la atención como un recurso escaso.' }
      ]
    },
    {
      id: 'economia', tono: 'a', icono: 'columnas',
      titulo: 'Economía básica',
      sub: 'Escasez, precios, incentivos y propiedad.',
      descripcion: 'Las ideas de base para pensar económicamente: cómo coordinan los precios, qué incentivos crean la propiedad y la empresa, y qué tipo de racionalidad usamos.',
      libros: [
        { m: 'basic economics', por: 'Escasez, precios e incentivos explicados sin fórmulas.' },
        { m: 'wealth of nations', por: 'La fuente clásica: división del trabajo y mercados.' },
        { m: 'production, information costs', por: 'Por qué existen las empresas: coordinación, información y supervisión del trabajo en equipo.' },
        { m: 'economic analysis of property rights', por: 'Cómo los derechos de propiedad moldean los incentivos y los costes de intercambiar.' },
        { m: 'rationality in economics', por: 'Dos racionalidades, la construida y la ecológica, y la evidencia experimental que las separa.' }
      ]
    },
    {
      id: 'estrategia', tono: 'mal', icono: 'tablero',
      titulo: 'Estrategia y conflicto',
      sub: 'Ganar sin pelear, cooperar sin ingenuidad.',
      descripcion: 'De la estrategia clásica a la teoría de juegos: cuándo conviene el conflicto, la amenaza creíble o la cooperación.',
      libros: [
        { m: 'arte de la guerra', por: 'El clásico: ganar antes de librar la batalla.', alt: 'art of war' },
        { m: 'strategy of conflict', por: 'Compromiso, amenazas creíbles y puntos focales.' },
        { m: 'evolution of cooperation', por: 'Cuándo y por qué emerge la cooperación entre egoístas.' },
        { m: '48 leyes del poder', por: 'El catálogo cínico de maniobras de poder.' },
        { m: 'never split the difference', por: 'Llevar todo a la mesa de negociación.' }
      ]
    }
  ];

  /** Resuelve una ruta contra los libros publicados; omite los que no existan. */
  function resolverRuta(ruta, libros) {
    const usados = new Set();
    const items = [];
    ruta.libros.forEach(it => {
      const claves = [it.m, it.alt].filter(Boolean).map(norm);
      const libro = libros.find(b => {
        if (usados.has(b.id)) return false;
        const t = norm(b.titulo);
        return claves.some(c => (c[0] === '=' ? t === c.slice(1) : t.includes(c)));
      });
      if (libro) { usados.add(libro.id); items.push({ libro, por: it.por }); }
    });
    return items;
  }

  /** Rutas con al menos 3 libros disponibles, con su progreso agregado. */
  function rutasDisponibles(libros, lecs, completadas) {
    return RUTAS.map(r => {
      const items = resolverRuta(r, libros);
      let total = 0, hechas = 0;
      items.forEach(i => { const p = progresoLibro(i.libro, lecs, completadas); total += p.total; hechas += p.hechas; i.prog = p; });
      return { ...r, items, total, hechas, pct: total ? Math.round((hechas / total) * 100) : 0 };
    }).filter(r => r.items.length >= 3);
  }

  /**
   * Mapa de dominios: por eje principal y sub-eje, cuánto has leído y cuánto está asentado.
   * `asentadas`: Set de ids de lección con su tarjeta de reflexión en nivel firme.
   */
  function dominios(libros, lecs, completadas, asentadas) {
    asentadas = asentadas || new Set();
    const porLibro = new Map();
    lecs.forEach(l => {
      const r = porLibro.get(l.libro_id) || { total: 0, hechas: 0, asentadas: 0 };
      r.total++;
      if (completadas.has(l.id)) r.hechas++;
      if (asentadas.has(l.id)) r.asentadas++;
      porLibro.set(l.libro_id, r);
    });
    const ejes = new Map();
    libros.forEach(b => {
      const t = porLibro.get(b.id);
      if (!t) return;
      const eje = b.eje_principal || b.eje || 'Otros';
      const sub = b.sub_eje || b.eje || eje;
      const e = ejes.get(eje) || { eje, total: 0, hechas: 0, asentadas: 0, subs: new Map() };
      const s = e.subs.get(sub) || { sub, libros: 0, total: 0, hechas: 0, asentadas: 0 };
      s.libros++; s.total += t.total; s.hechas += t.hechas; s.asentadas += t.asentadas;
      e.total += t.total; e.hechas += t.hechas; e.asentadas += t.asentadas;
      e.subs.set(sub, s); ejes.set(eje, e);
    });
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    return [...ejes.values()]
      .map(e => ({
        eje: e.eje, total: e.total, hechas: e.hechas, asentadas: e.asentadas, pct: pct(e.hechas, e.total),
        subs: [...e.subs.values()]
          .map(s => Object.assign(s, { pct: pct(s.hechas, s.total) }))
          .sort((x, y) => y.hechas - x.hechas || y.total - x.total || x.sub.localeCompare(y.sub))
      }))
      .sort((x, y) => y.hechas - x.hechas || y.total - x.total || x.eje.localeCompare(y.eje));
  }

  return {
    norm, tokens, dominios, minutosLectura, avance, relacionados, preguntasParaLeccion,
    progresoLibro, siguienteLeccion, resolverRuta, rutasDisponibles, RUTAS
  };
});
