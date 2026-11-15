import { parseLooseJson } from "@/lib/json-repair";
import type { Quiz } from "./types";

/** Parses a ```quiz block. Questions with missing options or an invalid answer index are dropped. */
export function parseQuiz(raw: string): Quiz | null {
  const data = parseLooseJson<{ title?: unknown; questions?: unknown }>(raw);
  if (!data || !Array.isArray(data.questions)) return null;
  const questions = data.questions
    .filter((q): q is Record<string, unknown> => Boolean(q) && typeof q === "object")
    .map((q) => ({
      q: typeof q.q === "string" ? q.q : "",
      options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string") : [],
      answer: typeof q.answer === "number" ? q.answer : Number.NaN,
      explain: typeof q.explain === "string" && q.explain.trim() ? q.explain : undefined,
    }))
    .filter((q) => q.q.trim() && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
  if (!questions.length) return null;
  return { title: typeof data.title === "string" && data.title.trim() ? data.title : undefined, questions };
}
