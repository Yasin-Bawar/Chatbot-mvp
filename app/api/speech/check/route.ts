import { connection } from "next/server";
import { checkVoice } from "@/lib/server/voice";

/** Open /api/speech/check in the browser to see whether the voice keys work (and why not). */
export async function GET() {
  await connection();
  return Response.json(await checkVoice(), { headers: { "Cache-Control": "no-store" } });
}
