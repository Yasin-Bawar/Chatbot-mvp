"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, Gauge, Maximize2, Pause, Play, RotateCcw, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, memo, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { parseBoard } from "@/lib/board/parse";
import { NEXT_SPEED, noteDuration, SPEED_FACTOR, SPEED_LABEL, stepDuration, T, writeDuration } from "@/lib/board/timing";
import type { BoardStep } from "@/lib/board/types";
import { useChatStore } from "@/lib/chat/store";
import { useOverlays } from "@/lib/overlays";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { CHALK, ChalkMath, ChalkText, ChalkWrite } from "./Chalk";
import { BoardDrawing } from "./Drawing";
import { BoardGraph } from "./Graph";

/** Time scale for every animation on the board (from the speed setting). */
const TimeScale = createContext(1);


/* ---------------- one step on the board ---------------- */

function Note({ text, animate, delay }: { text: string; animate: boolean; delay: number }) {
  const k = useContext(TimeScale);
  return (
    <div className="mt-1.5 flex justify-center">
      <ChalkWrite dir="rtl" animate={animate} delay={delay * k} duration={noteDuration(text) * k} className="board-note">
        <span className="me-1.5 opacity-70">←</span>
        <ChalkText text={text} />
      </ChalkWrite>
    </div>
  );
}

export const StepView = memo(function StepView({ step, animate }: { step: BoardStep; animate: boolean }) {
  const k = useContext(TimeScale);
  switch (step.kind) {
    case "heading":
      return (
        <div className="pt-2">
          <ChalkWrite dir="rtl" animate={animate} duration={writeDuration(step.text, 0.035) * k} className="board-heading">
            <ChalkText text={step.text} />
          </ChalkWrite>
        </div>
      );
    case "text":
      return (
        <ChalkWrite dir="rtl" animate={animate} duration={writeDuration(step.text, 0.03) * k} className="board-text">
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
            <ChalkWrite dir="ltr" animate={animate} duration={d * k} className="board-math">
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
          <div className={cn("board-answer", animate && "chalk-pop")} style={animate ? ({ "--delay": "0s" } as CSSProperties) : undefined}>
            <span className="board-answer-label">
              <Check className="size-4" strokeWidth={3} /> جواب
            </span>
            <div className="board-scroll">
              <ChalkWrite dir="ltr" animate={animate} delay={0.5 * k} duration={d * k} className="board-math">
                <ChalkMath tex={step.tex} />
              </ChalkWrite>
            </div>
          </div>
          {step.note && <Note text={step.note} animate={animate} delay={d + 0.6} />}
        </div>
      );
    }
    case "graph": {
      const d = stepDuration({ ...step, note: undefined });
      return (
        <div>
          <BoardGraph spec={step.graph} animate={animate} k={k} />
          {step.note && <Note text={step.note} animate={animate} delay={d} />}
        </div>
      );
    }
    case "draw": {
      const d = stepDuration({ ...step, note: undefined });
      return (
        <div>
          <BoardDrawing items={step.items} grid={step.grid} animate={animate} k={k} />
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
 * The teacher's chalkboard. A new board opens full screen by itself and is
 * written step by step (play / pause / previous / next / replay / speed).
 * In the chat it stays as a compact card: tap it to open it again.
 */
export function Board({ raw, streaming }: Props) {
  const id = useId();
  const pathname = usePathname();
  const board = useMemo(() => parseBoard(raw, streaming), [raw, streaming]);
  const total = board.steps.length;

  const speed = useChatStore((s) => s.settings.boardSpeed) ?? "normal";
  const updateSettings = useChatStore((s) => s.updateSettings);
  const k = SPEED_FACTOR[speed] ?? 1;

  const openId = useOverlays((s) => s.board);
  const expanded = openId === id && pathname === "/";

  const [shown, setShown] = useState(() => (streaming ? 0 : total));
  const [playing, setPlaying] = useState(streaming);
  const [round, setRound] = useState(0);
  // Steps with index in [from, until) animate when they appear.
  const [animRange, setAnimRange] = useState<[number, number]>(() => (streaming ? [0, Infinity] : [Infinity, Infinity]));
  const [overflowing, setOverflowing] = useState(false);
  const lastReveal = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoOpened = useRef(false);
  const [liveAtMount] = useState(streaming);

  const visible = Math.min(shown, total);
  const finished = !streaming && visible >= total;

  // A board that appears in a new answer opens full screen by itself (once).
  useEffect(() => {
    if (!liveAtMount || autoOpened.current) return;
    autoOpened.current = true;
    useOverlays.setState({ board: id });
  }, [liveAtMount, id]);

  const reveal = useCallback((n: number) => {
    lastReveal.current = performance.now();
    setShown(n);
  }, []);

  // Auto-play: reveal the next step once the previous one has been written.
  useEffect(() => {
    if (!playing) return;
    if (visible < total) {
      const prev = visible > 0 ? board.steps[visible - 1] : null;
      const animated = visible - 1 >= animRange[0] && visible - 1 < animRange[1];
      const need = prev && animated ? (stepDuration(prev) + T.gap) * k * 1000 : 400;
      const wait = Math.max(0, lastReveal.current + need - performance.now());
      const t = setTimeout(() => reveal(visible + 1), wait);
      return () => clearTimeout(t);
    }
    if (!streaming) {
      const last = board.steps[total - 1];
      const t = setTimeout(() => setPlaying(false), last ? stepDuration(last) * k * 1000 : 0);
      return () => clearTimeout(t);
    }
  }, [playing, visible, total, streaming, board.steps, animRange, reveal, k]);

  // Keep the newest line in view (smoothly while playing full screen).
  const pinned = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (expanded) {
      if (playing) {
        pinned.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible, playing, expanded]);

  // Full screen: if the reader is at the bottom, stay there when the board area
  // or its content changes size (e.g. the "finished" button appears on phones).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !expanded) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [expanded]);

  // Inline card: does the content overflow (show the fade + "open" hint)?
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 4);
    const ro = new ResizeObserver(() => {
      check();
      el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [expanded]);

  const open = () => {
    setAnimRange(([a, b]) => (a < visible ? [visible, Infinity] : [a, b]));
    useOverlays.setState({ board: id });
  };
  const close = useCallback(() => {
    // The board moves back into the chat: don't replay what is already written.
    setAnimRange([visible, Infinity]);
    if (useOverlays.getState().board === id) useOverlays.setState({ board: null });
  }, [id, visible]);

  const replay = () => {
    setAnimRange([0, Infinity]);
    setRound((r) => r + 1);
    reveal(0);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (finished && !playing) return replay();
    if (!playing && animRange[0] > visible) setAnimRange([visible, Infinity]);
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
  const cycleSpeed = () => updateSettings({ boardSpeed: NEXT_SPEED[speed] ?? "normal" });

  // Keyboard in full screen: Esc closes, ← next, → previous (RTL), Space play/pause.
  const keyActions = useRef({ close, next, prev, togglePlay });
  useEffect(() => {
    keyActions.current = { close, next, prev, togglePlay };
  });
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      const a = keyActions.current;
      if (e.key === "Escape") a.close();
      else if (e.key === "ArrowLeft") a.next();
      else if (e.key === "ArrowRight") a.prev();
      else if (e.key === " ") {
        e.preventDefault();
        a.togglePlay();
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const waiting = streaming && playing && visible >= total;
  const progress = total ? visible / total : 0;
  const counter = total > 0 ? `قدم ${toFaDigits(Math.max(1, visible))} از ${toFaDigits(total)}${streaming ? "…" : ""}` : "";

  const content = (
    <div>
      {board.title && (
        <div className="mb-3 text-center">
          <ChalkWrite dir="rtl" animate={animRange[0] === 0} duration={writeDuration(board.title, 0.03) * k} className="board-title">
            <ChalkText text={board.title} />
          </ChalkWrite>
        </div>
      )}
      <div key={round} className="flex flex-col gap-5">
        {board.steps.slice(0, visible).map((step, i) => (
          <StepView key={i} step={step} animate={i >= animRange[0] && i < animRange[1]} />
        ))}
      </div>
      {waiting && (
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-label="در حال نوشتن">
          {[0, 1, 2].map((i) => (
            <span key={i} className="board-wait-dot" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      )}
      {total === 0 && !streaming && <p className="text-center text-sm opacity-60">تخته خالی است.</p>}
    </div>
  );

  const tray = (
    <div className="board-tray" aria-hidden>
      <span className="board-chalk" style={{ background: CHALK.white }} />
      <span className="board-chalk board-chalk-short" style={{ background: CHALK.yellow }} />
      <span className="board-chalk board-chalk-tiny" style={{ background: CHALK.pink }} />
      <span className="board-eraser" />
    </div>
  );

  const primaryLabel = playing ? "توقف" : finished || visible === 0 ? "از اول ببین" : "ادامه";

  return (
    <TimeScale.Provider value={k}>
      <div className="board-root not-prose">
        {expanded ? (
          <button type="button" onClick={close} className="board-placeholder">
            <span className="board-chip-dot" /> تخته در حالت تمام صفحه باز است
          </button>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="باز کردن تخته در تمام صفحه"
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
              className="board-frame board-frame-inline"
            >
              <div className="board-surface">
                <div className="board-topbar">
                  <span className="board-chip">
                    <span className="board-chip-dot" /> تخته
                    {counter && <span className="board-counter">· {counter}</span>}
                  </span>
                  <span className="board-open-hint">
                    <Maximize2 className="size-3.5" /> تمام صفحه
                  </span>
                </div>
                <div ref={scrollRef} className="board-content board-content-inline">
                  {content}
                </div>
                {overflowing && <div className="board-inline-fade" aria-hidden />}
                {tray}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (playing) return setPlaying(false);
                  if (finished || visible === 0) replay();
                  else togglePlay();
                  open();
                }}
                disabled={total === 0 && !streaming}
                className="bg-gradient-brand flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.28)] transition hover:brightness-110 disabled:opacity-40 sm:flex-none"
              >
                {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                {primaryLabel}
              </button>
              <button type="button" onClick={open} className="board-ctrl-wide">
                <Maximize2 className="size-4" /> تمام صفحه
              </button>
            </div>
          </>
        )}

        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {expanded && (
                <motion.div
                  dir="rtl"
                  role="dialog"
                  aria-modal="true"
                  aria-label={board.title || "تخته"}
                  className="board-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* header */}
                  <div className="board-overlay-header">
                    <button type="button" onClick={close} className="board-overlay-btn" aria-label="بستن تخته">
                      <X className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                      <div className="truncate text-[15px] font-bold">{board.title || "تخته"}</div>
                      <div className="text-xs opacity-70">{counter}</div>
                    </div>
                    <button type="button" onClick={cycleSpeed} className="board-overlay-btn board-speed" aria-label="تغییر سرعت" title="سرعت نوشتن">
                      <Gauge className="size-4" />
                      <span>{SPEED_LABEL[speed] ?? "عادی"}</span>
                    </button>
                  </div>

                  {/* board */}
                  <motion.div
                    className="min-h-0 flex-1 px-1.5 sm:px-6"
                    initial={{ scale: 0.97, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.98, y: 8 }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  >
                    <div className="board-frame board-frame-expanded mx-auto max-w-5xl">
                      <div className="board-surface">
                        <div ref={scrollRef} className="board-content board-content-expanded">
                          {content}
                        </div>
                        {tray}
                      </div>
                    </div>
                  </motion.div>

                  {/* controls dock */}
                  <div className="board-dock">
                    <div className="mx-auto w-full max-w-xl">
                      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                        <motion.div className="h-full rounded-full bg-[#fde68a]" initial={false} animate={{ width: `${progress * 100}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={replay} disabled={total === 0} className="board-dock-btn" aria-label="از اول">
                          <RotateCcw className="size-5" />
                          <span>از اول</span>
                        </button>
                        <button type="button" onClick={prev} disabled={visible === 0} className="board-dock-btn" aria-label="قدم قبلی">
                          <ChevronRight className="size-6" />
                          <span>قبلی</span>
                        </button>
                        <button
                          type="button"
                          onClick={togglePlay}
                          disabled={total === 0}
                          className="board-dock-play"
                          aria-label={playing ? "توقف" : finished ? "از اول" : "ادامه"}
                        >
                          {playing ? (
                            <Pause className="size-7 fill-current" />
                          ) : finished ? (
                            <RotateCcw className="size-7" />
                          ) : (
                            <Play className="size-7 translate-x-[-2px] fill-current" />
                          )}
                        </button>
                        <button type="button" onClick={next} disabled={visible >= total} className="board-dock-btn" aria-label="قدم بعدی">
                          <ChevronLeft className="size-6" />
                          <span>بعدی</span>
                        </button>
                        <button type="button" onClick={showAll} disabled={visible >= total} className="board-dock-btn" aria-label="نمایش همه">
                          <ChevronsLeft className="size-5" />
                          <span>همه</span>
                        </button>
                      </div>
                      <AnimatePresence>
                        {finished && !playing && (
                          <motion.button
                            type="button"
                            onClick={close}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#86efac] text-[15px] font-bold text-[#14532d]"
                          >
                            <Check className="size-5" strokeWidth={3} /> تمام شد — برگشت به گفتگو
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    </TimeScale.Provider>
  );
}
