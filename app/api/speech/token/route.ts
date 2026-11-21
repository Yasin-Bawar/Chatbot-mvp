/**
 * Which voice the teachers use. With AZURE_SPEECH_KEY and AZURE_SPEECH_REGION
 * set, it hands the browser a 10-minute Azure Speech token (the key itself
 * never leaves the server). Otherwise the browser's own speech is used.
 */

import { connection } from "next/server";

export async function GET() {
  await connection(); // a fresh token every time, never cached
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) return Response.json({ provider: "browser" }, { headers: { "Cache-Control": "no-store" } });
  try {
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" },
    });
    if (!res.ok) throw new Error(`issueToken ${res.status}`);
    const token = await res.text();
    return Response.json(
      { provider: "azure", token, region, voice: process.env.AZURE_SPEECH_VOICE?.trim() || "fa-IR-DilaraNeural" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[speech] Azure token failed; falling back to the browser voice", err);
    return Response.json({ provider: "browser", warning: "azure_failed" }, { headers: { "Cache-Control": "no-store" } });
  }
}
