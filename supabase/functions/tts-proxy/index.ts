// TTS Proxy — Supabase Edge Function
// Calls Google Cloud TTS, caches in Supabase Storage, falls back gracefully.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TTS_KEY = Deno.env.get("GOOGLE_TTS_API_KEY") || "";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "tts-audio";
const MAX_BYTES = 4800;
const DAILY_LIMIT = 20;

// Simple in-memory rate limiter (resets on cold start, ~10 min Edge Function lifespan)
const rateCounts: Record<string, { count: number; day: string }> = {};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRate(ip: string): boolean {
  const d = today();
  if (!rateCounts[ip] || rateCounts[ip].day !== d) {
    rateCounts[ip] = { count: 0, day: d };
  }
  rateCounts[ip].count++;
  return rateCounts[ip].count <= DAILY_LIMIT;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

// Split text into chunks ≤ MAX_BYTES at sentence boundaries
function chunkText(text: string): string[] {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= MAX_BYTES) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const candidate = current ? current + " " + s : s;
    if (enc.encode(candidate).length > MAX_BYTES) {
      if (current) chunks.push(current);
      // If a single sentence exceeds limit, split by words
      if (enc.encode(s).length > MAX_BYTES) {
        const words = s.split(/\s+/);
        let part = "";
        for (const w of words) {
          const next = part ? part + " " + w : w;
          if (enc.encode(next).length > MAX_BYTES) {
            if (part) chunks.push(part);
            part = w;
          } else {
            part = next;
          }
        }
        if (part) current = part;
      } else {
        current = s;
      }
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function callGoogleTTS(text: string): Promise<Uint8Array> {
  const chunks = chunkText(text);
  const audioParts: Uint8Array[] = [];

  for (const chunk of chunks) {
    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: chunk },
          voice: {
            languageCode: "es-ES",
            name: "es-ES-Neural2-A",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0,
          },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      const status = resp.status;
      // Billing/quota errors → signal fallback
      if (status === 429 || status === 403 || status >= 500) {
        throw new Error(`FALLBACK:${status}:${err}`);
      }
      throw new Error(`Google TTS error ${status}: ${err}`);
    }

    const data = await resp.json();
    const raw = atob(data.audioContent);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    audioParts.push(bytes);
  }

  // Concatenate MP3 chunks
  const totalLen = audioParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of audioParts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  try {
    const { leccion_id, text } = await req.json();

    if (!leccion_id || !text) {
      return jsonResp({ error: "leccion_id and text are required" }, 400);
    }

    if (!GOOGLE_TTS_KEY) {
      return jsonResp({ fallback: true, error: "Google TTS not configured" });
    }

    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRate(ip)) {
      return jsonResp({
        fallback: true,
        error: "Daily limit reached",
      });
    }

    const sb = createClient(SB_URL, SB_SERVICE_KEY);
    const filePath = `${leccion_id}.mp3`;

    // Check cache
    const { data: existing } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);

    if (existing?.signedUrl) {
      return jsonResp({
        url: existing.signedUrl,
        engine: "cloud",
        cached: true,
      });
    }

    // Generate audio
    const audioBytes = await callGoogleTTS(text);

    // Upload to storage
    await sb.storage.from(BUCKET).upload(filePath, audioBytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });

    // Get signed URL
    const { data: signed } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);

    return jsonResp({
      url: signed?.signedUrl || "",
      engine: "cloud",
      cached: false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("FALLBACK:")) {
      return jsonResp({ fallback: true, error: msg });
    }
    return jsonResp({ fallback: true, error: msg });
  }
});
