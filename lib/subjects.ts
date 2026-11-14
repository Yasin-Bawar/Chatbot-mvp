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
