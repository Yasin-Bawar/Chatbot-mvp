"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { parseBoard } from "@/lib/board/parse";
import { noteDuration, STEP_GAP_SECONDS, stepDuration, writeDuration } from "@/lib/board/timing";
import type { BoardStep } from "@/lib/board/types";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { CHALK, ChalkMath, ChalkText, ChalkWrite } from "./Chalk";
import { BoardDrawing } from "./Drawing";
import { BoardGraph } from "./Graph";

/* ---------------- one step on the board ---------------- */

function Note({ text, animate, delay }: { text: string; animate: boolean; delay: number }) {
  return (
    <div className="mt-1.5 flex justify-center">
      <ChalkWrite dir="rtl" animate={animate} delay={delay} duration={noteDuration(text)} className="board-note">
        <span className="me-1.5 opacity-70">←</span>
        <ChalkText text={text} />
      </ChalkWrite>
    </div>
  );
}

const StepView = memo(function StepView({ step, animate }: { step: BoardStep; animate: boolean }) {
  switch (step.kind) {
    case "heading":
      return (
        <div className="pt-2">
          <ChalkWrite dir="rtl" animate={animate} duration={writeDuration(step.text, 0.025)} className="board-heading">
            <ChalkText text={step.text} />
          </ChalkWrite>
        </div>
      );
    case "text":
      return (
        <ChalkWrite
          dir="rtl"
          animate={animate}
          duration={writeDuration(step.text, 0.022)}
          className="board-text"
        >
          <span style={{ color: step.color ? CHALK[step.color] : undefined }}>
            <ChalkText text={step.text} />
          </span>
        </ChalkWrite>
      );
    case "math": {
      const d = writeDuration(step.tex);
      return (
        <div className="text-center">
          <div className="board-scroll">
            <ChalkWrite dir="ltr" animate={animate} duration={d} className="board-math">
              <span style={{ color: step.color ? CHALK[step.color] : undefined }}>
                <ChalkMath tex={step.tex} />
              </span>
            </ChalkWrite>
          </div>
          {step.note && <Note text={step.note} animate={animate} delay={d} />}
        </div>
      );
    }
    case "answer": {
      const d = writeDuration(step.tex);
      return (
        <div className="flex flex-col items-center pt-1">
          <div
            className={cn("board-answer", animate && "chalk-pop")}
            style={animate ? ({ "--delay": "0s" } as CSSProperties) : undefined}
          >
            <span className="board-answer-label">
              <Check className="size-4" strokeWidth={3} /> جواب
            </span>
            <div className="board-scroll">
              <ChalkWrite dir="ltr" animate={animate} delay={0.35} duration={d} className="board-math">
                <ChalkMath tex={step.tex} />
              </ChalkWrite>
            </div>
          </div>
          {step.note && <Note text={step.note} animate={animate} delay={d + 0.5} />}
        </div>
      );
    }
    case "graph": {
      const d = stepDuration({ ...step, note: undefined });
      return (
        <div>
          <BoardGraph spec={step.graph} animate={animate} />
          {step.note && <Note text={step.note} animate={animate} delay={d} />}
        </div>
      );
    }
    case "draw": {
      const d = stepDuration({ ...step, note: undefined });
      return (
        <div>
          <BoardDrawing items={step.items} grid={step.grid} animate={animate} />
          {step.note && <Note text={step.note} animate={animate} delay={d} />}
        </div>
      );
    }
  }
});

/* ---------------- the board + player ---------------- */

interface Props {
  raw: string;
  /** True while this block is still being streamed by the model. */
  streaming: boolean;
}

/**
 * The teacher's chalkboard: Claude writes the solution step by step, with
 * play / pause / next / previous / replay controls and a full-screen mode.
 * New answers play automatically; answers opened from history show complete.
 */
export function Board({ raw, streaming }: Props) {
  const board = useMemo(() => parseBoard(raw, streaming), [raw, streaming]);
  const total = board.steps.length;

  const [shown, setShown] = useState(() => (streaming ? 0 : total));
  const [playing, setPlaying] = useState(streaming);
  const [round, setRound] = useState(0);
  // Steps with index in [animateFrom, animateUntil) are animated when they appear.
  const [animRange, setAnimRange] = useState<[number, number]>(() => (streaming ? [0, Infinity] : [Infinity, Infinity]));
  const [expanded, setExpanded] = useState(false);
  const lastReveal = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = Math.min(shown, total);
  const finished = !streaming && visible >= total;

  const reveal = useCallback((n: number) => {
    lastReveal.current = performance.now();
    setShown(n);
  }, []);

  // Auto-play: reveal the next step once the previous one is written.
  useEffect(() => {
    if (!playing) return;
    if (visible < total) {
      const prev = visible > 0 ? board.steps[visible - 1] : null;
      const animated = visible - 1 >= animRange[0] && visible - 1 < animRange[1];
      const need = prev && animated ? (stepDuration(prev) + STEP_GAP_SECONDS) * 1000 : 250;
      const wait = Math.max(0, lastReveal.current + need - performance.now());
      const id = setTimeout(() => reveal(visible + 1), wait);
      return () => clearTimeout(id);
    }
    if (!streaming) {
      const last = board.steps[total - 1];
      const id = setTimeout(() => setPlaying(false), last ? stepDuration(last) * 1000 : 0);
      return () => clearTimeout(id);
    }
  }, [playing, visible, total, streaming, board.steps, animRange, reveal]);

  // Keep the newest line in view inside the board.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && playing) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible, playing]);

  // Esc closes full screen.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAnimRange([visible, Infinity]);
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, visible]);

  const replay = () => {
    setAnimRange([0, Infinity]);
    setRound((r) => r + 1);
    reveal(0);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (finished && !playing) return replay();
    if (!playing && animRange[0] === Infinity) setAnimRange([visible, Infinity]);
    lastReveal.current = 0;
    setPlaying((p) => !p);
  };
  const next = () => {
    setPlaying(false);
    if (animRange[0] > visible) setAnimRange([visible, Infinity]);
    reveal(Math.min(total, visible + 1));
  };
  const prev = () => {
    setPlaying(false);
    setShown(Math.max(0, visible - 1));
  };
  const showAll = () => {
    setPlaying(false);
    setAnimRange(([a]) => [a, visible]);
    setShown(total);
  };

  const waiting = streaming && playing && visible >= total;
  const progress = total ? visible / total : 0;

  const surface = (
    <div className={cn("board-frame", expanded && "board-frame-expanded")}>
      <div className="board-surface">
        <div className="board-topbar">
          <span className="board-chip">
            <span className="board-chip-dot" /> تخته
          </span>
          {total > 0 && (
            <span className="board-counter">
              قدم {toFaDigits(Math.max(1, visible))} از {toFaDigits(total)}
              {streaming ? "…" : ""}
            </span>
          )}
        </div>

        <div ref={scrollRef} className={cn("board-content", expanded ? "board-content-expanded" : "board-content-inline")}>
          {board.title && (
            <div className="mb-3 text-center">
              <ChalkWrite dir="rtl" animate={animRange[0] === 0} duration={writeDuration(board.title, 0.02)} className="board-title">
                <ChalkText text={board.title} />
              </ChalkWrite>
            </div>
          )}

          <div key={round} className="flex flex-col gap-4">
            {board.steps.slice(0, visible).map((step, i) => (
              <StepView key={i} step={step} animate={i >= animRange[0] && i < animRange[1]} />
            ))}
          </div>

          {waiting && (
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label="در حال نوشتن">
              {[0, 1, 2].map((i) => (
                <span key={i} className="board-wait-dot" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          )}
          {total === 0 && !streaming && <p className="text-center text-sm opacity-60">تخته خالی است.</p>}
        </div>

        <div className="board-tray" aria-hidden>
          <span className="board-chalk" style={{ background: CHALK.white }} />
          <span className="board-chalk board-chalk-short" style={{ background: CHALK.yellow }} />
          <span className="board-chalk board-chalk-tiny" style={{ background: CHALK.pink }} />
          <span className="board-eraser" />
        </div>
      </div>
    </div>
  );

  const controls = (
    <div className={cn("mt-2.5 flex items-center gap-1.5", expanded && "mx-auto w-full max-w-5xl")}>
      <button
        type="button"
        onClick={togglePlay}
        disabled={total === 0}
        className="bg-gradient-brand grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_16px_rgba(79,70,229,0.3)] transition hover:brightness-110 disabled:opacity-40"
        aria-label={playing ? "توقف" : "نمایش قدم به قدم"}
        title={playing ? "توقف" : "نمایش قدم به قدم"}
      >
        {playing ? <Pause className="size-4 fill-current" /> : finished ? <RotateCcw className="size-4" /> : <Play className="size-4 fill-current" />}
      </button>
      <button type="button" onClick={prev} disabled={visible === 0} className="board-ctrl" aria-label="قدم قبلی" title="قدم قبلی">
        <ChevronRight className="size-4" />
      </button>
      <button type="button" onClick={next} disabled={visible >= total} className="board-ctrl" aria-label="قدم بعدی" title="قدم بعدی">
        <ChevronLeft className="size-4" />
      </button>
      <div className="mx-1 h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-[#e7e5f7]">
        <motion.div className="bg-gradient-brand h-full rounded-full" initial={false} animate={{ width: `${progress * 100}%` }} />
      </div>
      <button type="button" onClick={replay} disabled={total === 0} className="board-ctrl" aria-label="از اول" title="از اول">
        <RotateCcw className="size-4" />
      </button>
      <button type="button" onClick={showAll} disabled={visible >= total} className="board-ctrl" aria-label="نمایش همه" title="نمایش همه">
        <ChevronsLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          // The board moves to/from the full-screen layer: don't replay what is already written.
          setAnimRange([visible, Infinity]);
          setExpanded((e) => !e);
        }}
        className="board-ctrl"
        aria-label={expanded ? "کوچک کردن" : "تمام صفحه"}
        title={expanded ? "کوچک کردن" : "تمام صفحه"}
      >
        {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  );

  return (
    <div className="board-root not-prose">
      {expanded ? (
        <div className="board-placeholder">
          <span>تخته در حالت تمام صفحه باز است</span>
        </div>
      ) : (
        <>
          {surface}
          {controls}
        </>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <motion.div
                dir="rtl"
                className="fixed inset-0 z-[70] flex flex-col bg-[#0d1714]/75 p-2 backdrop-blur-sm sm:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  setAnimRange([visible, Infinity]);
                  setExpanded(false);
                }}
              >
                <motion.div
                  className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col"
                  initial={{ scale: 0.96, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.97, y: 8 }}
                >
                  {surface}
                </motion.div>
                <div className="rounded-2xl bg-surface/95 px-3 py-1.5">{controls}</div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
