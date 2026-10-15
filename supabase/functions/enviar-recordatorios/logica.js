/**
 * Lógica pura de los recordatorios (sin red ni base de datos), para poder probarla.
 * Reglas (docs/rediseno-uso-diario.md §9): como máximo un aviso al día, a la hora elegida,
 * solo si la sesión de hoy no está hecha; tras 3 avisos sin respuesta pasa a semanal;
 * nunca pérdidas ni urgencia.
 */
export const TZ = 'Europe/Madrid';
export const CORTE_HORA = 4;           // el día lógico acaba a las 04:00
export const MAX_IGNORADOS = 3;
export const VENTANA_HORAS = 6;        // si el cron falla, no se avisa más de 6 h tarde

/** Fecha (YYYY-MM-DD) y minutos desde las 00:00 en la zona horaria dada. */
export function partesLocales(fecha, tz = TZ) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(fecha).map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Día lógico (corte 04:00) al que pertenece un instante. */
export function diaLogico(fecha, corte = CORTE_HORA, tz = TZ) {
  const { fecha: dia, minutos } = partesLocales(fecha, tz);
  if (minutos >= corte * 60) return dia;
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** Minutos dentro del día lógico (04:00 → 0, 03:59 → 1439). */
const logicos = (min, corte = CORTE_HORA) => (min - corte * 60 + 1440) % 1440;

/**
 * ¿Toca avisar ahora a esta suscripción?
 * { ok, motivo }: motivo explica por qué no (útil para registrar y depurar).
 */
export function debeAvisar({ ahora, hora, frecuencia = 'diaria', ultimoAvisoDia = null, ultimoAvisoEn = null, sesionHechaHoy = false }) {
  const objetivo = aMinutos(hora);
  if (objetivo == null) return { ok: false, motivo: 'hora_invalida' };
  const hoy = diaLogico(ahora);
  if (ultimoAvisoDia === hoy) return { ok: false, motivo: 'ya_avisado_hoy' };
  if (sesionHechaHoy) return { ok: false, motivo: 'sesion_hecha' };
  const ahoraMin = logicos(partesLocales(ahora).minutos);
  const objMin = logicos(objetivo);
  if (ahoraMin < objMin) return { ok: false, motivo: 'aun_no_es_la_hora' };
  if (ahoraMin - objMin > VENTANA_HORAS * 60) return { ok: false, motivo: 'fuera_de_ventana' };
  if (frecuencia === 'semanal' && ultimoAvisoEn) {
    const dias = (ahora.getTime() - new Date(ultimoAvisoEn).getTime()) / 86400000;
    if (dias < 6.5) return { ok: false, motivo: 'semanal_reciente' };
  }
  return { ok: true, motivo: 'toca' };
}

/**
 * Evalúa un aviso ya pasado. `sesiones` son los instantes (ISO) de los `sesion_cerrada`
 * del día lógico del aviso. respondido = hubo sesión ese día; en2h = la hubo en < 2 h.
 */
export function evaluarAviso({ enviado, sesiones = [] }) {
  const t0 = new Date(enviado).getTime();
  const respondido = sesiones.length > 0;
  const en2h = sesiones.some(s => { const d = new Date(s).getTime() - t0; return d >= 0 && d <= 2 * 3600 * 1000; });
  return { respondido, en2h };
}

/** Contador de avisos sin respuesta y frecuencia tras evaluar un aviso. */
export function actualizarContadores({ ignorados = 0, frecuencia = 'diaria' }, respondido) {
  if (respondido) {
    return { ignorados: 0, frecuencia: 'diaria', cambio: frecuencia === 'semanal' ? 'diaria' : null };
  }
  const n = ignorados + 1;
  if (frecuencia === 'diaria' && n >= MAX_IGNORADOS) return { ignorados: n, frecuencia: 'semanal', cambio: 'semanal' };
  return { ignorados: n, frecuencia, cambio: null };
}

const recorta = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/[ ,.;:]+$/, '') + '…';
};

/** Texto del aviso: la idea del día (aporta aunque no se abra) y la lección que toca. */
export function textoAviso({ idea, titulo, nota }) {
  const title = idea ? recorta(idea, 90) : 'El atril está puesto';
  let body = titulo ? 'Hoy: ' + recorta(titulo, 70) : 'Una lección de pocos minutos, cuando quieras.';
  if (nota === 'semanal') body += ' Desde ahora te aviso solo una vez por semana.';
  if (nota === 'diaria') body += ' Vuelvo a avisarte a diario.';
  return { title, body };
}
