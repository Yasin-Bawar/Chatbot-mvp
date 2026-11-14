"use client";

import { Check, ListChecks, RotateCcw, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
}

interface Quiz {
  title?: string;
  questions: QuizQuestion[];
}

const LETTERS = ["الف", "ب", "ج", "د", "هـ", "و"];
const remarkPlugins = [remarkMath];
const rehypePlugins = [rehypeKatex];

function parseQuiz(raw: string): Quiz | null {
  try {
    const data = JSON.parse(raw) as Quiz;
    if (!Array.isArray(data.questions) || !data.questions.length) return null;
    const questions = data.questions.filter(
      (q) => typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer),
    );
    return questions.length ? { title: data.title, questions } : null;
  } catch {
    return null;
  }
}

/** Inline Markdown (math, bold) for question and option text. */
function Inline({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={{ p: ({ children }) => <>{children}</> }}
    >
      {text}
    </ReactMarkdown>
  );
}

export const QuizCard = memo(function QuizCard({ raw, streaming }: { raw: string; streaming: boolean }) {
  const quiz = useMemo(() => parseQuiz(raw), [raw]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [round, setRound] = useState(0);

  if (!quiz) {
    return streaming ? <QuizSkeleton /> : null;
  }

  const answered = Object.keys(picked).length;
  const correct = quiz.questions.reduce((n, q, i) => (picked[i] === q.answer ? n + 1 : n), 0);
  const finished = answered === quiz.questions.length;
  const ratio = correct / quiz.questions.length;

  return (
    <div key={round} className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-l from-[#f5f3ff] to-white px-5 py-4">
        <div className="bg-gradient-brand grid size-10 place-items-center rounded-2xl text-white shadow-md">
          <ListChecks className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-extrabold">{quiz.title || "آزمونک"}</div>
          <div className="text-xs text-muted">
            {toFaDigits(answered)} از {toFaDigits(quiz.questions.length)} سوال جواب داده شده
          </div>
        </div>
        <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[#eceaff] sm:block">
          <div
            className="bg-gradient-brand h-full rounded-full transition-all duration-500"
            style={{ width: `${(answered / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-line">
        {quiz.questions.map((question, qi) => {
          const choice = picked[qi];
          const done = choice !== undefined;
          return (
            <div key={qi} className="p-5">
              <div className="mb-3 flex items-start gap-3">
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl bg-primary-soft text-[13px] font-extrabold text-primary">
                  {toFaDigits(qi + 1)}
                </span>
                <div className="flex-1 text-[15.5px] font-semibold leading-8">
                  <Inline text={question.q} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((option, oi) => {
                  const isAnswer = oi === question.answer;
                  const isPicked = oi === choice;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={done}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-start text-[14.5px] leading-7 transition",
                        !done && "border-line bg-surface hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft/60 hover:shadow-sm",
                        done && isAnswer && "anim-pop border-success/40 bg-success-soft text-[#14532d]",
                        done && isPicked && !isAnswer && "anim-shake border-danger/40 bg-danger-soft text-[#7f1d1d]",
                        done && !isAnswer && !isPicked && "border-line bg-surface opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold transition",
                          !done && "bg-surface-2 text-ink-2 group-hover:bg-white group-hover:text-primary",
                          done && isAnswer && "bg-success text-white",
                          done && isPicked && !isAnswer && "bg-danger text-white",
                          done && !isAnswer && !isPicked && "bg-surface-2 text-muted",
                        )}
                      >
                        {done && isAnswer ? <Check className="size-4" /> : done && isPicked ? <X className="size-4" /> : LETTERS[oi]}
                      </span>
                      <span className="flex-1">
                        <Inline text={option} />
                      </span>
                    </button>
                  );
                })}
              </div>
              {done && (
                <div
                  className={cn(
                    "md-block mt-3 rounded-2xl px-4 py-3 text-[14px] leading-7",
                    choice === question.answer ? "bg-success-soft text-[#166534]" : "bg-[#fff7ed] text-[#9a3412]",
                  )}
                >
                  <span className="font-bold">{choice === question.answer ? "آفرین! درست است. " : "نزدیک بود! "}</span>
                  {question.explain ? <Inline text={question.explain} /> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {finished && (
        <div className="md-block flex flex-wrap items-center gap-3 border-t border-line bg-gradient-to-l from-[#f5f3ff] to-white px-5 py-4">
          <div className="text-2xl">{ratio === 1 ? "🏆" : ratio >= 0.6 ? "🌟" : "💪"}</div>
          <div className="flex-1">
            <div className="font-extrabold">
              نتیجه: {toFaDigits(correct)} از {toFaDigits(quiz.questions.length)}
            </div>
            <div className="text-sm text-muted">
              {ratio === 1 ? "عالی! همه جواب‌ها درست بود." : ratio >= 0.6 ? "خیلی خوب! کمی دیگر تمرین کنید." : "مهم نیست! دوباره درس را بخوانید و امتحان کنید."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPicked({});
              setRound((r) => r + 1);
            }}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            <RotateCcw className="size-4" />
            دوباره
          </button>
        </div>
      )}
    </div>
  );
});

function QuizSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-gradient-brand grid size-10 place-items-center rounded-2xl text-white opacity-80">
          <ListChecks className="size-5" />
        </div>
        <span className="shimmer text-sm font-semibold">در حال ساختن آزمونک…</span>
      </div>
      <div className="grid gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-2xl bg-surface-2" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}
