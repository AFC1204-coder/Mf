/**
 * Consulta por necesidad: el usuario escribe una duda o una carencia («me cuesta concentrarme»,
 * «quiero negociar mejor mi sueldo») y la app propone los libros que mejor la abordan, con la lección
 * por la que empezar y por qué encaja.
 *
 * No usa ningún modelo de lenguaje ni red: es recuperación de texto sobre el corpus que ya está en el
 * dispositivo (BM25 sobre lecciones, con pesos por campo) más un léxico de necesidades en español que
 * traduce el lenguaje de la vida diaria («procrastino») al vocabulario del corpus («hábitos», «motivación»).
 * Por eso dice siempre en qué se basa y cuándo no está seguro. Lógica pura: se prueba en tests/consulta.test.js.
 *
 * UMD: window.Consulta en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Consulta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────────── Normalización ───────────── */

  const PARADAS = new Set(('a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bastante bien cada casi como con contra cual cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estan estar este esto estos estoy fue fueron ha habia han hace hacer hago hasta hay incluso la las le les lo los mas me mi mis mucho muchos muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien quienes quiero quisiera se sea ser si sin sobre solo son soy su sus tambien tan tanto te tengo tiene tienen tienes todo todos tu tus un una uno unos usted va vamos van ver voy vuestro y ya yo '
    + 'necesito necesitaria busco buscando quiero querria puedo podria gustaria cosas cosa forma manera algo ayuda ayudar libro libros leer lectura recomienda recomendar recomendacion sugiere dime dame cual cuales mejor mejores '
    + 'cuesta cuestan acabo acabar siento creo pienso consigo conseguir mantener buenos buenas bueno buena importante importantes rato vez veces dia dias siempre nunca mucha muchas tipo hacia ahora quiza puede pueden deberia sirve sirven saber sabes sabe tomo tomar hago hacemos tengo').split(' '));

  const quitaTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normalizar = s => quitaTildes(s).toLowerCase();

  /** Raíz ligera en español (suficiente para casar «concentrarme», «concentración», «concentrarse»). */
  const SUFIJOS = ['amientos', 'imientos', 'amiento', 'imiento', 'aciones', 'uciones', 'adoras', 'adores', 'idades', 'acion', 'ucion', 'adora', 'ador', 'idad',
    'ismos', 'ismo', 'istas', 'ista', 'mente', 'ables', 'able', 'ibles', 'ible', 'ando', 'iendo', 'antes', 'ante', 'ados', 'adas', 'ado', 'ada', 'idos', 'idas', 'ido', 'ida',
    'aron', 'ieron', 'aban', 'aria', 'arse', 'erse', 'irse', 'ar', 'er', 'ir', 'os', 'as', 'es', 'a', 'o', 's'];
  // Falsos parientes que la raíz ligera confundiría («móvil» y «movilidad»)
  const EXCEPCIONES = { movil: 'telefonomovil', moviles: 'telefonomovil', celular: 'telefonomovil', smartphone: 'telefonomovil' };
  function raiz(t) {
    let w = normalizar(t);
    if (EXCEPCIONES[w]) return EXCEPCIONES[w];
    if (w.length <= 3) return w;
    w = w.replace(/(ar|er|ir)(me|te|se|nos|lo|la|le|les|los|las)$/, '$1');
    for (const suf of SUFIJOS) {
      if (w.length - suf.length >= 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
    }
    return w;
  }

  /** Palabras (en minúscula y sin tildes) de un texto, sin palabras vacías. */
  function palabras(texto) {
    const m = normalizar(texto).match(/[a-z0-9ñ]+/g) || [];
    return m.filter(p => p.length > 1 && !PARADAS.has(p));
  }
  const raices = texto => palabras(texto).map(raiz);

  /* ───────────── Léxico de necesidades ─────────────
     claves:  cómo lo diría alguien (palabras o frases cortas; se comparan por raíz)
     expande: con qué vocabulario del corpus se aborda (se buscan con menos peso que lo escrito)
     sensible: salud mental, salud o duelo → se añade una nota de que los libros no sustituyen ayuda profesional
     crisis: riesgo vital → solo mensaje de ayuda, sin recomendaciones */
  const TEMAS = [
    { id: 'atencion', nombre: 'Atención y concentración', claves: ['concentrar', 'concentracion', 'distraer', 'distraccion', 'distraido', 'atencion', 'enfocar', 'foco', 'movil', 'notificaciones', 'pantallas', 'redes sociales', 'scroll'],
      expande: ['atención', 'foco', 'distracción', 'trabajo profundo', 'tecnología', 'minimalismo digital', 'rendimiento cognitivo', 'productividad'] },
    { id: 'habitos', nombre: 'Hábitos, constancia y motivación', claves: ['procrastinar', 'procrastinacion', 'aplazar', 'posponer', 'pereza', 'constancia', 'disciplina', 'habito', 'habitos', 'rutina', 'fuerza de voluntad', 'voluntad', 'motivacion', 'desmotivado', 'autocontrol'],
      expande: ['hábitos', 'motivación', 'autocontrol', 'planificación', 'objetivos', 'voluntad', 'cambio', 'rutina', 'productividad'] },
    { id: 'tiempo', nombre: 'Tiempo y productividad', claves: ['tiempo', 'productivo', 'productividad', 'organizar', 'organizacion', 'agenda', 'prioridades', 'sobrecarga', 'abrumado', 'tareas', 'no llego a todo'],
      expande: ['productividad', 'tiempo', 'prioridades', 'planificación', 'gestión', 'trabajo profundo'] },
    { id: 'estres', nombre: 'Estrés y ansiedad', sensible: true, claves: ['ansiedad', 'ansioso', 'estres', 'estresado', 'agobio', 'agobiado', 'nervios', 'preocupar', 'preocupacion', 'angustia', 'rumiar', 'rumiacion', 'panico', 'burnout', 'agotamiento', 'quemado'],
      expande: ['estrés', 'resiliencia', 'emociones', 'bienestar', 'regulación emocional', 'pensamientos', 'cognitivo', 'salud mental', 'descanso'] },
    { id: 'animo', nombre: 'Ánimo y autoestima', sensible: true, claves: ['depresion', 'deprimido', 'triste', 'tristeza', 'desanimo', 'apatia', 'sin ganas', 'vacio', 'soledad', 'culpa', 'autoestima', 'inseguro', 'inseguridad'],
      expande: ['emociones', 'salud mental', 'pensamientos automáticos', 'autoestima', 'bienestar', 'sentido', 'resiliencia', 'cognitivo'] },
    { id: 'crisis', nombre: 'Necesito ayuda ahora', crisis: true, claves: ['suicidio', 'suicidarme', 'suicida', 'quitarme la vida', 'hacerme dano', 'autolesion', 'no quiero vivir', 'quiero morir', 'acabar con todo'], expande: [] },
    { id: 'decisiones', nombre: 'Decidir mejor', claves: ['decidir', 'decision', 'decisiones', 'elegir', 'indeciso', 'dudar', 'dilema', 'opciones', 'arrepentir', 'equivocar'],
      expande: ['decisiones', 'toma de decisiones', 'sesgos', 'riesgo', 'incertidumbre', 'probabilidad', 'heurísticas', 'pensamiento crítico'] },
    { id: 'pensamiento', nombre: 'Pensar con claridad', claves: ['sesgo', 'sesgos', 'prejuicio', 'razonar', 'razonamiento', 'pensar mejor', 'pensar con claridad', 'pensamiento critico', 'logica', 'falacia', 'engano', 'creencias', 'racional'],
      expande: ['sesgos', 'pensamiento crítico', 'racionalidad', 'falacias', 'epistemología', 'creencias', 'evidencia', 'error'] },
    { id: 'riesgo', nombre: 'Riesgo, azar e incertidumbre', claves: ['riesgo', 'incertidumbre', 'azar', 'suerte', 'probabilidad', 'predecir', 'prediccion', 'futuro', 'imprevisto', 'fragil'],
      expande: ['riesgo', 'incertidumbre', 'probabilidad', 'predicción', 'azar', 'antifrágil'] },
    { id: 'dinero', nombre: 'Dinero personal', claves: ['ahorrar', 'ahorro', 'dinero', 'deuda', 'gastar', 'gasto', 'presupuesto', 'jubilacion', 'pension', 'patrimonio', 'rico', 'riqueza', 'sueldo', 'salario'],
      expande: ['finanzas personales', 'ahorro', 'dinero', 'inversión', 'riqueza', 'consumo', 'psicología del dinero'] },
    { id: 'inversion', nombre: 'Invertir y mercados', claves: ['invertir', 'inversion', 'bolsa', 'acciones', 'fondos', 'mercado', 'mercados', 'trading', 'especular', 'burbuja', 'crisis financiera'],
      expande: ['inversión', 'mercados', 'riesgo', 'valor', 'ciclo', 'especulación', 'psicología'] },
    { id: 'economia', nombre: 'Cómo funciona la economía', claves: ['economia', 'inflacion', 'desigualdad', 'pobreza', 'crecimiento', 'comercio', 'impuestos', 'capitalismo', 'banco', 'bancos'],
      expande: ['economía', 'mercados', 'instituciones', 'incentivos', 'desarrollo', 'historia económica'] },
    { id: 'negociacion', nombre: 'Negociar y resolver conflictos', claves: ['negociar', 'negociacion', 'regatear', 'acuerdo', 'aumento de sueldo', 'discutir', 'conflicto'],
      expande: ['negociación', 'conflicto', 'comunicación', 'acuerdo', 'intereses', 'persuasión'] },
    { id: 'persuasion', nombre: 'Persuadir e influir', claves: ['persuadir', 'convencer', 'influir', 'influencia', 'vender', 'ventas', 'manipular', 'marketing', 'publicidad', 'propaganda'],
      expande: ['persuasión', 'influencia', 'comunicación', 'marketing', 'sesgos'] },
    { id: 'hablar', nombre: 'Hablar en público y comunicar', claves: ['hablar en publico', 'presentar', 'presentacion', 'oratoria', 'charla', 'exponer', 'comunicar', 'comunicacion', 'explicar'],
      expande: ['comunicación', 'escritura', 'retórica', 'argumentación', 'debate', 'persuasión'] },
    { id: 'escritura', nombre: 'Escribir mejor', claves: ['escribir', 'redactar', 'estilo', 'blog', 'ensayo', 'escritura'],
      expande: ['escritura', 'comunicación', 'claridad', 'pensamiento'] },
    { id: 'relaciones', nombre: 'Relaciones y empatía', claves: ['pareja', 'relacion', 'relaciones', 'amigos', 'amistad', 'familia', 'empatia', 'entender a los demas', 'ruptura', 'celos'],
      expande: ['relaciones', 'pareja', 'comunicación', 'empatía', 'familia', 'emociones', 'conflicto'] },
    { id: 'carisma', nombre: 'Carisma y trato con la gente', claves: ['carisma', 'timidez', 'timido', 'hablar con gente', 'caer bien', 'socializar', 'introvertido'],
      expande: ['carisma', 'comunicación', 'relaciones', 'introversión', 'influencia'] },
    { id: 'liderazgo', nombre: 'Liderar equipos', claves: ['liderar', 'liderazgo', 'jefe', 'equipo', 'equipos', 'delegar', 'cultura de empresa', 'motivar'],
      expande: ['liderazgo', 'equipos', 'gestión', 'organizaciones', 'cultura', 'trabajo en equipo'] },
    { id: 'emprender', nombre: 'Emprender y crear un negocio', claves: ['emprender', 'emprendedor', 'startup', 'negocio', 'negocios', 'montar un negocio', 'empresa', 'clientes', 'producto', 'fundador', 'freelance', 'autonomo'],
      expande: ['emprendimiento', 'negocios', 'estrategia empresarial', 'innovación', 'producto', 'mercado'] },
    { id: 'carrera', nombre: 'Trabajo y carrera', claves: ['trabajo', 'carrera', 'empleo', 'profesion', 'cambiar de trabajo', 'vocacion', 'mi trabajo'],
      expande: ['carrera', 'trabajo', 'carrera profesional', 'propósito', 'desarrollo personal', 'habilidades'] },
    { id: 'aprender', nombre: 'Aprender y estudiar', claves: ['aprender', 'estudiar', 'memorizar', 'memoria', 'examen', 'estudio', 'idioma', 'habilidad'],
      expande: ['aprendizaje', 'memoria', 'estudio', 'educación', 'práctica deliberada', 'método', 'enseñar'] },
    { id: 'crianza', nombre: 'Crianza y educación', claves: ['hijos', 'hijo', 'crianza', 'educar', 'colegio', 'escuela', 'adolescente', 'ninos', 'padre', 'madre'],
      expande: ['crianza', 'educación', 'familia', 'desarrollo', 'juego', 'escuela'] },
    { id: 'creatividad', nombre: 'Creatividad e ideas', claves: ['creatividad', 'creativo', 'ideas', 'innovar', 'inspiracion', 'bloqueo creativo'],
      expande: ['creatividad', 'innovación', 'ideas', 'juego', 'descubrimiento'] },
    { id: 'sentido', nombre: 'Sentido y propósito', claves: ['sentido', 'proposito', 'vacio existencial', 'para que vivir', 'que hago con mi vida', 'plenitud', 'valores', 'existencia'],
      expande: ['sentido', 'felicidad', 'bienestar', 'filosofía', 'valores', 'estoicismo', 'existencia'] },
    { id: 'felicidad', nombre: 'Felicidad y bienestar', claves: ['feliz', 'felicidad', 'satisfaccion', 'contento', 'bienestar'],
      expande: ['felicidad', 'bienestar', 'emociones', 'predicción afectiva'] },
    { id: 'resiliencia', nombre: 'Adversidad y resiliencia', claves: ['adversidad', 'fracaso', 'resiliencia', 'superar', 'obstaculo', 'dificultades', 'rendirme', 'miedo'],
      expande: ['resiliencia', 'estoicismo', 'adversidad', 'mentalidad', 'fracaso', 'aceptación'] },
    { id: 'mentalidad', nombre: 'Confianza y mentalidad', claves: ['mentalidad', 'confianza', 'talento', 'capacidad', 'potencial', 'perfeccionismo', 'creer en mi'],
      expande: ['mentalidad', 'confianza', 'potencial', 'esfuerzo', 'habilidad', 'práctica'] },
    { id: 'emociones', nombre: 'Emociones', claves: ['emociones', 'emocion', 'enfado', 'ira', 'rabia', 'envidia', 'verguenza', 'controlar mis emociones'],
      expande: ['emociones', 'autocontrol', 'regulación', 'cognitivo', 'neurociencia'] },
    { id: 'sueno', nombre: 'Sueño y energía', sensible: true, claves: ['dormir', 'sueno', 'insomnio', 'cansado', 'energia', 'descanso', 'ritmo circadiano'],
      expande: ['sueño', 'salud', 'ritmo circadiano', 'energía', 'descanso'] },
    { id: 'salud', nombre: 'Salud y cuerpo', sensible: true, claves: ['salud', 'ejercicio', 'deporte', 'dieta', 'alimentacion', 'comer', 'peso', 'adelgazar', 'obesidad', 'longevidad', 'envejecer', 'entrenar'],
      expande: ['salud', 'longevidad', 'alimentación', 'ejercicio', 'biología', 'medicina'] },
    { id: 'cerebro', nombre: 'Cerebro y mente', claves: ['cerebro', 'neurociencia', 'mente', 'conciencia', 'plasticidad', 'neuronas'],
      expande: ['neurociencia', 'cerebro', 'cognición', 'plasticidad', 'conciencia'] },
    { id: 'evolucion', nombre: 'Evolución y naturaleza humana', claves: ['evolucion', 'genes', 'instintos', 'naturaleza humana', 'biologia', 'animales', 'darwin'],
      expande: ['evolución', 'biología', 'genes', 'comportamiento', 'naturaleza'] },
    { id: 'politica', nombre: 'Política y poder', claves: ['politica', 'poder', 'gobierno', 'democracia', 'elecciones', 'dictadura', 'estado', 'ideologia', 'polarizacion'],
      expande: ['política', 'poder', 'instituciones', 'democracia', 'ideología', 'debate público'] },
    { id: 'sociedad', nombre: 'Grupos y sociedad', claves: ['grupo', 'conformismo', 'presion social', 'tribu', 'estatus', 'cultura', 'sociedad', 'masas'],
      expande: ['psicología social', 'conformidad', 'estatus', 'cultura', 'grupos', 'influencia'] },
    { id: 'historia', nombre: 'Historia', claves: ['historia', 'imperio', 'guerra', 'civilizacion', 'roma', 'pasado', 'revolucion'],
      expande: ['historia', 'civilización', 'instituciones', 'guerra', 'poder'] },
    { id: 'ciencia', nombre: 'Ciencia y evidencia', claves: ['ciencia', 'metodo cientifico', 'estudios', 'evidencia', 'pseudociencia', 'estadistica', 'datos', 'correlacion', 'causalidad', 'encuesta'],
      expande: ['ciencia', 'estadística', 'evidencia', 'metodología', 'pensamiento crítico', 'probabilidad'] },
    { id: 'etica', nombre: 'Ética y filosofía', claves: ['etica', 'moral', 'filosofia', 'justicia', 'bien y mal', 'libre albedrio', 'dilema moral'],
      expande: ['ética', 'filosofía', 'moral', 'justicia', 'valores', 'libertad'] },
    { id: 'tecnologia', nombre: 'Tecnología y sociedad digital', claves: ['tecnologia', 'inteligencia artificial', 'internet', 'algoritmos', 'digital'],
      expande: ['tecnología', 'atención', 'sociedad', 'información', 'algoritmos'] },
    { id: 'estrategia', nombre: 'Estrategia y cooperación', claves: ['estrategia', 'competir', 'competencia', 'cooperar', 'cooperacion', 'ganar', 'rivales', 'teoria de juegos'],
      expande: ['estrategia', 'teoría de juegos', 'cooperación', 'incentivos', 'conflicto'] },
    { id: 'sistemas', nombre: 'Proyectos, procesos y problemas', claves: ['proyecto', 'proyectos', 'sistemas', 'procesos', 'cuello de botella', 'complejidad', 'resolver problemas', 'problema'],
      expande: ['sistemas', 'gestión de proyectos', 'resolución de problemas', 'pensamiento sistémico', 'planificación'] },
    { id: 'duelo', nombre: 'Muerte, duelo y pérdida', sensible: true, claves: ['duelo', 'morir', 'muerte', 'perdida', 'luto', 'enfermedad terminal', 'vejez'],
      expande: ['duelo', 'muerte', 'mortalidad', 'sentido', 'medicina', 'vejez'] },
    { id: 'adicciones', nombre: 'Adicciones y vicios', sensible: true, claves: ['adiccion', 'vicio', 'juego compulsivo', 'alcohol', 'drogas', 'tabaco', 'enganchado'],
      expande: ['adicción', 'hábitos', 'dopamina', 'autocontrol', 'motivación', 'atención'] },
    { id: 'apuestas', nombre: 'Apuestas y probabilidades', claves: ['apuestas', 'apostar', 'casino', 'blackjack', 'cuotas', 'tipster'],
      expande: ['probabilidad', 'apuestas', 'riesgo', 'valor esperado', 'azar'] },
    { id: 'naciones', nombre: 'Prosperidad y fracaso de los países', claves: ['paises', 'pais', 'naciones', 'prosperidad', 'desarrollo economico', 'subdesarrollo', 'colonialismo'],
      expande: ['instituciones', 'desarrollo', 'prosperidad', 'economía', 'historia económica', 'pobreza', 'política', 'incentivos'] },
    { id: 'minimalismo', nombre: 'Simplificar y priorizar', claves: ['minimalismo', 'desorden', 'simplificar'],
      expande: ['minimalismo', 'simplicidad', 'prioridades', 'esencial'] },
  ];

  /** Palabras del texto tal cual (sin tildes, minúsculas), conservando las palabras vacías para poder casar frases. */
  const todasLasPalabras = texto => normalizar(texto).match(/[a-z0-9ñ]+/g) || [];

  /** ¿La palabra escrita corresponde a la clave? Prefijo largo (no raíz): «procrastino» casa con «procrastinar», pero «público» no con «publicidad». */
  const FALSOS_PARIENTES = [[/^negociar$/, /^negocios?$/], [/^publicidad$/, /^publico$/]];
  function coincidePalabra(clave, palabra) {
    if (FALSOS_PARIENTES.some(([c, w]) => c.test(clave) && w.test(palabra))) return false;
    if (clave.length <= 4) return palabra === clave;
    return palabra.startsWith(clave.slice(0, Math.max(5, clave.length - 2)));
  }

  /** Una clave de varias palabras casa si aparecen en orden con pocas palabras de por medio. Las de crisis exigen la frase exacta. */
  function casaClave(clave, palabras, estricta) {
    const ps = todasLasPalabras(clave);
    if (ps.length === 1) return palabras.some(w => coincidePalabra(ps[0], w));
    if (estricta) {
      for (let i = 0; i + ps.length <= palabras.length; i++) if (ps.every((p, k) => palabras[i + k] === p)) return true;
      return false;
    }
    const utiles = ps.filter(p => !PARADAS.has(p));
    if (!utiles.length) return false;
    let desde = 0, primera = -1;
    for (const u of utiles) {
      let hallada = -1;
      for (let i = desde; i < palabras.length; i++) if (coincidePalabra(u, palabras[i])) { hallada = i; break; }
      if (hallada < 0) return false;
      if (primera < 0) primera = hallada;
      desde = hallada + 1;
    }
    return desde - 1 - primera <= ps.length + 2;
  }

  /** Los temas con su vocabulario ya en raíz, para compararlo con el texto del corpus. */
  const TEMAS_RAIZ = TEMAS.map(t => ({
    tema: t,
    expande: [...new Set(t.expande.flatMap(e => raices(e)))],
    claves_raiz: [...new Set(t.claves.flatMap(c => raices(c)))],
  }));

  /** ¿Qué necesidades reconoce el texto? */
  function detectarTemas(texto) {
    const ps = todasLasPalabras(texto);
    const salida = [];
    for (const tr of TEMAS_RAIZ) {
      const aciertos = tr.tema.claves.filter(c => casaClave(c, ps, !!tr.tema.crisis)).length;
      if (aciertos) salida.push({ tema: tr.tema, expande: tr.expande, claves: tr.claves_raiz, peso: aciertos });
    }
    return salida.sort((a, b) => b.peso - a.peso);
  }

  /* ───────────── Índice (BM25 por lección con pesos por campo) ───────────── */

  const PESOS_LECCION = { titulo: 4, idea_clave: 4, dominio_aplicacion: 3.5, aplicacion_practica: 2.5, cita_memorable: 1.5, conexion_cruzada: 1, autocorreccion: 0.6, cuerpo: 1 };
  const PESOS_LIBRO = { titulo: 3, autor: 3, descripcion_breve: 2.5, sub_eje: 1.5, eje_principal: 1.5 };
  const K1 = 1.4, B = 0.6;

  const comoTexto = v => Array.isArray(v) ? v.join(' ') : String(v == null ? '' : v);

  function bolsa(campos, pesos) {
    const tf = new Map();
    let largo = 0;
    for (const [campo, peso] of Object.entries(pesos)) {
      for (const r of raices(comoTexto(campos[campo]))) {
        tf.set(r, (tf.get(r) || 0) + peso);
        largo += peso;
      }
    }
    return { tf, largo };
  }

  /** Construye el índice. Es lo más caro (unos cientos de ms con ~3.500 lecciones): hazlo una vez y reutilízalo. */
  function construirIndice(libros, lecciones) {
    const porLibro = new Map(libros.map(l => [l.id, l]));
    const docs = [];
    const df = new Map();
    let sumaLargos = 0;
    for (const lec of lecciones || []) {
      if (lec.activa === false || !porLibro.has(lec.libro_id)) continue;
      const b = bolsa(lec, PESOS_LECCION);
      docs.push({ lec, libroId: lec.libro_id, tf: b.tf, largo: b.largo });
      sumaLargos += b.largo;
      for (const r of b.tf.keys()) df.set(r, (df.get(r) || 0) + 1);
    }
    const N = docs.length || 1;
    const libroBolsa = new Map();
    for (const l of libros) libroBolsa.set(l.id, bolsa(l, PESOS_LIBRO));
    return { libros, porLibro, docs, df, N, medio: (sumaLargos / N) || 1, libroBolsa, lecciones: (lecciones || []).length };
  }

  const idf = (ix, r) => { const d = ix.df.get(r) || 0; return Math.log(1 + (ix.N - d + 0.5) / (d + 0.5)); };

  /** Puntúa una bolsa de palabras contra los términos de la consulta {raiz → peso}. */
  function puntuar(ix, bolsaDoc, terminos, medio, propios) {
    let s = 0;
    const casados = [];
    const norm = 1 - B + B * (bolsaDoc.largo / medio);
    for (const [r, w] of terminos) {
      let f = bolsaDoc.tf.get(r);
      if (!f) continue;
      if (!propios.has(r)) f = Math.min(f, 2);   // el vocabulario añadido por el tema cuenta una vez: no debe ganar a lo que el usuario escribió
      s += w * idf(ix, r) * ((f * (K1 + 1)) / (f + K1 * norm));
      casados.push(r);
    }
    return { s, casados };
  }

  /* ───────────── Consulta ───────────── */

  const AVISO_SENSIBLE = 'Estos libros son divulgación y herramientas de reflexión: no sustituyen la ayuda de un profesional de la salud.';
  const MENSAJE_CRISIS = 'Lo que cuentas es importante y no tienes que pasarlo solo. Si estás pensando en hacerte daño o no ves salida, en España puedes llamar al 024 (línea de atención a la conducta suicida, gratuita, 24 horas) o al 112 si hay peligro inmediato. Fuera de España, busca la línea de ayuda de tu país o acude a urgencias.';

  /**
   * Devuelve los libros que mejor abordan la necesidad escrita.
   * opciones: { max (por defecto 6), eje (filtra por eje principal), porAutor (máximo de libros del mismo autor, 2) }
   */
  function consultar(ix, texto, opciones) {
    const op = Object.assign({ max: 6, eje: null, porAutor: 2 }, opciones || {});
    const original = String(texto || '').trim();
    const salida = { texto: original, temas: [], resultados: [], aviso: null, crisis: null, motivo: null, terminos: [] };
    if (original.length < 3) { salida.motivo = 'corto'; return salida; }

    const temas = detectarTemas(original);
    salida.temas = temas.map(t => ({ id: t.tema.id, nombre: t.tema.nombre }));
    if (temas.some(t => t.tema.crisis)) { salida.crisis = MENSAJE_CRISIS; salida.motivo = 'crisis'; return salida; }
    if (temas.some(t => t.tema.sensible)) salida.aviso = AVISO_SENSIBLE;

    // Términos: lo escrito pesa 1; el vocabulario del tema, 0,45 (menos cuantos más temas se reconocen)
    const terminos = new Map();
    const escritas = raices(original);
    const mostrar = new Map(); // raíz → palabra tal como la escribió el usuario
    for (const p of palabras(original)) mostrar.set(raiz(p), p);
    const delTema = new Set();
    for (const t of temas) { for (const r of t.claves) delTema.add(r); for (const r of t.expande) delTema.add(r); }
    // Con una necesidad reconocida, lo que el léxico no entiende (palabras sueltas del relato) pesa menos
    for (const r of escritas) terminos.set(r, temas.length && !delTema.has(r) ? 0.6 : 1);
    const propios = new Set(escritas);
    const pesoTema = temas.length > 3 ? 0.3 : 0.45;
    for (const t of temas) for (const r of t.expande) if (!terminos.has(r)) terminos.set(r, pesoTema);
    if (!terminos.size) { salida.motivo = 'sin_terminos'; return salida; }
    salida.terminos = [...new Set(escritas)].filter(r => (ix.df.get(r) || 0) > 0).map(r => mostrar.get(r) || r);

    // «Conceptos» de la consulta: cada palabra con contenido y cada necesidad reconocida. La cobertura mide cuántos
    // (ponderados por lo raros que son) aborda un libro: es lo que se enseña como «responde a…».
    const conceptos = [];
    for (const r of new Set(escritas)) {
      if (!(ix.df.get(r) > 0)) continue;
      conceptos.push({ tipo: 'palabra', raices: [r], peso: Math.min(idf(ix, r), 4) * (temas.length && !delTema.has(r) ? 0.6 : 1), etiqueta: mostrar.get(r) || r });
    }
    for (const t of temas) {
      const rs = [...new Set([...t.claves, ...t.expande])];
      const presentes = rs.filter(r => ix.df.get(r) > 0);
      if (!presentes.length) continue;
      const media = presentes.reduce((a, r) => a + idf(ix, r), 0) / presentes.length;
      conceptos.push({ tipo: 'tema', claves: new Set(t.claves), raices: rs, peso: Math.min(media * 1.4, 4.5), etiqueta: t.tema.nombre });
    }
    if (!conceptos.length) { salida.motivo = 'sin_resultados'; return salida; }
    const pesoConceptos = conceptos.reduce((a, c) => a + c.peso, 0);
    const cubre = set => {
      let s = 0;
      const hechos = [];
      for (const c of conceptos) {
        // Una necesidad cuenta como cubierta si aparece una de sus palabras clave o al menos dos términos de su vocabulario
        const ok = c.tipo === 'palabra' ? set.has(c.raices[0]) : (c.raices.some(r => c.claves.has(r) && set.has(r)) || c.raices.filter(r => set.has(r)).length >= 2);
        if (ok) { s += c.peso; hechos.push(c.etiqueta); }
      }
      return { frac: s / pesoConceptos, hechos };
    };

    // Puntuación de cada lección y agrupación por libro
    const porLibro = new Map();
    for (const d of ix.docs) {
      const { s, casados } = puntuar(ix, d, terminos, ix.medio, propios);
      if (s <= 0) continue;
      let g = porLibro.get(d.libroId);
      if (!g) { g = { libroId: d.libroId, lecciones: [] }; porLibro.set(d.libroId, g); }
      g.lecciones.push({ lec: d.lec, s, casados });
    }
    const candidatos = [];
    for (const g of porLibro.values()) {
      const libro = ix.porLibro.get(g.libroId);
      if (op.eje && (libro.eje_principal || libro.eje) !== op.eje) continue;
      g.lecciones.sort((a, b) => b.s - a.s);
      const lb = puntuar(ix, ix.libroBolsa.get(g.libroId), terminos, ix.medio, propios);
      const [l0, l1, l2] = g.lecciones;
      const total = l0.s + 0.35 * (l1 ? l1.s : 0) + 0.2 * (l2 ? l2.s : 0) + 0.6 * lb.s;
      const todas = new Set(lb.casados);
      for (const l of g.lecciones.slice(0, 3)) for (const r of l.casados) todas.add(r);
      const { frac, hechos } = cubre(todas);
      candidatos.push({ libro, total, cobertura: frac, responde: hechos, lecciones: g.lecciones.slice(0, 3), nLecciones: g.lecciones.length });
    }
    candidatos.sort((a, b) => b.total - a.total);
    if (!candidatos.length) { salida.motivo = 'sin_resultados'; return salida; }

    const mejor = candidatos[0];
    if (mejor.cobertura < 0.15) { salida.motivo = 'poco_claro'; return salida; }

    // Variedad: como mucho `porAutor` libros por autor
    const contados = new Map();
    for (const c of candidatos) {
      if (salida.resultados.length >= op.max) break;
      const clave = normalizar(c.libro.autor || '');
      const n = contados.get(clave) || 0;
      if (n >= op.porAutor) continue;
      if (c.total < mejor.total * 0.3 || c.cobertura < 0.12) continue;
      contados.set(clave, n + 1);
      const nivel = c.cobertura >= 0.6 ? 'alto' : c.cobertura >= 0.35 ? 'medio' : 'parcial';
      salida.resultados.push({
        libro: c.libro,
        puntuacion: Math.round((c.total / mejor.total) * 100),
        cobertura: Math.round(c.cobertura * 100),
        nivel,
        lecciones: c.lecciones.map(l => ({
          lec: l.lec,
          raices: l.casados,
          palabras: [...new Set(l.casados.filter(r => mostrar.has(r)).map(r => mostrar.get(r)))],
        })),
        nLecciones: c.nLecciones,
        responde: c.responde,
        empezarPor: c.lecciones[0].lec,
      });
    }
    if (!salida.resultados.length) salida.motivo = 'poco_claro';
    return salida;
  }

  /** Envuelve en <mark> las palabras del texto cuyo raíz está en `rs`. Escapa el HTML. */
  function resaltar(texto, rs) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const set = new Set(rs || []);
    return String(texto || '').split(/([\p{L}\p{N}]+)/u).map(p => (/^[\p{L}\p{N}]+$/u.test(p) && set.has(raiz(p))) ? `<mark class="hl">${esc(p)}</mark>` : esc(p)).join('');
  }

  /** Ejemplos de necesidades para empezar (cada uno recoge un tema distinto del léxico). */
  const EJEMPLOS = [
    'Me cuesta concentrarme y acabo mirando el móvil todo el rato',
    'Procrastino y no consigo mantener buenos hábitos',
    'Quiero negociar mejor mi sueldo y mis acuerdos',
    'Tomo decisiones importantes y tengo miedo a equivocarme',
    'Quiero empezar a invertir sin dejarme llevar por el pánico',
    'Estoy agobiado por el estrés del trabajo',
    'Quiero hablar en público con más seguridad',
    'Cómo educar mejor a mis hijos',
    'Quiero pensar con más claridad y detectar sesgos',
    'Siento que mi vida no tiene un sentido claro',
    'Quiero aprender más rápido y recordar lo que estudio',
    'Cómo entender mejor a mi pareja y discutir menos',
  ];

  return { TEMAS, EJEMPLOS, AVISO_SENSIBLE, MENSAJE_CRISIS, normalizar, raiz, palabras, raices, detectarTemas, construirIndice, consultar, resaltar };
});
