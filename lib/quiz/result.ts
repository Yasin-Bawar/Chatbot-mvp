import { toFaDigits } from "@/lib/persian";
import type { Quiz, QuizResult } from "./types";

/** answers[i] = chosen option index for question i (first attempt). */
export function buildResult(quiz: Quiz, answers: number[], seconds: number, bestStreak: number): QuizResult {
  const mistakes = quiz.questions
    .map((q, i) => ({ q, chosen: answers[i] }))
    .filter(({ q, chosen }) => chosen !== q.answer)
    .map(({ q, chosen }) => ({
      q: q.q,
      mine: chosen === undefined || chosen < 0 ? "—" : q.options[chosen] ?? "—",
      right: q.options[q.answer],
    }));
  return {
    title: quiz.title?.replace(/^آزمونک[:：]\s*/, "") || "آزمونک",
    correct: quiz.questions.length - mistakes.length,
    total: quiz.questions.length,
    seconds: Math.max(0, Math.round(seconds)),
    bestStreak,
    mistakes,
  };
}

export function percent(result: Pick<QuizResult, "correct" | "total">): number {
  return result.total ? Math.round((result.correct / result.total) * 100) : 0;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return toFaDigits(`${m}:${String(s).padStart(2, "0")}`);
}

/** The Dari message sent to Dana after the exam. */
export function resultMessage(result: QuizResult): string {
  const lines = [
    `📝 نتیجه آزمونک «${result.title}»: ${toFaDigits(result.correct)} از ${toFaDigits(result.total)} (${toFaDigits(percent(result))}٪)`,
    `⏱ زمان: ${formatDuration(result.seconds)}`,
  ];
  if (result.mistakes.length === 0) {
    lines.push("", "همه سوال‌ها را درست جواب دادم! 🎉 لطفاً یک آزمونک کمی سخت‌تر بده.");
  } else {
    lines.push("", "❌ سوال‌هایی که اشتباه کردم:");
    result.mistakes.forEach((m, i) => {
      lines.push(`${toFaDigits(i + 1)}. ${m.q}`, `   جواب من: ${m.mine} — جواب درست: ${m.right}`);
    });
    lines.push("", "لطفاً اشتباهاتم را ساده توضیح بده و بگو کدام قسمت درس را دوباره بخوانم.");
  }
  return lines.join("\n");
}
