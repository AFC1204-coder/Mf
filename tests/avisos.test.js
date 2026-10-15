import { describe, it, expect } from 'vitest';
import { diaLogico, debeAvisar, evaluarAviso, actualizarContadores, textoAviso, aMinutos } from '../supabase/functions/enviar-recordatorios/logica.js';

// 2026-10-14 es horario de verano en Madrid (UTC+2)
const madrid = (iso) => new Date(iso + ':00+02:00');

describe('día lógico', () => {
  it('antes de las 04:00 cuenta como el día anterior', () => {
    expect(diaLogico(madrid('2026-10-15T01:30'))).toBe('2026-10-14');
    expect(diaLogico(madrid('2026-10-15T04:00'))).toBe('2026-10-15');
    expect(diaLogico(madrid('2026-10-14T21:30'))).toBe('2026-10-14');
  });
});

describe('debeAvisar', () => {
  const base = { hora: '21:30', frecuencia: 'diaria', ultimoAvisoDia: null, ultimoAvisoEn: null, sesionHechaHoy: false };
  it('avisa a la hora y no antes', () => {
    expect(debeAvisar({ ...base, ahora: madrid('2026-10-14T21:29') }).motivo).toBe('aun_no_es_la_hora');
    expect(debeAvisar({ ...base, ahora: madrid('2026-10-14T21:30') }).ok).toBe(true);
    expect(debeAvisar({ ...base, ahora: madrid('2026-10-14T21:44') }).ok).toBe(true);
  });
  it('no avisa si la sesión de hoy está hecha', () => {
    expect(debeAvisar({ ...base, sesionHechaHoy: true, ahora: madrid('2026-10-14T22:00') }).motivo).toBe('sesion_hecha');
  });
  it('un aviso al día como máximo', () => {
    expect(debeAvisar({ ...base, ultimoAvisoDia: '2026-10-14', ahora: madrid('2026-10-14T22:00') }).motivo).toBe('ya_avisado_hoy');
    expect(debeAvisar({ ...base, ultimoAvisoDia: '2026-10-13', ahora: madrid('2026-10-14T22:00') }).ok).toBe(true);
  });
  it('no avisa más de 6 h tarde', () => {
    expect(debeAvisar({ ...base, ahora: madrid('2026-10-15T03:40') }).motivo).toBe('fuera_de_ventana');
  });
  it('horas de madrugada pertenecen al día lógico anterior', () => {
    const b = { ...base, hora: '01:00' };
    expect(debeAvisar({ ...b, ahora: madrid('2026-10-15T00:59') }).motivo).toBe('aun_no_es_la_hora');
    expect(debeAvisar({ ...b, ahora: madrid('2026-10-15T01:05') }).ok).toBe(true);
    expect(debeAvisar({ ...b, ahora: madrid('2026-10-14T23:00') }).motivo).toBe('aun_no_es_la_hora');
  });
  it('semanal: no repite antes de siete días', () => {
    const s = { ...base, frecuencia: 'semanal', ultimoAvisoEn: madrid('2026-10-10T21:30').toISOString(), ultimoAvisoDia: '2026-10-10' };
    expect(debeAvisar({ ...s, ahora: madrid('2026-10-14T21:35') }).motivo).toBe('semanal_reciente');
    expect(debeAvisar({ ...s, ahora: madrid('2026-10-17T21:35') }).ok).toBe(true);
  });
  it('hora inválida no avisa', () => {
    expect(debeAvisar({ ...base, hora: '25:00', ahora: madrid('2026-10-14T22:00') }).motivo).toBe('hora_invalida');
    expect(aMinutos('9:05')).toBe(545);
  });
});

describe('evaluación y frecuencia', () => {
  it('sesión en menos de 2 h', () => {
    const enviado = madrid('2026-10-14T21:30').toISOString();
    expect(evaluarAviso({ enviado, sesiones: [madrid('2026-10-14T22:10').toISOString()] })).toEqual({ respondido: true, en2h: true });
    expect(evaluarAviso({ enviado, sesiones: [madrid('2026-10-15T00:10').toISOString()] })).toEqual({ respondido: true, en2h: false });
    expect(evaluarAviso({ enviado, sesiones: [] })).toEqual({ respondido: false, en2h: false });
  });
  it('tres ignorados pasan a semanal y responder vuelve a diaria', () => {
    let c = { ignorados: 0, frecuencia: 'diaria' };
    c = actualizarContadores(c, false); expect(c).toMatchObject({ ignorados: 1, frecuencia: 'diaria', cambio: null });
    c = actualizarContadores(c, false); expect(c.cambio).toBeNull();
    c = actualizarContadores(c, false); expect(c).toMatchObject({ ignorados: 3, frecuencia: 'semanal', cambio: 'semanal' });
    c = actualizarContadores(c, true); expect(c).toMatchObject({ ignorados: 0, frecuencia: 'diaria', cambio: 'diaria' });
  });
});

describe('texto del aviso', () => {
  it('idea + lección, sin culpa ni urgencia', () => {
    const t = textoAviso({ idea: 'Una decisión buena puede salir mal.', titulo: 'El precio del ruido' });
    expect(t).toEqual({ title: 'Una decisión buena puede salir mal.', body: 'Hoy: El precio del ruido' });
    expect(`${t.title} ${t.body}`).not.toMatch(/racha|perdid|peligro|urgente|no pierdas/i);
  });
  it('sin datos, texto genérico; avisa una vez del cambio a semanal', () => {
    expect(textoAviso({}).title).toBe('El atril está puesto');
    expect(textoAviso({ nota: 'semanal' }).body).toMatch(/una vez por semana/);
  });
  it('recorta ideas largas', () => {
    expect(textoAviso({ idea: 'x'.repeat(300) }).title.length).toBeLessThanOrEqual(90);
  });
});
