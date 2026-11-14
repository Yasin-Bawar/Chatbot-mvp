/**
 * Decides whether text extracted from a PDF page is usable, or whether the page
 * should be read by Claude (scanned image, broken font encoding, reversed text).
 * Pure functions — unit tested in tests/quality.test.ts.
 */

export type PageIssue = "empty" | "garbled" | "reversed" | "fragmented";

export interface PageQuality {
  ok: boolean;
  issue?: PageIssue;
}

// Frequent Dari/Persian words that are not palindromes (so reversal is detectable).
const COMMON_WORDS = new Set([
  "از", "به", "در", "که", "را", "این", "است", "با", "برای", "یک", "آن", "هم", "شده", "شود",
  "کند", "می", "های", "ها", "اند", "بود", "باشد", "دارد", "میشود", "نیز", "تا", "اگر", "پس",
  "یا", "خود", "هر", "کتاب", "درس", "سوال", "شکل", "مثال", "تمرین", "فصل",
]);

const ARABIC_LETTER = /[؀-ۿݐ-ݿ]/;

function cleanForWords(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}

/** Typical Dari word shapes: verb prefix "می", plural "ها/های", verb ending "ند". */
function affixScore(words: string[]): number {
  let score = 0;
  for (const w of words) {
    if (w.length < 4) continue;
    if (w.startsWith("می") || w.endsWith("ها") || w.endsWith("های") || w.endsWith("ند")) score++;
  }
  return score;
}

function commonWordScore(words: string[]): number {
  let score = 0;
  for (const w of words) if (COMMON_WORDS.has(w)) score++;
  return score;
}

export function assessPageText(raw: string, opts: { expectArabicScript?: boolean } = {}): PageQuality {
  const expectArabic = opts.expectArabicScript ?? true;
  const text = raw.normalize("NFKC");
  const visible = text.replace(/\s+/g, "");

  if (visible.length < 40) return { ok: false, issue: "empty" };

  // Private-use glyphs, replacement chars, control chars and Latin-1 mojibake ("Ø§Ù").
  const bad =
    (text.match(/[-�\u0000-\u0008\u000E-\u001F]/g)?.length ?? 0) +
    (text.match(/[À-ÿ][\u0080-ÿ]/g)?.length ?? 0) * 2;
  if (bad / visible.length > 0.06) return { ok: false, issue: "garbled" };

  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const arabicLetters = [...text].filter((c) => ARABIC_LETTER.test(c)).length;

  if (expectArabic && letters > 80 && arabicLetters / letters < 0.25) {
    // A Dari/Pashto book page whose "text" is mostly Latin letters: custom font encoding.
    return { ok: false, issue: "garbled" };
  }

  if (arabicLetters > 60) {
    const words = cleanForWords(text)
      .split(/[^\p{L}]+/u)
      .filter((w) => w && ARABIC_LETTER.test(w));

    // Letters split apart by spaces ("ک ت ا ب").
    const avgLen = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length);
    if (words.length > 20 && avgLen < 1.8) return { ok: false, issue: "fragmented" };

    // Visual-order (reversed) text: common words and affixes ("می…", "…ها", "…ند")
    // show up mirrored ("…یم", "اه…", "دن…").
    const normal = commonWordScore(words) + affixScore(words);
    const mirrored = words.map((w) => [...w].reverse().join(""));
    const reversed = commonWordScore(mirrored) + affixScore(mirrored);
    if (reversed >= 4 && reversed > normal * 1.5) return { ok: false, issue: "reversed" };
  }

  return { ok: true };
}

/** Basic cleanup of extracted text before storing it. */
export function cleanExtractedText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000E-\u001F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
