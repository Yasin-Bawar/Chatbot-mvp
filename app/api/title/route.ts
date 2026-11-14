import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { modelById } from "@/lib/models";
import { getAnthropic, hasApiKey, isMockMode } from "@/lib/server/anthropic";

const BodySchema = z.object({
  user: z.string().max(4000),
  assistant: z.string().max(4000).default(""),
  model: z.string().optional(),
});

function fallbackTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean || "گفتگوی تازه";
}

/** Generates a short Dari title for a new conversation. */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { user, assistant } = parsed.data;

  if (isMockMode() || !hasApiKey()) return Response.json({ title: fallbackTitle(user) });

  try {
    const response = await getAnthropic().messages.create({
      model: modelById(parsed.data.model).id,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system:
        "Write a very short title (2 to 6 words) for this school-help conversation, in the same language as the student (usually Dari). Output only the title: no quotes, no emoji, no final punctuation.",
      messages: [
        {
          role: "user",
          content: `Student: ${user.slice(0, 1500)}\n\nTeacher: ${assistant.slice(0, 800)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return Response.json({ title: fallbackTitle(user) });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .replace(/["«»]/g, "")
      .trim();
    return Response.json({ title: text ? text.slice(0, 60) : fallbackTitle(user) });
  } catch (err) {
    console.error("title error", err);
    return Response.json({ title: fallbackTitle(user) });
  }
}
