/**
 * Server-side voice for the teachers. Keys stay on the server; the browser only
 * calls /api/speech/tts and /api/speech/stt.
 *
 * - Speaking: ElevenLabs (ELEVENLABS_API_KEY). Its v3 model speaks Persian.
 * - Listening: Groq Whisper (GROQ_API_KEY: free tier, fast, cheap), or
 *   ElevenLabs Scribe with the same ElevenLabs key.
 */

const ELEVEN = "https://api.elevenlabs.io/v1";
const GROQ = "https://api.groq.com/openai/v1";

const env = (name: string) => process.env[name]?.trim() || "";

export function voiceConfig() {
  const eleven = Boolean(env("ELEVENLABS_API_KEY"));
  const groq = Boolean(env("GROQ_API_KEY"));
  return {
    speak: eleven ? ("elevenlabs" as const) : null,
    listen: groq ? ("groq" as const) : eleven ? ("elevenlabs" as const) : null,
  };
}

export class VoiceError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** ElevenLabs/Groq error body → a short readable reason (no secrets in it). */
function reason(status: number, body: string): string {
  let msg = body;
  try {
    const j = JSON.parse(body) as {
      detail?: { message?: string; status?: string } | string;
      error?: { message?: string } | string;
    };
    const d = j.detail ?? j.error;
    msg = typeof d === "string" ? d : (d?.message ?? (d as { status?: string } | undefined)?.status ?? body);
  } catch {
    // not JSON
  }
  return `${status}: ${String(msg).replace(/\s+/g, " ").slice(0, 180)}`;
}

/** A Dari hint for the usual ElevenLabs problems. */
function hint(status: number, body: string): string {
  if (status === 401) return "کلید ElevenLabs درست نیست یا این بخش (Text to Speech / Speech to Text) برایش فعال نشده است.";
  if (/missing_permissions|permission/i.test(body))
    return "کلید ElevenLabs اجازه این کار را ندارد. در ElevenLabs، برای کلید «Text to Speech» و «Speech to Text» را فعال کنید.";
  if (status === 402 || /quota|credits/i.test(body)) return "اعتبار ElevenLabs تمام شده است.";
  if (/voice.*(not.*found|does not exist)|voice_not_found/i.test(body))
    return "صدای انتخاب‌شده پیدا نشد. ELEVENLABS_VOICE_ID را بررسی کنید و صدا را به «My Voices» اضافه کنید.";
  if (/library|free.*(plan|tier)|upgrade|subscription/i.test(body))
    return "این صدا یا مدل در پلان رایگان ElevenLabs از راه API ممکن نیست.";
  return "";
}

/** Dari text → MP3 audio (a streaming response body). Tries the newest Persian-capable models in turn. */
export async function synthesize(text: string, signal?: AbortSignal): Promise<Response> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new VoiceError("صدای معلم تنظیم نشده است.", 503);
  // A ready-made voice every account has (Sarah); change it with ELEVENLABS_VOICE_ID.
  const voice = env("ELEVENLABS_VOICE_ID") || "EXAVITQu4vr4xnSDxMaL";
  const models = [...new Set([env("ELEVENLABS_MODEL"), "eleven_v3", "eleven_multilingual_v2"].filter(Boolean))];
  let last = "";
  for (const model of models) {
    const res = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model }),
      signal,
    });
    if (res.ok && res.body) return res;
    const body = await res.text().catch(() => "");
    last = reason(res.status, body);
    console.error("[voice] ElevenLabs TTS failed", model, last);
    const h = hint(res.status, body);
    // Key, credits or voice problems won't be fixed by another model.
    if (h && !/مدل/.test(h)) throw new VoiceError(`${h} (${last})`, 502);
  }
  throw new VoiceError(`صدای معلم ساخته نشد. (${last})`, 502);
}

async function elevenSTT(audio: Blob, filename: string, signal?: AbortSignal): Promise<string> {
  const models = [...new Set([env("ELEVENLABS_STT_MODEL"), "scribe_v2", "scribe_v1"].filter(Boolean))];
  // Persian as ISO 639-3, ISO 639-1, then let it detect the language.
  const attempts = models.flatMap((m) => [
    { model: m, lang: "fas" },
    { model: m, lang: "fa" },
    { model: m, lang: "" },
  ]);
  let last = "";
  for (const a of attempts) {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model_id", a.model);
    if (a.lang) form.append("language_code", a.lang);
    const res = await fetch(`${ELEVEN}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
      body: form,
      signal,
    });
    if (res.ok) return (((await res.json()) as { text?: string }).text ?? "").trim();
    const body = await res.text().catch(() => "");
    last = reason(res.status, body);
    console.error("[voice] ElevenLabs STT failed", a, last);
    const h = hint(res.status, body);
    if (h) throw new VoiceError(`${h} (${last})`, 502);
    if (res.status >= 500 || res.status === 429) break; // not a model/language problem
  }
  throw new VoiceError(`صدای شما به متن تبدیل نشد. (${last})`, 502);
}

/** Recorded speech (webm/ogg/mp4) → text, in Persian. */
export async function transcribe(audio: Blob, filename: string, signal?: AbortSignal): Promise<string> {
  const { listen } = voiceConfig();
  if (!listen) throw new VoiceError("شنیدن صدا تنظیم نشده است.", 503);
  if (listen === "elevenlabs") return elevenSTT(audio, filename, signal);
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", env("GROQ_STT_MODEL") || "whisper-large-v3-turbo");
  form.append("language", "fa");
  form.append("response_format", "json");
  const res = await fetch(`${GROQ}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("GROQ_API_KEY")}` },
    body: form,
    signal,
  });
  if (!res.ok) {
    const last = reason(res.status, await res.text().catch(() => ""));
    console.error("[voice] Groq STT failed", last);
    throw new VoiceError(`صدای شما به متن تبدیل نشد. (Groq ${last})`, 502);
  }
  return (((await res.json()) as { text?: string }).text ?? "").trim();
}

/** For /api/speech/check: try each part once and report what happened. */
export async function checkVoice(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const cfg = voiceConfig();
  out.speak = cfg.speak ?? "none (no ELEVENLABS_API_KEY)";
  out.listen = cfg.listen ?? "none (no GROQ_API_KEY or ELEVENLABS_API_KEY)";
  out.voice_id = env("ELEVENLABS_VOICE_ID") || "EXAVITQu4vr4xnSDxMaL (default)";
  if (cfg.speak) {
    try {
      const res = await synthesize("سلام");
      const bytes = (await res.arrayBuffer()).byteLength;
      out.speak_test = `OK (${bytes} bytes of audio)`;
    } catch (e) {
      out.speak_test = `FAILED: ${(e as Error).message}`;
    }
  }
  if (cfg.listen) {
    // A second of quiet audio: success means the key, model and language are accepted.
    const wav = new Uint8Array(44 + 32000);
    const v = new DataView(wav.buffer);
    const t = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    t(0, "RIFF");
    v.setUint32(4, 36 + 32000, true);
    t(8, "WAVEfmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    t(36, "data");
    v.setUint32(40, 32000, true);
    try {
      const text = await transcribe(new Blob([wav], { type: "audio/wav" }), "check.wav");
      out.listen_test = `OK (heard: "${text}")`;
    } catch (e) {
      out.listen_test = `FAILED: ${(e as Error).message}`;
    }
  }
  return out;
}
