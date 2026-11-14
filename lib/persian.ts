/**
 * Farsi / Dari / Pashto text helpers used by search (server) and by the
 * PDF quality checks and UI (browser). No locale-dependent APIs are used,
 * so results are identical everywhere.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 123 → ۱۲۳ (for UI labels). */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** ۱۲۳ / ١٢٣ → 123 */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

// Arabic diacritics (tashkeel), superscript alef, Quranic marks.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩﻿]/g; // incl. ZWNJ (200C), ZWJ, bidi marks

/**
 * Canonical form used for indexing and querying.
 * - NFKC folds Arabic presentation forms (common in PDFs) to base letters.
 * - Unifies Arabic/Persian letter variants and digits.
 * - Removes diacritics, tatweel and zero-width characters (ZWNJ joins the word:
 *   "کتاب‌ها" → "کتابها").
 */
export function normalizeFa(input: string): string {
  return toLatinDigits(
    input
      .normalize("NFKC")
      .replace(ZERO_WIDTH, "")
      .replace(DIACRITICS, "")
      .replace(TATWEEL, "")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ة/g, "ه")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ۀ/g, "ه"),
  ).toLowerCase();
}

/** Very common Dari/Persian function words that carry no search meaning. */
export const STOPWORDS = new Set(
  [
    "و", "در", "به", "از", "که", "را", "این", "آن", "ان", "با", "است", "برای", "یک", "تا",
    "می", "هم", "بر", "یا", "اما", "اگر", "پس", "نیز", "شد", "شده", "شود", "بود", "باشد",
    "کرد", "کند", "کنید", "کردن", "دارد", "هست", "هستند", "ها", "های", "او", "ما", "شما",
    "من", "تو", "ایشان", "آنها", "انها", "اینها", "چه", "چرا", "چگونه", "چطور", "کدام",
    "را", "خود", "هر", "همه", "دیگر", "بین", "روی", "زیر", "پیش", "بعد", "قبل", "باید",
    "میشود", "میکند", "میباشد", "نمی", "نه", "بله", "توضیح", "بده", "بدهید", "لطفا",
    "the", "a", "an", "of", "and", "or", "to", "in", "is", "are", "for", "on", "what",
  ].map((w) => normalizeFa(w)),
);

// [suffix, minimum stem length]. "ان"/"ات" are ambiguous (ایران، حیات), so they need longer stems.
const SUFFIXES: [string, number][] = [
  ["هایی", 3],
  ["های", 3],
  ["ها", 3],
  ["ات", 4],
  ["ان", 4],
];

/** Light stemming: strips common plural suffixes ("برگ‌ها" → "برگ"). */
export function stemFa(token: string): string {
  if (!/[؀-ۿ]/.test(token)) return token;
  for (const [suffix, minStem] of SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= minStem) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

/** Splits text into normalized, stemmed search terms (stopwords removed). */
export function tokenizeFa(input: string): string[] {
  const normalized = normalizeFa(input);
  const raw = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  for (const token of raw) {
    if (token.length < 2 && !/^\d+$/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    out.push(stemFa(token));
  }
  return out;
}

/** Unique terms of a query, longest first. */
export function queryTerms(query: string): string[] {
  return [...new Set(tokenizeFa(query))].sort((a, b) => b.length - a.length).slice(0, 16);
}

/** True when text is mostly written in Arabic script (Dari/Pashto). */
export function isMostlyArabicScript(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return false;
  const arabic = text.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g)?.length ?? 0;
  return arabic / letters > 0.5;
}

/** Paragraph direction by majority script: English lines read LTR, Dari/Pashto RTL. */
export function textDirection(text: string): "rtl" | "ltr" {
  let arabic = 0;
  let latin = 0;
  for (const ch of text) {
    if (/[؀-ۿݐ-ݿ]/.test(ch)) arabic++;
    else if (/[A-Za-z]/.test(ch)) latin++;
  }
  return latin > arabic * 1.5 ? "ltr" : "rtl";
}
