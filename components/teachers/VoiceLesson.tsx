"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Keyboard, LoaderCircle, Mic, MicOff, PhoneOff, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseBoard } from "@/lib/board/parse";
import { writeDuration } from "@/lib/board/timing";
import { useChatStore } from "@/lib/chat/store";
import type { Teacher } from "@/lib/teachers";
import { createVoiceEngine, type VoiceEngine } from "@/lib/voice/engines";
import { boardRaw, soundsLikeEcho, TeacherStream, type TeacherChunk } from "@/lib/voice/stream";
import { cn } from "@/lib/utils";
import { StepView } from "@/components/board/Board";
import { ChalkText, ChalkWrite } from "@/components/board/Chalk";
import { Orb } from "@/components/ui/Orb";

/**
 * A live voice lesson: the student talks (or types), the teacher answers aloud
 * sentence by sentence and writes on the board. Talking while the teacher speaks
 * interrupts it, like in a real class.
 */

type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking";
type Line = { role: "student" | "teacher"; text: string; cut?: boolean };
type Turn = { role: "user" | "assistant"; text: string };

const STATUS_TEXT: Record<Status, string> = {
  idle: "برای شروع درس، دکمه را بزنید",
  connecting: "در حال وصل شدن…",
  listening: "گوش می‌دهم… صحبت کنید",
  thinking: "فکر می‌کنم…",
  speaking: "صحبت می‌کنم… هر وقت خواستید، صحبت کنید",
};

/** Wait this long after the student stops talking before answering. */
const END_OF_TURN_MS = 900;

export function VoiceLesson({ teacher }: { teacher: Teacher }) {
  const studentName = useChatStore((s) => s.settings.studentName);
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState("");
  const [board, setBoard] = useState<string[]>([]);
  // Bumped when the board is wiped, so new steps get fresh keys (and write themselves again).
  const [boardGen, setBoardGen] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [engineInfo, setEngineInfo] = useState<{ kind: string; canListen: boolean; canSpeak: boolean } | null>(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const engine = useRef<VoiceEngine | null>(null);
  const history = useRef<Turn[]>([]);
  const turnId = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const liveRaw = useRef<string | null>(null);
  const speaking = useRef("");
  const statusRef = useRef<Status>("idle");
  const heard = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptedRef = useRef(false);
  const captionsEnd = useRef<HTMLDivElement>(null);

  const micOnRef = useRef(micOn);
  const set = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    captionsEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lines, partial]);

  /** Stops the teacher mid-answer (the student started talking). */
  const interrupt = useCallback(() => {
    if (statusRef.current !== "thinking" && statusRef.current !== "speaking") return;
    turnId.current++;
    abort.current?.abort();
    engine.current?.stopSpeaking();
    if (liveRaw.current !== null) {
      history.current.push({ role: "assistant", text: `${liveRaw.current}\n[the student interrupted here]` });
      liveRaw.current = null;
    }
    setLines((l) => {
      const last = l[l.length - 1];
      return last?.role === "teacher" ? [...l.slice(0, -1), { ...last, cut: true }] : l;
    });
    interruptedRef.current = true;
    set("listening");
  }, []);

  const send = useCallback(
    async (text: string, hidden = false) => {
      const id = ++turnId.current;
      const said = interruptedRef.current ? `[interrupted] ${text}` : text;
      interruptedRef.current = false;
      history.current.push({ role: "user", text: said });
      if (!hidden) setLines((l) => [...l, { role: "student", text }]);
      setLines((l) => [...l, { role: "teacher", text: "" }]);
      set("thinking");

      const ctrl = new AbortController();
      abort.current = ctrl;
      liveRaw.current = "";
      const parser = new TeacherStream();
      let queue = Promise.resolve();

      const take = (c: TeacherChunk) => {
        if (c.clear) {
          setBoard([]);
          setBoardGen((g) => g + 1);
        }
        if (c.board.length) setBoard((b) => [...b, ...c.board]);
        for (const sentence of c.speech) {
          queue = queue.then(async () => {
            if (turnId.current !== id) return;
            speaking.current = sentence;
            setLines((l) => {
              const last = l[l.length - 1];
              return last?.role === "teacher" ? [...l.slice(0, -1), { ...last, text: `${last.text} ${sentence}`.trim() }] : l;
            });
            set("speaking");
            await engine.current?.speak(sentence);
          });
        }
      };

      try {
        const res = await fetch("/api/teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher: teacher.id, messages: history.current }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`teacher ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (turnId.current !== id) return;
          liveRaw.current = (liveRaw.current ?? "") + chunk;
          take(parser.push(chunk));
        }
        take(parser.flush());
        if (turnId.current !== id) return;
        history.current.push({ role: "assistant", text: liveRaw.current ?? "" });
        liveRaw.current = null;
        await queue;
        if (turnId.current === id) set(engine.current?.canListen && micOnRef.current ? "listening" : "idle");
      } catch (err) {
        if (turnId.current !== id) return;
        console.error(err);
        liveRaw.current = null;
        setError("جواب نرسید. انترنت را بررسی کنید و دوباره بگویید.");
        set(engine.current?.canListen && micOnRef.current ? "listening" : "idle");
      }
    },
    [teacher.id],
  );

  /** What the student said, once they pause. */
  const heardFinal = useCallback(
    (text: string) => {
      const busy = statusRef.current === "speaking" || statusRef.current === "thinking";
      if (busy && soundsLikeEcho(text, speaking.current)) return; // the teacher's own voice
      if (busy) interrupt();
      heard.current = `${heard.current} ${text}`.trim();
      setPartial("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const said = heard.current;
        heard.current = "";
        if (said) void send(said);
      }, END_OF_TURN_MS);
    },
    [interrupt, send],
  );

  const heardPartial = useCallback(
    (text: string) => {
      const busy = statusRef.current === "speaking" || statusRef.current === "thinking";
      if (busy && (text.trim().length < 6 || soundsLikeEcho(text, speaking.current))) return;
      if (busy) interrupt();
      setPartial(text);
      if (timer.current && text.trim()) clearTimeout(timer.current); // still talking
    },
    [interrupt],
  );

  const start = async () => {
    setError("");
    set("connecting");
    try {
      const e = await createVoiceEngine();
      engine.current = e;
      setEngineInfo({ kind: e.kind, canListen: e.canListen, canSpeak: e.canSpeak });
      if (!e.canListen) setShowKeyboard(true);
      if (e.canListen && micOnRef.current) {
        await e.listen({
          onPartial: heardPartial,
          onFinal: heardFinal,
          onError: (m) => {
            setError(m);
            setShowKeyboard(true);
          },
        });
      }
      const name = studentName?.trim();
      void send(name ? `[start] The student's name is ${name}.` : "[start]", true);
    } catch (err) {
      console.error(err);
      setError("درس شروع نشد. دوباره امتحان کنید.");
      set("idle");
    }
  };

  const end = useCallback(() => {
    turnId.current++;
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    engine.current?.dispose();
    engine.current = null;
    liveRaw.current = null;
    setPartial("");
    set("idle");
  }, []);

  useEffect(() => end, [end]);

  const toggleMic = async () => {
    const e = engine.current;
    const next = !micOn;
    setMicOn(next);
    micOnRef.current = next;
    if (!e?.canListen) return;
    if (next) {
      await e.listen({ onPartial: heardPartial, onFinal: heardFinal, onError: setError });
      if (statusRef.current === "idle") set("listening");
    } else {
      e.stopListening();
      setPartial("");
    }
  };

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text || status === "idle" || status === "connecting") return;
    setTyped("");
    interrupt();
    void send(text);
  };

  const parsed = useMemo(() => parseBoard(boardRaw(board)), [board]);

  const live = status !== "idle";
  const visibleLines = lines.filter((l) => l.text || l.role === "student");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <Link
          href="/teachers"
          className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2"
          aria-label="برگشت"
        >
          <ArrowRight className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-black">{teacher.name}</h1>
          <p className="truncate text-xs text-muted">درس زنده با صدا · همای سعادت (۲)</p>
        </div>
        {engineInfo && (
          <span className="lesson-chip" title={engineInfo.kind === "azure" ? "صدای Azure" : "صدای خود مرورگر"}>
            {engineInfo.kind === "azure" ? "صدای طبیعی" : "صدای مرورگر"}
          </span>
        )}
      </div>

      <div className="lesson-layout">
        {/* The board */}
        <div className="lesson-board board-root not-prose">
          <div className="board-frame h-full">
            <div className="board-surface h-full">
              <div className="board-content h-full overflow-y-auto">
                {parsed.title && (
                  <div className="mb-3 text-center">
                    <ChalkWrite dir="rtl" animate duration={writeDuration(parsed.title, 0.03)} className="board-title">
                      <ChalkText text={parsed.title} />
                    </ChalkWrite>
                  </div>
                )}
                <div className="flex flex-col gap-5">
                  {parsed.steps.map((step, i) => (
                    <StepView key={`${boardGen}-${i}`} step={step} animate />
                  ))}
                </div>
                {!parsed.title && parsed.steps.length === 0 && (
                  <p className="pt-10 text-center text-sm opacity-60">معلم روی این تخته می‌نویسد.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* The teacher */}
        <div className="lesson-panel">
          <div className="lesson-head">
            <Orb
              size={88}
              busy={status === "speaking" || status === "thinking"}
              className={cn(status === "speaking" && "lesson-orb-talk")}
            />
            <p className="text-sm font-semibold text-ink-2" aria-live="polite">
              {status === "connecting" || status === "thinking" ? (
                <LoaderCircle className="me-1 inline size-4 animate-spin" />
              ) : null}
              {status === "listening" && !micOn ? "میکروفون خاموش است؛ سوال را بنویسید" : STATUS_TEXT[status]}
            </p>
          </div>

          <div className="lesson-captions">
            {visibleLines.length === 0 && !live && (
              <div className="py-6 text-center text-sm leading-7 text-muted">
                <Sparkles className="mx-auto mb-2 size-5 text-primary" />
                {teacher.intro}
                <br />
                وسط صحبت معلم هم می‌توانید صحبت کنید؛ معلم گوش می‌دهد.
              </div>
            )}
            {visibleLines.map((l, i) => (
              <div key={i} className={cn("lesson-line", l.role === "student" ? "lesson-student" : "lesson-teacher")}>
                <span className="lesson-who">{l.role === "student" ? "شما" : "معلم"}</span>
                {l.text}
                {l.cut && <span className="lesson-cut"> — قطع شد</span>}
              </div>
            ))}
            <AnimatePresence>
              {partial && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lesson-line lesson-student lesson-partial"
                >
                  <span className="lesson-who">شما</span>
                  {partial}
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={captionsEnd} />
          </div>

          {error && (
            <p role="alert" className="px-1 text-center text-xs font-semibold text-danger">
              {error}
            </p>
          )}
          {engineInfo && !engineInfo.canSpeak && (
            <p className="px-1 text-center text-xs leading-6 text-muted">
              این مرورگر صدای فارسی ندارد؛ جواب‌ها نوشته می‌شوند. برای شنیدن صدا، Microsoft Edge را امتحان کنید.
            </p>
          )}
          {engineInfo && !engineInfo.canListen && (
            <p className="px-1 text-center text-xs leading-6 text-muted">
              این مرورگر صدای شما را نمی‌شنود؛ سوال را بنویسید (یا Chrome و Edge را امتحان کنید).
            </p>
          )}

          {showKeyboard && live && (
            <form onSubmit={submitTyped} className="lesson-type">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="سوال خود را بنویسید…"
                aria-label="سوال"
              />
              <button type="submit" disabled={!typed.trim()} aria-label="فرستادن">
                <Send className="size-4" />
              </button>
            </form>
          )}

          <div className="flex items-center justify-center gap-3 pb-1">
            {live ? (
              <>
                {engineInfo?.canListen && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={cn("lesson-btn", !micOn && "lesson-btn-off")}
                    aria-pressed={micOn}
                    aria-label={micOn ? "خاموش کردن میکروفون" : "روشن کردن میکروفون"}
                  >
                    {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                  </button>
                )}
                <button type="button" onClick={end} className="lesson-end">
                  <PhoneOff className="size-5" /> پایان درس
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeyboard((s) => !s)}
                  className={cn("lesson-btn", showKeyboard && "lesson-btn-on")}
                  aria-pressed={showKeyboard}
                  aria-label="نوشتن سوال"
                >
                  <Keyboard className="size-5" />
                </button>
              </>
            ) : (
              <button type="button" onClick={start} className="lesson-start">
                <Mic className="size-5" /> شروع درس
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
