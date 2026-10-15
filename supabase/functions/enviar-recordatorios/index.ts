// Edge Function «enviar-recordatorios»: la llama pg_cron cada 15 min (ver supabase/push_cron.sql).
// Decide a quién toca avisar (logica.js, con tests), envía Web Push y deja constancia en push_avisos.
// Secretos (Vault de Supabase, nombres: vapid_publica, vapid_privada, vapid_subject, cron_secret):
// se leen con la función SQL push_secreto(), que solo puede ejecutar service_role. Respaldo: variables de entorno.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { debeAvisar, diaLogico, evaluarAviso, actualizarContadores, textoAviso, MAX_IGNORADOS } from './logica.js';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function secreto(nombre: string): Promise<string | null> {
  const { data } = await db.rpc('push_secreto', { nombre });
  return (data as string | null) ?? Deno.env.get(nombre.toUpperCase()) ?? null;
}

Deno.serve(async (req) => {
  const esperado = await secreto('cron_secret');
  if (!esperado || req.headers.get('x-cron-secret') !== esperado) {
    return new Response('no autorizado', { status: 401 });
  }
  const [pub, priv, subject] = await Promise.all([secreto('vapid_publica'), secreto('vapid_privada'), secreto('vapid_subject')]);
  if (!pub || !priv) return new Response('faltan las claves VAPID', { status: 500 });
  webpush.setVapidDetails(subject ?? 'https://afc1204-coder.github.io/Mf/', pub, priv);
  const dryRun = new URL(req.url).searchParams.get('dry') === '1';   // ?dry=1: decide, no envía
  const ahora = new Date();
  const hoy = diaLogico(ahora);
  const informe: Record<string, unknown>[] = [];

  const { data: subs, error } = await db.from('push_suscripciones').select('*').eq('activo', true);
  if (error) return new Response(error.message, { status: 500 });

  for (const s of subs ?? []) {
    // 1) Evaluar avisos anteriores aún sin evaluar (¿hubo sesión ese día? ¿en < 2 h?)
    const { data: pend } = await db.from('push_avisos').select('*')
      .eq('suscripcion_id', s.id).eq('evaluado', false).lt('dia', hoy).order('enviado');
    let cont = { ignorados: s.avisos_ignorados as number, frecuencia: s.frecuencia as string };
    for (const a of pend ?? []) {
      const { data: ev } = await db.from('eventos').select('ts')
        .eq('usuario_id', s.usuario_id).eq('dia', a.dia).eq('tipo', 'sesion_cerrada');
      const r = evaluarAviso({ enviado: a.enviado, sesiones: (ev ?? []).map((e) => e.ts) });
      const nuevo = actualizarContadores(cont, r.respondido);
      cont = nuevo;
      if (!dryRun) await db.from('push_avisos').update({ evaluado: true, respondido: r.respondido, sesion_en_2h: r.en2h }).eq('id', a.id);
    }
    if (!dryRun && (cont.ignorados !== s.avisos_ignorados || cont.frecuencia !== s.frecuencia)) {
      await db.from('push_suscripciones').update({ avisos_ignorados: cont.ignorados, frecuencia: cont.frecuencia, actualizada: ahora.toISOString() }).eq('id', s.id);
    }

    // 2) ¿Toca avisar hoy?
    const { data: ult } = await db.from('push_avisos').select('dia,enviado').eq('suscripcion_id', s.id)
      .order('enviado', { ascending: false }).limit(1);
    const { data: hecha } = await db.from('eventos').select('id').eq('usuario_id', s.usuario_id)
      .eq('dia', hoy).eq('tipo', 'sesion_cerrada').limit(1);
    const dec = debeAvisar({
      ahora, hora: s.hora, frecuencia: cont.frecuencia,
      ultimoAvisoDia: ult?.[0]?.dia ?? null, ultimoAvisoEn: ult?.[0]?.enviado ?? null,
      sesionHechaHoy: (hecha ?? []).length > 0,
    });
    if (!dec.ok) { informe.push({ id: s.id, enviado: false, motivo: dec.motivo }); continue; }
    if (dryRun) { informe.push({ id: s.id, enviado: false, motivo: 'tocaria' }); continue; }

    // 3) Enviar
    const { data: aviso } = await db.from('push_avisos')
      .insert({ suscripcion_id: s.id, dia: hoy, leccion_id: s.proxima_leccion_id }).select('id').single();
    // El primer aviso semanal (3 ignorados, aún sin evaluar) explica el cambio una sola vez.
    const nota = cont.frecuencia === 'semanal' && cont.ignorados === MAX_IGNORADOS ? 'semanal' : null;
    const { title, body } = textoAviso({ idea: s.proxima_idea, titulo: s.proxima_titulo, nota });
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, tag: 'scs-diario', url: `/Mf/?aviso=${aviso!.id}` }),
        { TTL: 6 * 3600, urgency: 'low' },
      );
      informe.push({ id: s.id, enviado: true });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {          // la suscripción ya no existe (app desinstalada, permiso retirado)
        await db.from('push_suscripciones').update({ activo: false }).eq('id', s.id);
        await db.from('push_avisos').delete().eq('id', aviso!.id);
      }
      informe.push({ id: s.id, enviado: false, motivo: `error_push_${code ?? 'desconocido'}` });
    }
  }
  return Response.json({ hoy, informe });
});
