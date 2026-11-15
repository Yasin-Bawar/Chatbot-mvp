"use client";

import { AnimatePresence } from "motion/react";
import { ListChecks, Play, RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { memo, useCallback, useContext, useId, useMemo, useState } from "react";
import { MessageContext } from "@/lib/chat/message-context";
import { sendUserMessage, whenIdle } from "@/lib/chat/send";
import { useChatStore } from "@/lib/chat/store";
import { useOverlays } from "@/lib/overlays";
import { toFaDigits } from "@/lib/persian";
import { parseQuiz } from "@/lib/quiz/parse";
import { percent, resultMessage } from "@/lib/quiz/result";
import type { QuizResult } from "@/lib/quiz/types";
import { ExamOverlay } from "./ExamOverlay";

/**
 * A ```quiz block in the chat: a compact exam card. The exam opens full
 * screen only when the student presses «شروع آزمون»; the result is sent back to Dana.
 */
export const QuizCard = memo(function QuizCard({ raw, streaming }: { raw: string; streaming: boolean }) {
  const id = useId();
  const pathname = usePathname();
  const message = useContext(MessageContext);
  const quiz = useMemo(() => parseQuiz(raw), [raw]);

  const openId = useOverlays((s) => s.quiz);
  const open = openId === id && pathname === "/";

  const [result, setResult] = useState<QuizResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const show = useCallback(() => {
    setAttempt((a) => a + 1);
    useOverlays.setState({ quiz: id });
  }, [id]);

  const close = useCallback(() => {
    if (useOverlays.getState().quiz === id) useOverlays.setState({ quiz: null });
  }, [id]);


  const send = useCallback(
    async (r: QuizResult) => {
      close();
      if (!message) return;
      window.dispatchEvent(new CustomEvent("dana:scroll-bottom"));
      await whenIdle(message.chatId);
      // The student has finished the quiz: Dana should now explain, not quiz again.
      useChatStore.getState().updateSettings({ quiz: false });
      void sendUserMessage(message.chatId, resultMessage(r), [], { quizResult: r });
    },
    [close, message],
  );

  if (!quiz) {
    return streaming ? <QuizSkeleton /> : null;
  }

  const count = quiz.questions.length;
  const minutes = Math.max(1, Math.round((count * 20) / 60));
  const title = quiz.title?.replace(/^آزمونک[:：]\s*/, "") || "آزمونک";

  return (
    <div className="quiz-card">
      <div className="quiz-card-head">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white">
          <ListChecks className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white/80">آزمونک</div>
          <div className="truncate text-[15.5px] font-black text-white">{title}</div>
          <div className="text-[13px] text-white/85">
            {toFaDigits(count)} سوال · حدود {toFaDigits(minutes)} دقیقه
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 p-3.5">

        {result && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5">
            <span className="text-[22px]">{percent(result) === 100 ? "🏆" : percent(result) >= 60 ? "🌟" : "💪"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">
                نتیجه شما: {toFaDigits(result.correct)} از {toFaDigits(result.total)} ({toFaDigits(percent(result))}٪)
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${percent(result)}%` }} />
              </div>
            </div>
          </div>
        )}

        <button type="button" onClick={show} className="exam-btn exam-btn-primary exam-btn-sm w-full">
          {result ? <RotateCcw className="size-5" /> : <Play className="size-5 fill-current" />}
          {result ? "دوباره امتحان کنید" : attempt > 0 ? "شروع دوباره آزمون" : "شروع آزمون"}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <ExamOverlay
            key={attempt}
            quiz={quiz}
            canSend={Boolean(message)}
            onClose={close}
            onFinished={setResult}
            onSend={(r) => void send(r)}
          />
        )}
      </AnimatePresence>
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
