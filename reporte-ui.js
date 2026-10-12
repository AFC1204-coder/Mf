/* «¿Algo no cuadra?» — hoja inferior para avisar de un fallo en una lección o en una pregunta. */
(function () {
  'use strict';
  const COLA_KEY = 'scs-reportes-pend';
  let ctx = null;

  const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA_KEY) || '[]'); } catch (e) { return []; } };
  const guardarCola = c => { try { localStorage.setItem(COLA_KEY, JSON.stringify(c)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function enviar(fila) {
    await sb('reportes_contenido', { method: 'POST', body: JSON.stringify(fila), headers: { Prefer: 'return=minimal' } });
  }

  /** Reintenta los avisos que no se pudieron enviar (sin red). */
  async function vaciarCola() {
    let cola = leerCola();
    if (!cola.length) return;
    const quedan = [];
    for (const f of cola) { try { await enviar(f); } catch (e) { quedan.push(f); } }
    guardarCola(quedan);
  }

  function panel() {
    let p = document.getElementById('rep-panel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'rep-panel'; p.className = 'amb-panel'; p.hidden = true;
    p.innerHTML = '<div class="amb-fondo" data-cerrar></div><div class="amb-hoja" role="dialog" aria-label="¿Algo no cuadra?"></div>';
    p.addEventListener('click', e => { if (e.target.hasAttribute('data-cerrar')) cerrar(); });
    document.body.appendChild(p);
    return p;
  }

  function cerrar() { const p = document.getElementById('rep-panel'); if (p) p.hidden = true; ctx = null; }

  function abrir(tipo, id) {
    const motivos = Reporte.MOTIVOS[tipo];
    if (!motivos || !id) return;
    ctx = { tipo, id, motivo: null };
    const p = panel();
    p.querySelector('.amb-hoja').innerHTML = `
      <p class="amb-k">¿Algo no cuadra?</p>
      <div class="amb-opts" id="rep-motivos">
        ${motivos.map(m => `<button type="button" class="amb-opt" data-m="${m.id}"><b>${esc(m.etiqueta)}</b></button>`).join('')}
      </div>
      <textarea id="rep-nota" class="rep-nota" rows="3" maxlength="${Reporte.NOTA_MAX}" placeholder="Opcional: qué te chirría o qué crees que es lo correcto"></textarea>
      <div class="amb-acc">
        <button type="button" class="amb-apagar" data-cerrar>Cancelar</button>
        <button type="button" class="amb-cerrar" id="rep-enviar" disabled>Avisar</button>
      </div>`;
    p.querySelector('#rep-motivos').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      ctx.motivo = b.dataset.m;
      p.querySelectorAll('#rep-motivos .amb-opt').forEach(x => x.classList.toggle('on', x === b));
      p.querySelector('#rep-enviar').disabled = false;
    });
    p.querySelector('#rep-enviar').addEventListener('click', async () => {
      if (!ctx || !ctx.motivo) return;
      const fila = Reporte.filaReporte(ctx.tipo, ctx.id, ctx.motivo, p.querySelector('#rep-nota').value);
      cerrar();
      if (!fila) return;
      try { await enviar(fila); toast('Gracias, queda anotado para revisarlo'); }
      catch (e) { guardarCola(Reporte.encolar(leerCola(), fila)); toast('Sin conexión: lo enviaré cuando vuelva'); }
    });
    p.hidden = false;
  }

  /** HTML del enlace discreto que se coloca junto a una lección o una respuesta. */
  function enlace(tipo, id) {
    return `<button type="button" class="rep-link" onclick="Reportar.abrir('${tipo}','${esc(id)}')">¿Algo no cuadra?</button>`;
  }

  window.Reportar = { abrir, enlace, vaciarCola };
  window.addEventListener('online', vaciarCola);
  setTimeout(vaciarCola, 4000);
})();
