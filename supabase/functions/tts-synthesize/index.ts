// Edge Function «tts-synthesize»: proxy de servidor autenticado para Google Cloud Text-to-Speech.
// Exige JWT válido de Supabase Auth, restringe origen CORS y aplica límite de peticiones por usuario.
// Despliegue (CON verificación JWT por defecto de Supabase):
//   supabase secrets set GCLOUD_TTS_KEY="tu_nueva_clave"
//   supabase functions deploy tts-synthesize

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://afc1204-coder.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

// Límite sencillo en memoria por instancia: máx. 20 llamadas cada 10 min por usuario
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_CALLS = 20;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(userId);
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_CALLS) return false;
  entry.count += 1;
  return true;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://afc1204-coder.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: 'Origen no permitido' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers });
  }

  // Verificar JWT de usuario autenticado en Supabase
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Falta token de autorización' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  if (!checkRateLimit(user.id)) {
    return new Response(JSON.stringify({ error: 'Límite de uso temporal alcanzado' }), {
      status: 429,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('GCLOUD_TTS_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GCLOUD_TTS_KEY no configurada' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const ssml = typeof body?.ssml === 'string' ? body.ssml : null;
    if (!ssml || ssml.length > 6000) {
      return new Response(JSON.stringify({ error: 'SSML inválido o demasiado largo' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: { languageCode: 'es-ES', name: 'es-ES-Journey-D' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: -1.0 },
        }),
      },
    );

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
