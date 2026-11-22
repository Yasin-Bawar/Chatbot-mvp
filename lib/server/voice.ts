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

/** Dari text → MP3 audio (a streaming response body). */
export async function synthesize(text: string, signal?: AbortSignal): Promise<Response> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new VoiceError("صدای معلم تنظیم نشده است.", 503);
  // A ready-made voice every account has (Sarah); change it with ELEVENLABS_VOICE_ID.
  const voice = env("ELEVENLABS_VOICE_ID") || "EXAVITQu4vr4xnSDxMaL";
  const model = env("ELEVENLABS_MODEL") || "eleven_v3";
  const res = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("[voice] ElevenLabs TTS failed", res.status, detail.slice(0, 400));
    if (res.status === 401) throw new VoiceError("کلید ElevenLabs درست نیست.", 502);
    if (res.status === 402 || /quota|credits/i.test(detail)) throw new VoiceError("اعتبار صدای ElevenLabs تمام شده است.", 502);
    throw new VoiceError("صدای معلم ساخته نشد.", 502);
  }
  return res;
}

/** Recorded speech (webm/ogg/mp4) → text, in Persian. */
export async function transcribe(audio: Blob, filename: string, signal?: AbortSignal): Promise<string> {
  const { listen } = voiceConfig();
  if (!listen) throw new VoiceError("شنیدن صدا تنظیم نشده است.", 503);
  const form = new FormData();
  form.append("file", audio, filename);
  let res: Response;
  if (listen === "groq") {
    form.append("model", env("GROQ_STT_MODEL") || "whisper-large-v3-turbo");
    form.append("language", "fa");
    form.append("response_format", "json");
    res = await fetch(`${GROQ}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("GROQ_API_KEY")}` },
      body: form,
      signal,
    });
  } else {
    form.append("model_id", env("ELEVENLABS_STT_MODEL") || "scribe_v1");
    form.append("language_code", "fa");
    res = await fetch(`${ELEVEN}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
      body: form,
      signal,
    });
  }
  if (!res.ok) {
    console.error(`[voice] ${listen} STT failed`, res.status, (await res.text().catch(() => "")).slice(0, 400));
    throw new VoiceError("صدای شما به متن تبدیل نشد.", 502);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
