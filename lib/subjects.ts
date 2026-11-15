import { normalizeFa, toLatinDigits } from "@/lib/persian";

/** Subjects of the Afghan school curriculum, with a cover gradient for book cards. */
export const SUBJECTS = [
  { id: "riazi", name: "ریاضی", from: "#4F46E5", to: "#818CF8" },
  { id: "physics", name: "فزیک", from: "#0EA5E9", to: "#67E8F9" },
  { id: "chemistry", name: "کیمیا", from: "#10B981", to: "#6EE7B7" },
  { id: "biology", name: "بیولوژی", from: "#22C55E", to: "#BEF264" },
  { id: "dari", name: "دری", from: "#F59E0B", to: "#FCD34D" },
  { id: "pashto", name: "پښتو", from: "#EF4444", to: "#FCA5A5" },
  { id: "english", name: "انگلیسی", from: "#6366F1", to: "#C4B5FD" },
  { id: "history", name: "تاریخ", from: "#B45309", to: "#FDBA74" },
  { id: "geography", name: "جغرافیه", from: "#0D9488", to: "#5EEAD4" },
  { id: "islamic", name: "تعلیمات اسلامی", from: "#15803D", to: "#86EFAC" },
  { id: "civics", name: "تعلیمات مدنی", from: "#7C3AED", to: "#F0ABFC" },
  { id: "computer", name: "کمپیوتر", from: "#334155", to: "#94A3B8" },
  { id: "other", name: "سایر", from: "#64748B", to: "#CBD5E1" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export function subjectById(id: string | null | undefined) {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[SUBJECTS.length - 1];
}

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
/* ---------- guessing subject / grade from a PDF file name (bulk upload) ---------- */


/** Keywords per subject, matched against the normalized file name (Dari, Pashto, Latin). */
const SUBJECT_KEYWORDS: [SubjectId, string[]][] = [
  ["islamic", ["تعلیم و تربیه", "تعلیمات اسلامی", "اسلامی", "قران", "تفسیر", "عقاید", "فقه", "حدیث", "تجوید", "سیرت", "islamic", "tafseer", "tafsir", "quran", "aqaid", "fiqh", "hadith"]],
  ["riazi", ["ریاضی", "riazi", "riyazi", "math"]],
  ["physics", ["فزیک", "فیزیک", "physics", "fizik", "physic"]],
  ["chemistry", ["کیمیا", "شیمی", "chemistry", "kimia", "chemi"]],
  ["biology", ["بیولوژی", "بیالوژی", "biology", "bio"]],
  ["english", ["انگلیسی", "english", "eng "]],
  ["pashto", ["پښتو", "پشتو", "pashto", "pashtu", "pushto"]],
  ["dari", ["دری", "dari"]],
  ["history", ["تاریخ", "history", "tarikh"]],
  ["geography", ["جغرافیه", "جغرافیا", "geography", "jografia", "geo"]],
  ["civics", ["مدنی", "ثقافت", "civic", "culture", "calture", "saqafat"]],
  ["computer", ["کمپیوتر", "کامپیوتر", "computer", "it "]],
];

/** "کتاب فزیک صنف یازدهم.pdf" → "physics"; null when nothing matches. */
export function guessSubject(fileName: string): SubjectId | null {
  const name = ` ${normalizeFa(fileName).replace(/[_\-.()[\]]+/g, " ")} `;
  for (const [id, words] of SUBJECT_KEYWORDS) {
    if (words.some((w) => name.includes(normalizeFa(w)))) return id;
  }
  return null;
}

// Dari and Pashto ordinals, longest first so "یازدهم" wins over "دهم".
const ORDINALS: [string, number][] = [
  ["دوازدهم", 12],
  ["یازدهم", 11],
  ["دولسم", 12],
  ["یوولسم", 11],
  ["لسم", 10],
  ["دهم", 10],
  ["نهم", 9],
  ["هشتم", 8],
  ["اتم", 8],
  ["هفتم", 7],
  ["اووم", 7],
  ["ششم", 6],
  ["پنجم", 5],
  ["چهارم", 4],
  ["سوم", 3],
  ["دوم", 2],
  ["اول", 1],
];

/** "صنف یازدهم", "grade 11", "G11", "۱۱" → 11; null when no grade is found. */
export function guessGrade(fileName: string): number | null {
  const name = toLatinDigits(normalizeFa(fileName)).replace(/[_\-.()[\]]+/g, " ");
  const valid = (n: number) => (n >= 1 && n <= 12 ? n : null);

  const afterWord = name.match(/(?:صنف|ټولګی|ټولگی|grade|class|g)\s*(\d{1,2})(?!\d)/);
  if (afterWord) return valid(Number(afterWord[1]));

  for (const [word, n] of ORDINALS) {
    if (new RegExp(`(?:صنف|ټولګی|ټولگی)\\s*${word}`).test(name)) return n;
  }
  for (const [word, n] of ORDINALS.slice(0, 2)) {
    if (name.includes(word)) return n; // "یازدهم"/"دوازدهم" are unambiguous on their own
  }

  const lone = name.match(/(?:^|[^\d])(1[0-2]|[1-9])(?:[^\d]|$)/);
  return lone ? valid(Number(lone[1])) : null;
}

/** File name → readable book title (drops extension, separators and download-site noise). */
export function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_]+|(?<=\S)-(?=\S)/g, " ")
    .replace(/\b(pdf|maktab93|banfes|download|ddl)\b/gi, " ")
    .replace(/(دانلود|پی دی اف|کتاب درسی مکتب)/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–|]+|[\s\-–|]+$/g, "")
    .trim();
}
