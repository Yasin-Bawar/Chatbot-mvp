import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { LIGHT_MODEL } from "@/lib/models";
import { getAnthropic, hasApiKey, isMockMode } from "@/lib/server/anthropic";
import { assertBudget, recordUsage } from "@/lib/server/budget";

const BodySchema = z.object({
  user: z.string().max(4000),
  assistant: z.string().max(4000).default(""),
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
    // Titles always use the cheapest model.
    await assertBudget();
    const response = await getAnthropic().messages.create({
      model: LIGHT_MODEL,
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
    await recordUsage("title", LIGHT_MODEL, response.usage);
    if (response.stop_reason === "refusal") return Response.json({ title: fallbackTitle(user) });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .replace(/["«»]/g, "")
      .trim();
    return Response.json({ title: text ? text.slice(0, 60) : fallbackTitle(user) });
  } catch (err) {
    if (!(err instanceof Error && err.name === "BudgetExceededError")) console.error("title error", err);
    return Response.json({ title: fallbackTitle(user) });
  }
}
