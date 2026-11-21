/**
 * Voice teachers on the «معلم‌ها» page. Each subject gets its own teacher; only
 * the math teacher is ready for now.
 */

export type TeacherId = "math" | "physics" | "chemistry" | "biology" | "english" | "dari";

export interface Teacher {
  id: TeacherId;
  subject: string;
  /** What the student sees and hears. */
  name: string;
  intro: string;
  color: string;
  ready: boolean;
}

export const TEACHERS: Teacher[] = [
  {
    id: "math",
    subject: "ریاضی",
    name: "معلم ریاضی",
    intro: "با صدا سوال بپرسید؛ معلم جواب می‌دهد و روی تخته حل می‌کند.",
    color: "#4F46E5",
    ready: true,
  },
  { id: "physics", subject: "فزیک", name: "معلم فزیک", intro: "به زودی", color: "#0EA5E9", ready: false },
  { id: "chemistry", subject: "کیمیا", name: "معلم کیمیا", intro: "به زودی", color: "#7C3AED", ready: false },
  { id: "biology", subject: "بیولوژی", name: "معلم بیولوژی", intro: "به زودی", color: "#16A34A", ready: false },
  { id: "english", subject: "انگلیسی", name: "معلم انگلیسی", intro: "به زودی", color: "#F59E0B", ready: false },
  { id: "dari", subject: "دری", name: "معلم دری", intro: "به زودی", color: "#EF4444", ready: false },
];

export function teacherById(id: string | null | undefined): Teacher | null {
  return TEACHERS.find((t) => t.id === id && t.ready) ?? null;
}
