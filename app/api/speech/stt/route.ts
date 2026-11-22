import { transcribe, VoiceError } from "@/lib/server/voice";

/** What the student said (recorded audio) → text (Groq Whisper or ElevenLabs Scribe). */

export const maxDuration = 30;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "invalid_input" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  const type = audio.type || "audio/webm";
  const ext = type.includes("ogg")
    ? "ogg"
    : type.includes("mp4") || type.includes("aac")
      ? "m4a"
      : type.includes("wav")
        ? "wav"
        : "webm";
  try {
    const text = await transcribe(audio, `speech.${ext}`, req.signal);
    return Response.json({ text });
  } catch (err) {
    if (err instanceof VoiceError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[stt]", err);
    return Response.json({ error: "صدای شما به متن تبدیل نشد." }, { status: 502 });
  }
}
