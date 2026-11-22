import { z } from "zod";
import { synthesize, VoiceError } from "@/lib/server/voice";

/** One sentence of the teacher → MP3 (ElevenLabs). */

const BodySchema = z.object({ text: z.string().min(1).max(600) });

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    const audio = await synthesize(parsed.data.text, req.signal);
    return new Response(audio.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof VoiceError) return Response.json({ error: err.message }, { status: err.status });
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("[tts]", err);
    return Response.json({ error: "صدای معلم ساخته نشد." }, { status: 502 });
  }
}
