import type Anthropic from "@anthropic-ai/sdk";
import { OCR_SYSTEM, ocrUserPrompt, parseOcrOutput } from "@/lib/prompts/ocr";
import { getAnthropic, hasApiKey, isMockMode } from "./anthropic";
import { assertBookBudget, bookBudgetUsd, BudgetExceededError, recordUsage } from "./budget";

/**
 * Reading book pages with Claude (scanned, broken or reversed pages) costs
 * credits, so it is OFF unless AI_BOOK_READING=1 and the book budget is positive.
 * When off, only the free text
 * inside the PDF is saved and those pages are skipped.
 */
export function aiBookReadingEnabled(): boolean {
  return process.env.AI_BOOK_READING === "1" && bookBudgetUsd() > 0;
}

/** Model that reads scanned pages (at most Claude Sonnet 4.6; OCR_MODEL can choose a cheaper one). */
export function ocrModel(): string {
  return process.env.OCR_MODEL || "claude-sonnet-4-6";
}

export class NoApiKeyError extends Error {
  constructor() {
    super("کلید API تنظیم نشده است؛ صفحات اسکن‌شده خوانده نمی‌شوند.");
    this.name = "NoApiKeyError";
  }
}

/**
 * Reads book pages with Claude. `pdfBase64` is a small PDF that contains exactly
 * `pageNumbers` (in that order); Claude sees both the text and the page images,
 * so scanned and badly encoded pages work too.
 */
export async function readPagesWithClaude(pdfBase64: string, pageNumbers: number[]): Promise<Map<number, string>> {
  // Enforce this here too: queued workers and manual rereads share this entry point.
  if (!aiBookReadingEnabled()) throw new BudgetExceededError();
  if (isMockMode()) {
    return new Map(pageNumbers.map((n) => [n, `## صفحه ${n}\n\n[متن نمونه: در حالت آزمایشی، هوش مصنوعی این صفحه را نخواند.]`]));
  }
  if (!hasApiKey()) throw new NoApiKeyError();
  await assertBookBudget();
  const model = ocrModel();

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
    {
      type: "text",
      text: `${ocrUserPrompt(pageNumbers)}\nThe attached PDF contains only these pages, in this order.`,
    },
  ];
  const stream = getAnthropic().beta.messages.stream({
    model,
    max_tokens: 32000,
    system: OCR_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low" },
  });
  const message = await stream.finalMessage();
  await recordUsage("book", model, message.usage);
  if (message.stop_reason === "refusal") {
    return new Map(pageNumbers.map((n) => [n, "[این صفحه خوانده نشد]"]));
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseOcrOutput(text, pageNumbers);
}
