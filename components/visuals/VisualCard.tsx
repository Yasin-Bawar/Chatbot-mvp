"use client";

import { AnimatePresence, motion } from "motion/react";
import { Atom, Earth, FlaskConical, LoaderCircle, Maximize2, Orbit, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlays } from "@/lib/overlays";
import { findPreset } from "@/lib/visuals/molecules";
import { parseVisual } from "@/lib/visuals/parse";
import type { VisualKind, VisualSpec } from "@/lib/visuals/types";
import { Markdown } from "@/components/markdown/Markdown";

const Loading = () => (
  <div className="grid h-full place-items-center">
    <LoaderCircle className="size-8 animate-spin opacity-70" />
  </div>
);

// Heavy parts (three.js, map data) load only when a visual is opened.
const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: Loading });
const Molecule = dynamic(() => import("./Molecule"), { ssr: false, loading: Loading });
const Sim = dynamic(() => import("./Sim"), { ssr: false, loading: Loading });

function describe(spec: VisualSpec): { kind: string; icon: React.ReactNode; tone: string; note?: string } {
  if (spec.kind === "globe") {
    return { kind: "کره زمین سه‌بعدی", icon: <Earth className="size-6" />, tone: "visual-tone-globe", note: spec.note };
  }
  if (spec.kind === "molecule") {
    return {
      kind: "مولکول سه‌بعدی",
      icon: <Atom className="size-6" />,
      tone: "visual-tone-molecule",
      note: spec.note ?? findPreset(spec.preset ?? spec.title)?.note,
    };
  }
  return spec.type === "states"
    ? { kind: "آزمایش کیمیا · حالت‌های ماده", icon: <FlaskConical className="size-6" />, tone: "visual-tone-states", note: spec.note }
    : { kind: "آزمایش فزیک", icon: <Orbit className="size-6" />, tone: "visual-tone-sim", note: spec.note };
}

function titleOf(spec: VisualSpec): string {
  if (spec.kind === "molecule") return spec.title || findPreset(spec.preset)?.title || "مولکول";
  return spec.title;
}

/**
 * A ```globe / ```molecule / ```sim block. In the chat it is a light card; the
 * visual itself opens full screen (by itself once, for a new answer).
 */
export function VisualCard({ lang, raw, streaming }: { lang: VisualKind; raw: string; streaming: boolean }) {
  const id = useId();
  const pathname = usePathname();
  const spec = useMemo(() => (streaming ? null : parseVisual(lang, raw)), [lang, raw, streaming]);
  const openId = useOverlays((s) => s.visual);
  const otherOpen = useOverlays((s) => s.board !== null || s.quiz !== null || (s.visual !== null && s.visual !== id));
  const expanded = openId === id && pathname === "/";
  const [liveAtMount] = useState(streaming);
  const autoOpened = useRef(false);

  const open = useCallback(() => useOverlays.setState({ visual: id }), [id]);
  const close = useCallback(() => {
    if (useOverlays.getState().visual === id) useOverlays.setState({ visual: null });
  }, [id]);

  // A visual in a new answer opens full screen by itself once it is complete,
  // after any board or quiz that is open has been closed.
  useEffect(() => {
    if (!liveAtMount || autoOpened.current || !spec || otherOpen || pathname !== "/") return;
    const t = setTimeout(() => {
      autoOpened.current = true;
      open();
    }, 450);
    return () => clearTimeout(t);
  }, [liveAtMount, spec, otherOpen, pathname, open]);

  // Leaving the chat closes it.
  useEffect(() => close, [close]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  if (!spec) {
    return (
      <div className="visual-card not-prose" aria-busy={streaming}>
        <span className="visual-card-icon visual-tone-globe">
          <LoaderCircle className="size-6 animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{streaming ? "دانا نمایش را آماده می‌کند…" : "این نمایش آماده نشد"}</div>
          <div className="text-xs text-muted">{streaming ? "چند لحظه صبر کنید" : "از دانا بخواهید دوباره بفرستد."}</div>
        </div>
      </div>
    );
  }

  const info = describe(spec);
  const title = titleOf(spec);

  return (
    <>
      <motion.button
        type="button"
        onClick={open}
        className="visual-card not-prose"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
      >
        <span className={`visual-card-icon ${info.tone}`}>{info.icon}</span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block text-[11.5px] font-semibold text-primary">{info.kind}</span>
          <span className="block truncate text-[15px] font-bold">{title}</span>
        </span>
        <span className="visual-card-open">
          <Maximize2 className="size-4" /> {expanded ? "باز است" : "نمایش"}
        </span>
      </motion.button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <motion.div
                dir="rtl"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="visual-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="visual-overlay-header">
                  <button type="button" onClick={close} className="board-overlay-btn" aria-label="بستن">
                    <X className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <div className="truncate text-[15px] font-bold">{title}</div>
                    <div className="text-xs opacity-70">{info.kind}</div>
                  </div>
                  <span className={`visual-header-icon ${info.tone}`}>{info.icon}</span>
                </div>
                <motion.div
                  className="visual-body"
                  initial={{ scale: 0.98, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  {spec.kind === "globe" ? <Globe spec={spec} /> : spec.kind === "molecule" ? <Molecule spec={spec} /> : <Sim spec={spec} />}
                </motion.div>
                {info.note && <Note text={info.note} />}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** The teacher's note under a visual. On phones it shows two lines; tap to read all. */
function Note({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="visual-note"
      data-open={open ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
    >
      <Markdown text={text} />
    </div>
  );
}
