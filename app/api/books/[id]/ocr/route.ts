import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { OCR_SYSTEM, ocrUserPrompt, parseOcrOutput } from "@/lib/prompts/ocr";
import { FALLBACK_BETA, friendlyError, getAnthropic, hasApiKey, isMockMode } from "@/lib/server/anthropic";
import { getBook, upsertPages, type PageRow } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";

export const maxDuration = 300;

const BodySchema = z.object({
  pages: z
    .array(
      z.object({
        pageNumber: z.number().int().min(1),
        image: z.string().min(100), // base64 JPEG, no data: prefix
      }),
    )
    .min(1)
    .max(3),
});

/** Reads scanned / badly-encoded pages with Claude vision and stores their text. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/ocr">) {
  const { id } = await ctx.params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });

  try {
    const book = await getBook(id);
    if (!book) return Response.json({ error: "not_found" }, { status: 404 });
  } catch (err) {
    return apiError(err);
  }

  const numbers = parsed.data.pages.map((p) => p.pageNumber);
  let texts: Map<number, string>;

  if (isMockMode()) {
    texts = new Map(numbers.map((n) => [n, `## صفحه ${n}\n\n[متن نمونه: در حالت آزمایشی، هوش مصنوعی این صفحه را نخواند.]`]));
  } else if (!hasApiKey()) {
    return Response.json({ error: "no_api_key", message: "کلید API تنظیم نشده است." }, { status: 503 });
  } else {
    try {
      const client = getAnthropic();
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      for (const page of parsed.data.pages) {
        content.push({ type: "text", text: `Page ${page.pageNumber}:` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: page.image } });
      }
      content.push({ type: "text", text: ocrUserPrompt(numbers) });

      const stream = client.beta.messages.stream({
        model: process.env.OCR_MODEL || "claude-opus-5-5",
        max_tokens: 32000,
        system: OCR_SYSTEM,
        messages: [{ role: "user", content }],
        output_config: { effort: "low" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      });
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        texts = new Map(numbers.map((n) => [n, "[این صفحه خوانده نشد]"]));
      } else {
        const text = message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        texts = parseOcrOutput(text, numbers);
      }
    } catch (err) {
      console.error("ocr error", err);
      return Response.json({ error: "ocr_failed", message: friendlyError(err) }, { status: 502 });
    }
  }

  const rows: PageRow[] = numbers
    .filter((n) => texts.has(n))
    .map((n) => ({ pageNumber: n, content: texts.get(n)!, method: "ai" as const }));
  try {
    await upsertPages(id, rows);
  } catch (err) {
    return apiError(err);
  }
  return Response.json({ pages: rows.map((r) => ({ pageNumber: r.pageNumber, content: r.content })) });
}
