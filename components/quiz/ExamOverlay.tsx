"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Clock3, Flame, RotateCcw, Send, Target, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "@/lib/chat/store";
import { toFaDigits } from "@/lib/persian";
import { buildResult, formatDuration, percent } from "@/lib/quiz/result";
import { playCorrect, playFinish, playWrong, vibrate } from "@/lib/quiz/sounds";
import type { Quiz, QuizQuestion, QuizResult } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/Orb";
import { Confetti } from "./Confetti";
import { Inline } from "./Inline";

const LETTERS = ["الف", "ب", "ج", "د", "هـ", "و"];

type Phase = "question" | "feedback" | "results";

interface Props {
  quiz: Quiz;
  /** Closes the exam without sending anything. */
  onClose: () => void;
  /** "Back to Dana": closes the exam and sends the result. */
  onSend: (result: QuizResult) => void;
  /** Called when an attempt is finished (to show the score on the chat card). */
  onFinished: (result: QuizResult) => void;
  /** Whether the result can be sent to Dana (false outside a chat). */
  canSend: boolean;
}

/** Full-screen exam, one question at a time (Duolingo-style). */
export function ExamOverlay({ quiz, onClose, onSend, onFinished, canSend }: Props) {
  const sound = useChatStore((s) => s.settings.quizSound) ?? true;
  const updateSettings = useChatStore((s) => s.updateSettings);

  // A "session" is the whole exam, or a practice round of the mistakes only.
  const [session, setSession] = useState(() => ({ round: 0, practice: false, indexes: quiz.questions.map((_, i) => i) }));
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("question");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]); // exam: first answer per question
  const [practiceRight, setPracticeRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [session.round]);

  const qIndex = session.indexes[pos];
  const question: QuizQuestion | undefined = quiz.questions[qIndex];
  const total = session.indexes.length;
  const progress = (pos + (phase === "question" ? 0 : 1)) / Math.max(1, total);

  const check = useCallback(
    (choice: number | null) => {
      if (!question || phase !== "question") return;
      const chosen = choice ?? -1;
      const correct = chosen === question.answer;
      setSelected(chosen);
      setLastCorrect(correct);
      setPhase("feedback");
      if (session.practice) {
        if (correct) setPracticeRight((n) => n + 1);
      } else {
        setAnswers((a) => {
          const next = [...a];
          next[qIndex] = chosen;
          return next;
        });
      }
      if (correct) {
        setStreak((s) => {
          const n = s + 1;
          setBestStreak((b) => Math.max(b, n));
          return n;
        });
        if (sound) playCorrect();
      } else {
        setStreak(0);
        if (sound) playWrong();
        vibrate();
      }
    },
    [question, phase, session.practice, qIndex, sound],
  );

  const next = useCallback(() => {
    if (phase !== "feedback") return;
    if (pos + 1 < total) {
      setPos(pos + 1);
      setSelected(null);
      setPhase("question");
      return;
    }
    setPhase("results");
    if (sound) playFinish();
    if (!session.practice) {
      const r = buildResult(quiz, answers, (Date.now() - startedAt.current) / 1000, bestStreak);
      setResult(r);
      onFinished(r);
    }
  }, [phase, pos, total, sound, session.practice, quiz, answers, bestStreak, onFinished]);

  const restart = (practice: boolean) => {
    const indexes = practice
      ? quiz.questions.map((q, i) => (answers[i] === q.answer ? -1 : i)).filter((i) => i >= 0)
      : quiz.questions.map((_, i) => i);
    if (!indexes.length) return;
    setSession((s) => ({ round: s.round + 1, practice, indexes }));
    setPos(0);
    setSelected(null);
    setPhase("question");
    setPracticeRight(0);
    setStreak(0);
    if (!practice) {
      setAnswers([]);
      setBestStreak(0);
      setResult(null);
    }
  };

  const requestClose = useCallback(() => {
    const midExam = phase !== "results" && (pos > 0 || phase === "feedback");
    if (midExam) setConfirmExit(true);
    else onClose();
  }, [phase, pos, onClose]);

  // Keyboard: 1–4 choose, Enter checks / continues, Esc exits.
  const keys = useRef({ check, next, requestClose, selected, phase, question });
  useEffect(() => {
    keys.current = { check, next, requestClose, selected, phase, question };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === "Escape") return k.requestClose();
      if (k.phase === "question" && k.question && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < k.question.options.length) setSelected(i);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (k.phase === "question" && k.selected !== null) k.check(k.selected);
        else if (k.phase === "feedback") k.next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <motion.div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={quiz.title || "آزمونک"}
      className="exam-overlay"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* ---------- top bar ---------- */}
      <div className="exam-topbar">
        <button type="button" onClick={requestClose} className="exam-icon-btn" aria-label="خروج از آزمون">
          <X className="size-6" />
        </button>
        <div className="exam-progress" aria-label={`پیشرفت ${toFaDigits(Math.round(progress * 100))}٪`}>
          <motion.div className="exam-progress-fill" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
            <span className="exam-progress-shine" />
          </motion.div>
        </div>
        <motion.span key={streak} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className={cn("exam-streak", streak === 0 && "opacity-40")}>
          <Flame className="size-5 fill-current" />
          {toFaDigits(streak)}
        </motion.span>
        <button
          type="button"
          onClick={() => updateSettings({ quizSound: !sound })}
          className="exam-icon-btn"
          aria-label={sound ? "خاموش کردن صدا" : "روشن کردن صدا"}
        >
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </div>

      {/* ---------- body ---------- */}
      <div className="exam-body">
        <AnimatePresence mode="wait" initial={false}>
          {phase !== "results" && question ? (
            <motion.div
              key={`${session.round}-${pos}`}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="exam-column"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#7c3aed]">
                {session.practice ? (
                  <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-[#c2410c]">تمرین اشتباهات</span>
                ) : (
                  <span className="rounded-full bg-[#f3e8ff] px-3 py-1">آزمونک</span>
                )}
                <span className="text-[#94a3b8]">
                  سوال {toFaDigits(pos + 1)} از {toFaDigits(total)}
                </span>
              </div>

              <div className="flex items-end gap-3">
                <Orb size={64} busy={phase === "question" && selected === null} />
                <div className="exam-bubble">
                  <Inline text={question.q} />
                </div>
              </div>

              <div className="mt-7 grid gap-3">
                {question.options.map((option, i) => {
                  const isSelected = selected === i;
                  const isAnswer = i === question.answer;
                  const state =
                    phase === "feedback"
                      ? isAnswer
                        ? "correct"
                        : isSelected
                          ? "wrong"
                          : "dim"
                      : isSelected
                        ? "selected"
                        : "idle";
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={phase !== "question"}
                      onClick={() => setSelected(i)}
                      className={cn("exam-option", `exam-option-${state}`)}
                    >
                      <span className="exam-option-key">{state === "correct" ? <Check className="size-4" strokeWidth={3} /> : state === "wrong" ? <X className="size-4" strokeWidth={3} /> : LETTERS[i]}</span>
                      <span className="flex-1 text-start">
                        <Inline text={option} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : result || session.practice ? (
            <Results
              key={`results-${session.round}`}
              result={result}
              practice={session.practice ? { right: practiceRight, total } : null}
              canSend={canSend}
              onSend={() => result && onSend(result)}
              onPracticeMistakes={() => restart(true)}
              onRetry={() => restart(false)}
              onClose={onClose}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* ---------- bottom bar / feedback sheet ---------- */}
      {phase !== "results" && question && (
        <div className="exam-footer-wrap">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "question" ? (
              <motion.div key="check" className="exam-footer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="exam-column flex gap-3">
                  <button type="button" onClick={() => check(null)} className="exam-btn exam-btn-ghost">
                    نمی‌دانم
                  </button>
                  <button
                    type="button"
                    disabled={selected === null}
                    onClick={() => check(selected)}
                    className="exam-btn exam-btn-primary flex-1"
                  >
                    بررسی
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="feedback"
                className={cn("exam-sheet", lastCorrect ? "exam-sheet-correct" : "exam-sheet-wrong")}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              >
                <div className="exam-column">
                  <div className="relative flex items-center gap-3">
                    <span className={cn("exam-sheet-icon", lastCorrect ? "bg-[#22c55e]" : "bg-[#ef4444]")}>
                      {lastCorrect ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={3} />}
                      {lastCorrect && <Confetti mode="burst" count={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[19px] font-black">{lastCorrect ? "آفرین! درست است 🎉" : selected === -1 ? "اشکال ندارد، یاد می‌گیریم!" : "نزدیک بود!"}</div>
                      {!lastCorrect && (
                        <div className="mt-0.5 text-[15px] font-bold">
                          جواب درست: <Inline text={question.options[question.answer]} />
                        </div>
                      )}
                    </div>
                  </div>
                  {question.explain && (
                    <p className="mt-2 text-[14.5px] leading-7 opacity-90">
                      <Inline text={question.explain} />
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    autoFocus
                    className={cn("exam-btn mt-4 w-full", lastCorrect ? "exam-btn-green" : "exam-btn-red")}
                  >
                    {pos + 1 < total ? "ادامه" : "دیدن نتیجه"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------- exit confirmation ---------- */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div className="exam-confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="exam-confirm"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <Orb size={56} />
              <div className="mt-3 text-[18px] font-black">صبر کنید! آزمون هنوز تمام نشده</div>
              <p className="mt-1 text-sm text-[#64748b]">اگر حالا خارج شوید، نتیجه این آزمون فرستاده نمی‌شود.</p>
              <button type="button" onClick={() => setConfirmExit(false)} className="exam-btn exam-btn-primary mt-5 w-full">
                ادامه آزمون
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full py-3 text-[15px] font-bold text-[#ef4444]">
                خروج
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

/* ---------------- results screen ---------------- */

function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} stroke="#e2e8f0" strokeWidth="12" fill="none" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          stroke={value >= 60 ? "#22c55e" : "#f59e0b"}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[32px] font-black leading-none">{toFaDigits(value)}٪</div>
          <div className="mt-1 text-xs font-bold text-[#94a3b8]">امتیاز</div>
        </div>
      </div>
    </div>
  );
}

function Results({
  result,
  practice,
  canSend,
  onSend,
  onPracticeMistakes,
  onRetry,
  onClose,
}: {
  result: QuizResult | null;
  practice: { right: number; total: number } | null;
  canSend: boolean;
  onSend: () => void;
  onPracticeMistakes: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const pct = result ? percent(result) : 0;
  const headline = practice
    ? "تمرین تمام شد! 💪"
    : pct === 100
      ? "عالی! همه درست بود 🏆"
      : pct >= 60
        ? "خیلی خوب! 🌟"
        : "تلاش خوبی بود! 💪";
  const tiles = result
    ? [
        { Icon: Check, label: "درست", value: `${toFaDigits(result.correct)} از ${toFaDigits(result.total)}`, color: "#22c55e" },
        { Icon: Target, label: "امتیاز", value: `${toFaDigits(pct)}٪`, color: "#4f46e5" },
        { Icon: Clock3, label: "زمان", value: formatDuration(result.seconds), color: "#0ea5e9" },
        { Icon: Flame, label: "بهترین پیاپی", value: toFaDigits(result.bestStreak), color: "#f97316" },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="exam-column flex flex-col items-center pb-8 text-center"
    >
      {(practice || pct >= 60) && <Confetti mode="rain" count={46} />}
      <motion.div initial={{ y: -10, rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}>
        <span className="grid size-16 place-items-center rounded-3xl bg-[#fef3c7] text-[#f59e0b] shadow-[0_8px_24px_rgba(245,158,11,0.25)]">
          <Trophy className="size-9" />
        </span>
      </motion.div>
      <h2 className="mt-4 text-[26px] font-black">{headline}</h2>
      {result && <p className="mt-1 text-[15px] text-[#64748b]">{result.title}</p>}

      {practice ? (
        <p className="mt-4 text-[17px] font-bold">
          {toFaDigits(practice.right)} از {toFaDigits(practice.total)} اشتباه را این بار درست جواب دادید.
        </p>
      ) : (
        <div className="mt-5">
          <ScoreRing value={pct} />
        </div>
      )}

      {result && !practice && (
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          {tiles.map(({ Icon, label, value, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="exam-tile"
              style={{ borderColor: `${color}55` }}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold" style={{ color }}>
                <Icon className="size-4" /> {label}
              </div>
              <div className="mt-1 text-[20px] font-black">{value}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-7 grid w-full gap-3">
        {canSend && result ? (
          <button type="button" onClick={onSend} className="exam-btn exam-btn-primary w-full">
            <Send className="size-5" /> برگشت به هما و فرستادن نتیجه
          </button>
        ) : (
          <button type="button" onClick={onClose} className="exam-btn exam-btn-primary w-full">
            برگشت به گفتگو
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {result && result.mistakes.length > 0 ? (
            <button type="button" onClick={onPracticeMistakes} className="exam-btn exam-btn-ghost">
              تمرین اشتباهات ({toFaDigits(result.mistakes.length)})
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onRetry} className="exam-btn exam-btn-ghost">
            <RotateCcw className="size-4" /> دوباره
          </button>
        </div>
      </div>
    </motion.div>
  );
}
