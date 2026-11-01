import { describe, it, expect } from 'vitest';
import C from '../lib/cuenta.js';

const AHORA = 1_800_000_000_000;
const resp = (extra = {}) => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'a@b.es' }, ...extra });

describe('Cuenta · qué se guarda de una sesión', () => {
  it('toma tokens, caducidad, correo e id', () => {
    expect(C.sesionDe(resp(), AHORA)).toEqual({ access: 'AT', refresh: 'RT', expira: AHORA + 3600_000, email: 'a@b.es', uid: 'u1' });
  });
  it('prefiere expires_at (en segundos) si viene', () => {
    expect(C.sesionDe(resp({ expires_at: 1_800_000_500 }), AHORA).expira).toBe(1_800_000_500_000);
  });
  it('sin token de acceso no hay sesión', () => {
    expect(C.sesionDe({}, AHORA)).toBeNull();
    expect(C.sesionDe(null, AHORA)).toBeNull();
    expect(C.sesionDe({ access_token: '' }, AHORA)).toBeNull();
  });
  it('tolera la falta de usuario o de refresh', () => {
    const s = C.sesionDe({ access_token: 'AT' }, AHORA);
    expect(s.refresh).toBe('');
    expect(s.email).toBe('');
    expect(s.expira).toBe(AHORA + 3600_000);
  });
});

describe('Cuenta · cuándo renovar', () => {
  const s = { access: 'AT', refresh: 'RT', expira: AHORA + 3600_000 };
  it('un token recién dado sirve', () => { expect(C.vigente(s, AHORA)).toBe(true); expect(C.hayQueRenovar(s, AHORA)).toBe(false); });
  it('a menos de 2 minutos de caducar ya hay que renovarlo', () => {
    const casi = { ...s, expira: AHORA + 90_000 };
    expect(C.vigente(casi, AHORA)).toBe(false);
    expect(C.hayQueRenovar(casi, AHORA)).toBe(true);
  });
  it('sin refresh token no se puede renovar', () => {
    expect(C.hayQueRenovar({ ...s, refresh: '', expira: AHORA - 1 }, AHORA)).toBe(false);
  });
  it('sin sesión nada es vigente', () => { expect(C.vigente(null, AHORA)).toBe(false); expect(C.hayQueRenovar(null, AHORA)).toBe(false); });
  it('programa la renovación 2 minutos antes y nunca antes de 5 s', () => {
    expect(C.renovarEn(s, AHORA)).toBe(3600_000 - C.MARGEN_MS);
    expect(C.renovarEn({ ...s, expira: AHORA + 1000 }, AHORA)).toBe(5000);
    expect(C.renovarEn(null, AHORA)).toBe(0);
  });
});

describe('Cuenta · cabeceras de las peticiones', () => {
  it('con sesión válida lleva el token del usuario', () => {
    const h = C.cabeceras({ access: 'AT', expira: AHORA + 60_000 }, AHORA, 'ANON');
    expect(h).toEqual({ apikey: 'ANON', Authorization: 'Bearer AT' });
  });
  it('sin sesión o caducada lleva la clave pública', () => {
    expect(C.cabeceras(null, AHORA, 'ANON').Authorization).toBe('Bearer ANON');
    expect(C.cabeceras({ access: 'AT', expira: AHORA - 1 }, AHORA, 'ANON').Authorization).toBe('Bearer ANON');
  });
  it('la apikey siempre es la pública y se suman cabeceras extra sin perderla', () => {
    const h = C.cabeceras({ access: 'AT', expira: AHORA + 60_000 }, AHORA, 'ANON', { Prefer: 'return=minimal' });
    expect(h).toEqual({ apikey: 'ANON', Authorization: 'Bearer AT', Prefer: 'return=minimal' });
  });
});

describe('Cuenta · lo escrito y los errores', () => {
  it('valida antes de llamar a la red', () => {
    expect(C.validarEntrada('', 'x')).toMatch(/correo/);
    expect(C.validarEntrada('no-es-correo', 'x')).toMatch(/válido/);
    expect(C.validarEntrada('a@b.es', '')).toMatch(/contraseña/);
    expect(C.validarEntrada('  a@b.es ', 'x')).toBeNull();
  });
  it('traduce los errores de Supabase', () => {
    expect(C.mensajeError(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })).toMatch(/incorrectos/);
    expect(C.mensajeError(400, '{"error":"invalid_grant","error_description":"Invalid login credentials"}')).toMatch(/incorrectos/);
    expect(C.mensajeError(400, 'Email not confirmed')).toMatch(/confirmar/);
    expect(C.mensajeError(429, {})).toMatch(/Demasiados/);
    expect(C.mensajeError(0, null)).toMatch(/conexión/);
    expect(C.mensajeError(503, {})).toMatch(/servidor/);
    expect(C.mensajeError(418, {})).toMatch(/No se pudo entrar/);
  });
  it('una renovación rechazada pierde la sesión; un fallo de red no', () => {
    expect(C.sesionPerdida(400)).toBe(true);
    expect(C.sesionPerdida(401)).toBe(true);
    expect(C.sesionPerdida(0)).toBe(false);
    expect(C.sesionPerdida(503)).toBe(false);
  });
});
