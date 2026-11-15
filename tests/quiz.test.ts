import { describe, expect, it } from "vitest";
import { parseQuiz } from "@/lib/quiz/parse";
import { buildResult, percent, resultMessage } from "@/lib/quiz/result";

const RAW = JSON.stringify({
  title: "آزمونک: سیستم هاضمه",
  questions: [
    { q: "غذا در کجا هضم می‌شود؟", options: ["معده", "قلب", "شش"], answer: 0, explain: "معده غذا را هضم می‌کند." },
    { q: "روده باریک درست است؟", options: ["درست", "نادرست"], answer: 0 },
    { q: "بی‌جواب", options: ["الف", "ب"], answer: 5 },
    { q: "", options: ["الف", "ب"], answer: 0 },
  ],
});

describe("parseQuiz", () => {
  it("keeps valid questions and drops broken ones", () => {
    const quiz = parseQuiz(RAW)!;
    expect(quiz.title).toBe("آزمونک: سیستم هاضمه");
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[1].explain).toBeUndefined();
  });

  it("repairs unescaped LaTeX backslashes", () => {
    const quiz = parseQuiz('{"questions":[{"q":"$\\frac{1}{2}$ چند است؟","options":["0.5","2"],"answer":0}]}');
    expect(quiz?.questions[0].q).toBe("$\\frac{1}{2}$ چند است؟");
  });

  it("returns null for incomplete JSON", () => {
    expect(parseQuiz('{"questions":[{"q":"a"')).toBeNull();
  });
});

describe("results", () => {
  const quiz = parseQuiz(RAW)!;

  it("lists mistakes with my answer and the right answer", () => {
    const result = buildResult(quiz, [1, 0], 75, 1);
    expect(result).toMatchObject({ title: "سیستم هاضمه", correct: 1, total: 2, seconds: 75, bestStreak: 1 });
    expect(result.mistakes).toEqual([{ q: "غذا در کجا هضم می‌شود؟", mine: "قلب", right: "معده" }]);
    expect(percent(result)).toBe(50);
    const text = resultMessage(result);
    expect(text).toContain("📝 نتیجه آزمونک «سیستم هاضمه»: ۱ از ۲ (۵۰٪)");
    expect(text).toContain("⏱ زمان: ۱:۱۵");
    expect(text).toContain("جواب من: قلب — جواب درست: معده");
  });

  it("asks for a harder quiz when everything is right", () => {
    const text = resultMessage(buildResult(quiz, [0, 0], 30, 2));
    expect(text).toContain("۲ از ۲ (۱۰۰٪)");
    expect(text).toContain("سخت‌تر");
    expect(text).not.toContain("❌");
  });
});
