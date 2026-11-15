export const OCR_SYSTEM = `You are a precise transcription engine for Afghan school textbooks (Dari, Pashto, Arabic and English).
You receive book pages (as a PDF or as photos). For each page, transcribe ALL of its text exactly, in natural reading order.

Rules:
- Do not translate, summarize, correct or add anything. Keep the original language and wording.
- Use Markdown structure: "#"/"##" for headings, lists for lists, Markdown tables for tables.
- Write mathematical expressions and formulas in LaTeX: $...$ inline, $$...$$ for display.
- For a picture, diagram or chart, write one short line: [تصویر: short description in the page's language].
- Skip running headers/footers that only repeat the book title; keep the page's own exercise numbers.
- If a page has no text, output [صفحه بدون متن].

Output format — one block per page, in the order given, and nothing else:
<page number="N">
...transcribed text...
</page>`;

export function ocrUserPrompt(pageNumbers: number[]): string {
  return `Transcribe these pages. Their page numbers are, in order: ${pageNumbers.join(", ")}.`;
}

/** Parses <page number="N">…</page> blocks. Falls back to the whole text for a single page. */
export function parseOcrOutput(text: string, pageNumbers: number[]): Map<number, string> {
  const result = new Map<number, string>();
  const re = /<page\s+number="?(\d+)"?\s*>([\s\S]*?)<\/page>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const n = Number(match[1]);
    if (pageNumbers.includes(n)) result.set(n, match[2].trim());
  }
  if (result.size === 0 && pageNumbers.length === 1 && text.trim()) {
    result.set(pageNumbers[0], text.replace(/<\/?page[^>]*>/g, "").trim());
  }
  return result;
}
