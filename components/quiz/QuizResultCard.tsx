"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Clock3, Flame } from "lucide-react";
import { useState } from "react";
import { toFaDigits } from "@/lib/persian";
import { formatDuration, percent } from "@/lib/quiz/result";
import type { QuizResult } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { Inline } from "./Inline";

/** The student's exam result, shown in the chat in place of the plain text message. */
export function QuizResultCard({ result }: { result: QuizResult }) {
  const [open, setOpen] = useState(false);
  const pct = percent(result);
  const good = pct >= 60;
  const r = 22;
  const c = 2 * Math.PI * r;

  return (
    <div className="w-full max-w-[85%] overflow-hidden rounded-3xl rounded-ss-lg border border-[#dcd9ff] bg-[#f5f4ff] sm:max-w-sm">
      <div className="flex items-center gap-3 p-3.5">
        <div className="relative size-14 shrink-0">
          <svg viewBox="0 0 56 56" className="size-full -rotate-90">
            <circle cx="28" cy="28" r={r} stroke="#e2e8f0" strokeWidth="6" fill="none" />
            <circle
              cx="28"
              cy="28"
              r={r}
              stroke={good ? "#22c55e" : "#f59e0b"}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct / 100)}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[13px] font-black">{toFaDigits(pct)}٪</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#6d28d9]">📝 نتیجه آزمونک</div>
          <div className="truncate text-[15px] font-black text-[#1e1b4b]">{result.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[#475569]">
            <span className="font-bold">
              {toFaDigits(result.correct)} از {toFaDigits(result.total)} درست
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" /> {formatDuration(result.seconds)}
            </span>
            <span className="flex items-center gap-1 text-[#f97316]">
              <Flame className="size-3.5 fill-current" /> {toFaDigits(result.bestStreak)}
            </span>
          </div>
        </div>
      </div>

      {result.mistakes.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between border-t border-[#e4e2ff] px-3.5 py-2 text-[13px] font-semibold text-[#b91c1c]"
            aria-expanded={open}
          >
            اشتباهات ({toFaDigits(result.mistakes.length)})
            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid gap-2 overflow-hidden px-3.5 pb-3 text-[13px] leading-6"
              >
                {result.mistakes.map((m, i) => (
                  <li key={i} className="rounded-xl bg-white px-3 py-2">
                    <div className="font-semibold">
                      <Inline text={m.q} />
                    </div>
                    <div className="text-[#b91c1c]">
                      جواب من: <Inline text={m.mine} />
                    </div>
                    <div className="text-[#15803d]">
                      جواب درست: <Inline text={m.right} />
                    </div>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
