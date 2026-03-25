// ============================================================
// DATOS DEL CORPUS — NODOS Y CONEXIONES
// ============================================================
const EJES = {
  'Neurológico y Biológico': '#c8f03e',
  'Epistemológico': '#3ec8f0',
  'Civilizacional y Ciclos': '#f0a03e',
  'Organizacional e Innovación': '#f03e8a',
  'Financiero y Mercados': '#a78bfa',
  'Construcción Individual': '#fb923c',
  'Lectura del Entorno': '#34d399',
  'Modelos Mentales Avanzados': '#f0e03e'
};

const NODOS = [
  // Neurológico
  { id: 'mcgilchrist', autor: 'McGilchrist', titulo: 'The Master and His Emissary', eje: 'Neurológico y Biológico', tesis: 'El hemisferio izquierdo ha usurpado el rol del hemisferio derecho. El emissary ha depuesto al master, vaciando de sentido la civilización occidental.' },
  { id: 'sapolsky', autor: 'Sapolsky', titulo: 'Compórtate', eje: 'Neurológico y Biológico', tesis: 'El comportamiento tiene cadena causal multiescalar. Ninguna explicación de una sola escala es completa. El libre albedrío absoluto es insostenible biológicamente.' },
  { id: 'csikszentmihalyi', autor: 'Csikszentmihalyi', titulo: 'Fluir', eje: 'Neurológico y Biológico', tesis: 'La felicidad no se persigue — emerge como subproducto del flujo donde reto iguala capacidad. El ocio pasivo destruye el bienestar.' },
  { id: 'easter1', autor: 'Easter', titulo: 'La Trampa del Confort', eje: 'Neurológico y Biológico', tesis: 'El confort crónico es el desajuste evolutivo más dañino. El hardware biológico está calibrado para el estrés intermitente, no para la comodidad permanente.' },
  { id: 'easter2', autor: 'Easter', titulo: 'Cerebro de Escasez', eje: 'Neurológico y Biológico', tesis: 'El bucle de escasez hardwireado produce compulsión crónica en el entorno de abundancia artificial. La señal de escasez está diseñada industrialmente.' },
  // Epistemológico
  { id: 'deutsch', autor: 'Deutsch', titulo: 'El Comienzo del Infinito', eje: 'Epistemológico', tesis: 'El conocimiento puede crecer sin límite mediante buenas explicaciones difíciles de variar. Optimismo epistémico radical con base racional.' },
  { id: 'hofstadter', autor: 'Hofstadter', titulo: 'Gödel, Escher, Bach', eje: 'Epistemológico', tesis: 'La consciencia emerge de bucles autorreferenciales. Ningún sistema formal suficientemente potente puede ser completo y consistente desde dentro.' },
  { id: 'laotse', autor: 'Lao-Tse', titulo: 'Tao Te King', eje: 'Epistemológico', tesis: 'Wu Wei — acción desde la naturaleza del sistema, no imposición sobre ella. Manual de gobernanza y estrategia disfrazado de texto espiritual.' },
  { id: 'huxley', autor: 'Huxley', titulo: 'Las Puertas de la Percepción', eje: 'Epistemológico', tesis: 'El cerebro funciona como filtro reductor de la realidad. La percepción ordinaria es una fracción arbitraria de lo accesible.' },
  // Civilizacional
  { id: 'strauss', autor: 'Strauss & Howe', titulo: 'The Fourth Turning', eje: 'Civilizacional y Ciclos', tesis: 'La historia es cíclica con periodicidad de ~80-100 años. Estamos en el Cuarto Giro — invierno institucional previo a refundación total.' },
  { id: 'reesmogg', autor: 'Rees-Mogg & Davidson', titulo: 'El Individuo Soberano', eje: 'Civilizacional y Ciclos', tesis: 'La tecnología de la información destruye el monopolio estatal sobre la violencia y la tributación. La soberanía individual es consecuencia lógica del cambio tecnológico.' },
  // Organizacional
  { id: 'bahcall', autor: 'Bahcall', titulo: 'Loonshots', eje: 'Organizacional e Innovación', tesis: 'Las ideas revolucionarias mueren por la física de los grupos humanos. Separar exploración de ejecución es la única solución estructural.' },
  // Financiero
  { id: 'weinstein', autor: 'Weinstein', titulo: 'Secretos para Ganar', eje: 'Financiero y Mercados', tesis: 'Los mercados atraviesan cuatro etapas identificables. La ventaja es identificar la etapa actual y actuar en consonancia, nunca contra la tendencia.' },
  { id: 'minervini', autor: 'Minervini', titulo: 'Mindset Secrets', eje: 'Financiero y Mercados', tesis: 'La arquitectura mental determina el rendimiento antes que el conocimiento técnico. El ciclo creencia-emoción-conducta es un bucle autorreferencial modificable.' },
  { id: 'soros', autor: 'Soros', titulo: 'La Alquimia de las Finanzas', eje: 'Financiero y Mercados', tesis: 'Los mercados no reflejan la realidad — la construyen mediante reflexividad. Las percepciones de los participantes alteran los fundamentos que describen.' },
  { id: 'ferrer', autor: 'Ferrer', titulo: 'El Inversor Global', eje: 'Financiero y Mercados', tesis: 'La ventaja del particular es estructural. El ciclo macroeconómico es el marco sobre el que opera el análisis técnico.' },
  { id: 'tetlock', autor: 'Tetlock', titulo: 'Superforecasting', eje: 'Financiero y Mercados', tesis: 'La predicción es una habilidad entrenable basada en pensamiento probabilístico calibrado y actualización constante ante nueva evidencia.' },
  // Construcción individual
  { id: 'greene1', autor: 'Greene', titulo: 'Maestría', eje: 'Construcción Individual', tesis: 'La capacidad real se construye mediante proceso largo de mielinización y práctica deliberada. El período de aprendizaje es no negociable.' },
  { id: 'greene2', autor: 'Greene', titulo: 'Las 48 Leyes del Poder', eje: 'Construcción Individual', tesis: 'El poder opera según leyes consistentes e independientes de la moral convencional. El conocimiento es protección antes que arma.' },
  { id: 'robbins', autor: 'Robbins', titulo: 'Despertando al Gigante', eje: 'Construcción Individual', tesis: 'El comportamiento está gobernado por asociaciones dolor-placer modificables. El estado fisiológico es palanca de entrada.' },
  { id: 'obrien', autor: "O'Brien", titulo: 'Memoria Perfecta', eje: 'Construcción Individual', tesis: 'La memoria no es almacén pasivo sino sistema activo de codificación asociativa. Las técnicas usan el formato del hemisferio derecho.' },
  // Lectura del entorno
  { id: 'navarro', autor: 'Navarro', titulo: 'El Cuerpo Habla', eje: 'Lectura del Entorno', tesis: 'El sistema nervioso autónomo revela el estado interno real mediante señales que escapan al control consciente.' },
  { id: 'schafer', autor: 'Schafer', titulo: 'The Like Switch', eje: 'Lectura del Entorno', tesis: 'La atracción y confianza interpersonal siguen señales evolutivas predecibles. Conocerlas permite acelerar la vinculación.' },
];

const CONEXIONES = [
  // Bucle autorreferencial
  { a: 'hofstadter', b: 'soros', desc: 'Reflexividad como bucle extraño: el observador altera el sistema que observa' },
  { a: 'hofstadter', b: 'minervini', desc: 'Ciclo creencia-conducta como bucle autorreferencial modificable' },
  { a: 'hofstadter', b: 'mcgilchrist', desc: 'El hemisferio izquierdo no puede validarse desde sus propias reglas — teorema de incompletitud aplicado' },
  // Trampa hemisferio izquierdo
  { a: 'mcgilchrist', b: 'huxley', desc: 'El filtro reductor de Huxley es el mecanismo neurológico de la dominancia izquierda' },
  { a: 'mcgilchrist', b: 'laotse', desc: 'El Tao describe el modo operativo del hemisferio derecho: contexto, flujo, alineación' },
  { a: 'mcgilchrist', b: 'obrien', desc: 'Las técnicas de memoria explotan la superioridad del hemisferio derecho en retención espacial' },
  { a: 'mcgilchrist', b: 'easter2', desc: 'El bucle de escasez es un mecanismo del hemisferio izquierdo colonizando el tiempo de atención' },
  // Ciclos y posicionamiento
  { a: 'strauss', b: 'weinstein', desc: 'El ciclo histórico macro determina el contexto en que operan los ciclos de mercado' },
  { a: 'strauss', b: 'laotse', desc: 'Wu Wei aplicado a la historia: reconocer la fase del ciclo y actuar en consonancia' },
  { a: 'strauss', b: 'reesmogg', desc: 'El Cuarto Giro y la megapolítica describen la misma transformación desde ángulos distintos' },
  { a: 'soros', b: 'weinstein', desc: 'Las etapas técnicas de Weinstein son la manifestación visible del ciclo reflexivo de Soros' },
  { a: 'soros', b: 'tetlock', desc: 'Identificar la fase del ciclo reflexivo es superforecasting aplicado a mercados' },
  // Construcción de capacidad
  { a: 'greene1', b: 'csikszentmihalyi', desc: 'La práctica deliberada sostenida requiere flujo como motivación intrínseca' },
  { a: 'greene1', b: 'minervini', desc: 'La práctica deliberada falla si la identidad subyacente es incongruente' },
  { a: 'greene1', b: 'sapolsky', desc: 'La mielinización es un proceso biológico real validado por la neurociencia' },
  // Biología como techo y suelo
  { a: 'sapolsky', b: 'minervini', desc: 'El ciclo creencia-emoción-conducta requiere intervención fisiológica, no solo cognitiva' },
  { a: 'sapolsky', b: 'csikszentmihalyi', desc: 'El flujo activa circuitos dopaminérgicos del esfuerzo dirigido, no de la recompensa pasiva' },
  { a: 'sapolsky', b: 'easter1', desc: 'El sistema de estrés está diseñado para estresores agudos, no para el confort crónico' },
  { a: 'sapolsky', b: 'easter2', desc: 'El bucle de escasez opera en circuitos subcorticales más antiguos que el córtex prefrontal' },
  // Lectura directa vs narrativa
  { a: 'weinstein', b: 'navarro', desc: 'El precio y el cuerpo emiten señales más honestas que el discurso que los rodea' },
  { a: 'navarro', b: 'schafer', desc: 'Navarro diagnostica el estado interno; Schafer describe cómo modularlo' },
  { a: 'navarro', b: 'greene2', desc: 'El poder real se lee en el comportamiento no verbal antes que en los títulos formales' },
  // Organización e innovación
  { a: 'bahcall', b: 'minervini', desc: 'La ventaja del particular sobre el institucional es estructural — el tamaño invierte los incentivos' },
  { a: 'bahcall', b: 'sapolsky', desc: 'Los incentivos que Bahcall describe operan a través de sistemas dopaminérgicos reales' },
  // Epistemología aplicada
  { a: 'deutsch', b: 'tetlock', desc: 'Las buenas predicciones son difíciles de variar: criterios concretos de falsación' },
  { a: 'deutsch', b: 'huxley', desc: 'El filtro reductor hace el conocimiento necesariamente aproximado y mejorable' },
  { a: 'laotse', b: 'weinstein', desc: 'Wu Wei operacionalizado: no operar contra la etapa dominante del mercado' },
  { a: 'laotse', b: 'ferrer', desc: 'El ciclo económico como sistema natural — actuar con él, no contra él' },
  // Rees-Mogg
  { a: 'reesmogg', b: 'deutsch', desc: 'El conocimiento como activo soberano: las buenas explicaciones son capital no confiscable' },
  { a: 'reesmogg', b: 'soros', desc: 'La narrativa sobre el Estado-nación es parte de su propia reflexividad' },
  // Easter conexiones
  { a: 'easter1', b: 'csikszentmihalyi', desc: 'La incomodidad calibrada y el flujo son el mismo principio — reto que iguala capacidad' },
  { a: 'easter1', b: 'minervini', desc: 'El estado fisiológico óptimo requiere hormesis, no confort crónico' },
  { a: 'easter2', b: 'csikszentmihalyi', desc: 'El flujo es el polo opuesto al bucle de escasez — recompensa intrínseca vs compulsión' },
];

// ============================================================
// MOTOR DEL GRAFO
// ============================================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;
let nodes = [];
let edges = [];
let dragging = null;
let dragOffX, dragOffY;
let panX = 0, panY = 0;
let panStartX, panStartY;
let isPanning = false;
let scale = 1;
let selectedNode = null;
let activeEjes = new Set(Object.keys(EJES));
let animFrame;

function resize() {
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}

function initNodes() {
  const ejeLists = {};
  NODOS.forEach(n => {
    if (!ejeLists[n.eje]) ejeLists[n.eje] = [];
    ejeLists[n.eje].push(n);
  });

  const ejeKeys = Object.keys(ejeLists);
  const numEjes = ejeKeys.length;
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  nodes = NODOS.map(n => {
    const ejeIdx = ejeKeys.indexOf(n.eje);
    const ejeList = ejeLists[n.eje];
    const idxInEje = ejeList.indexOf(n);
    const angleBase = (ejeIdx / numEjes) * Math.PI * 2 - Math.PI / 2;
    const spread = (ejeList.length > 1) ? ((idxInEje - (ejeList.length - 1) / 2) * 0.18) : 0;
    const angle = angleBase + spread;
    const r = radius + (idxInEje % 2 === 0 ? 0 : 40);
    return {
      ...n,
      x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 20,
      y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0,
      radius: 22,
      color: EJES[n.eje] || '#888'
    };
  });

  edges = CONEXIONES.map(c => ({
    ...c,
    nodeA: nodes.find(n => n.id === c.a),
    nodeB: nodes.find(n => n.id === c.b)
  })).filter(e => e.nodeA && e.nodeB);
}

// Force-directed layout
function applyForces() {
  const visibleNodes = nodes.filter(n => activeEjes.has(n.eje));

  // Repulsion
  for (let i = 0; i < visibleNodes.length; i++) {
    for (let j = i + 1; j < visibleNodes.length; j++) {
      const a = visibleNodes[i], b = visibleNodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 2800 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // Attraction on edges
  edges.forEach(e => {
    if (!activeEjes.has(e.nodeA.eje) || !activeEjes.has(e.nodeB.eje)) return;
    const dx = e.nodeB.x - e.nodeA.x;
    const dy = e.nodeB.y - e.nodeA.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const target = 160;
    const force = (dist - target) * 0.012;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    e.nodeA.vx += fx; e.nodeA.vy += fy;
    e.nodeB.vx -= fx; e.nodeB.vy -= fy;
  });

  // Center gravity
  const cx = W / 2, cy = H / 2;
  visibleNodes.forEach(n => {
    n.vx += (cx - n.x) * 0.003;
    n.vy += (cy - n.y) * 0.003;
  });

  // Apply velocity with damping
  visibleNodes.forEach(n => {
    if (n === dragging) return;
    n.x += n.vx * 0.4;
    n.y += n.vy * 0.4;
    n.vx *= 0.7;
    n.vy *= 0.7;
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  const visibleNodes = nodes.filter(n => activeEjes.has(n.eje));
  const visibleEdges = edges.filter(e => activeEjes.has(e.nodeA.eje) && activeEjes.has(e.nodeB.eje));

  // Edges
  visibleEdges.forEach(e => {
    const isHighlighted = selectedNode && (e.nodeA === selectedNode || e.nodeB === selectedNode);
    const isConnected = selectedNode && (e.nodeA.id === selectedNode.id || e.nodeB.id === selectedNode.id);

    ctx.beginPath();
    ctx.moveTo(e.nodeA.x, e.nodeA.y);
    ctx.lineTo(e.nodeB.x, e.nodeB.y);

    if (selectedNode) {
      if (isConnected) {
        ctx.strokeStyle = 'rgba(200,240,62,0.5)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();
  });

  // Nodes
  visibleNodes.forEach(n => {
    const isSelected = n === selectedNode;
    const isConnected = selectedNode && edges.some(e =>
      (e.nodeA === selectedNode && e.nodeB === n) ||
      (e.nodeB === selectedNode && e.nodeA === n)
    );
    const dimmed = selectedNode && !isSelected && !isConnected;

    const r = n.radius;

    // Glow on selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 12, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 12);
      grad.addColorStop(0, n.color + '40');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = dimmed ? '#1a1a1a' : n.color + (isSelected ? 'ff' : '22');
    ctx.fill();
    ctx.strokeStyle = dimmed ? '#222' : (isSelected ? n.color : n.color + '88');
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = dimmed ? '#333' : (isSelected ? '#fff' : n.color + 'cc');
    ctx.font = `${isSelected ? '600 ' : ''}${Math.round(10 / scale * 0.8 + 8)}px IBM Plex Mono`;
    ctx.font = isSelected ? 'bold 11px IBM Plex Mono' : '10px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Short name
    const label = n.autor.split(' ')[0];
    ctx.fillText(label, n.x, n.y);
  });

  ctx.restore();
  applyForces();
  animFrame = requestAnimationFrame(draw);
}

// ============================================================
// INTERACCIÓN
// ============================================================
function screenToWorld(x, y) {
  return {
    x: (x - panX) / scale,
    y: (y - panY) / scale
  };
}

function getNodeAt(sx, sy) {
  const { x, y } = screenToWorld(sx, sy);
  return nodes.find(n => {
    const dx = n.x - x, dy = n.y - y;
    return Math.sqrt(dx * dx + dy * dy) < n.radius + 5 && activeEjes.has(n.eje);
  });
}

canvas.addEventListener('mousedown', e => {
  const node = getNodeAt(e.clientX, e.clientY - 52);
  if (node) {
    dragging = node;
    const w = screenToWorld(e.clientX, e.clientY - 52);
    dragOffX = node.x - w.x;
    dragOffY = node.y - w.y;
  } else {
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
  }
});

canvas.addEventListener('mousemove', e => {
  if (dragging) {
    const w = screenToWorld(e.clientX, e.clientY - 52);
    dragging.x = w.x + dragOffX;
    dragging.y = w.y + dragOffY;
  } else if (isPanning) {
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
  }
});

canvas.addEventListener('mouseup', e => {
  if (dragging) {
    const node = getNodeAt(e.clientX, e.clientY - 52);
    if (node && !isPanning) selectNode(node);
    dragging = null;
  }
  isPanning = false;
});

canvas.addEventListener('click', e => {
  if (isPanning) return;
  const node = getNodeAt(e.clientX, e.clientY - 52);
  if (node) selectNode(node);
  else closePanel();
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const mx = e.clientX, my = e.clientY - 52;
  panX = mx - (mx - panX) * delta;
  panY = my - (my - panY) * delta;
  scale = Math.max(0.3, Math.min(3, scale * delta));
}, { passive: false });

// Touch
let lastTouch = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const node = getNodeAt(t.clientX, t.clientY - 52);
    if (node) {
      dragging = node;
      const w = screenToWorld(t.clientX, t.clientY - 52);
      dragOffX = node.x - w.x;
      dragOffY = node.y - w.y;
    } else {
      isPanning = true;
      panStartX = t.clientX - panX;
      panStartY = t.clientY - panY;
    }
    lastTouch = { x: t.clientX, y: t.clientY };
  }
}, { passive: true });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    if (dragging) {
      const w = screenToWorld(t.clientX, t.clientY - 52);
      dragging.x = w.x + dragOffX;
      dragging.y = w.y + dragOffY;
    } else if (isPanning) {
      panX = t.clientX - panStartX;
      panY = t.clientY - panStartY;
    }
  }
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (dragging) {
    const t = e.changedTouches[0];
    if (lastTouch && Math.abs(t.clientX - lastTouch.x) < 5 && Math.abs(t.clientY - lastTouch.y) < 5) {
      selectNode(dragging);
    }
    dragging = null;
  }
  isPanning = false;
});

// ============================================================
// PANEL
// ============================================================
function selectNode(node) {
  selectedNode = node;
  const color = EJES[node.eje] || '#888';

  document.getElementById('panel-eje').textContent = node.eje;
  document.getElementById('panel-eje').style.color = color;
  document.getElementById('panel-autor').textContent = node.autor;
  document.getElementById('panel-autor').style.color = color;
  document.getElementById('panel-titulo').textContent = node.titulo;
  document.getElementById('panel-tesis').textContent = node.tesis;

  // Conexiones
  const conns = CONEXIONES.filter(c => c.a === node.id || c.b === node.id);
  const connHTML = conns.map(c => {
    const otherId = c.a === node.id ? c.b : c.a;
    const other = NODOS.find(n => n.id === otherId);
    if (!other) return '';
    const otherColor = EJES[other.eje] || '#888';
    return `<div class="conexion-item" onclick="jumpToNode('${otherId}')">
      <div class="conexion-autor" style="color:${otherColor}">${other.autor}</div>
      <div class="conexion-desc">${c.desc}</div>
    </div>`;
  }).join('');

  document.getElementById('panel-conexiones').innerHTML = connHTML ||
    '<div style="color:var(--text-dim);font-size:0.8rem;">Sin conexiones registradas.</div>';

  document.getElementById('panel').classList.add('open');
}

function jumpToNode(id) {
  const node = nodes.find(n => n.id === id);
  if (node) selectNode(node);
}

function closePanel() {
  selectedNode = null;
  document.getElementById('panel').classList.remove('open');
}

// ============================================================
// FILTROS DE EJES
// ============================================================
function buildFilters() {
  const container = document.getElementById('eje-filters');
  const legend = document.getElementById('legend');

  Object.entries(EJES).forEach(([eje, color]) => {
    // Filter button
    const btn = document.createElement('button');
    btn.className = 'eje-filter-btn active';
    btn.dataset.eje = eje;
    btn.innerHTML = `<span class="dot" style="background:${color}"></span>${eje.split(' ')[0]}`;
    btn.onclick = () => toggleEje(eje, btn);
    container.appendChild(btn);

    // Legend
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${eje.split(' ')[0]}`;
    legend.appendChild(item);
  });
}

function toggleEje(eje, btn) {
  if (activeEjes.has(eje)) {
    if (activeEjes.size === 1) return; // mantener al menos uno
    activeEjes.delete(eje);
    btn.classList.remove('active');
    btn.style.opacity = '0.4';
  } else {
    activeEjes.add(eje);
    btn.classList.add('active');
    btn.style.opacity = '1';
  }
  if (selectedNode && !activeEjes.has(selectedNode.eje)) closePanel();
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('resize', () => {
  resize();
});

resize();
buildFilters();
initNodes();
draw();
