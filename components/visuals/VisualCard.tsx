"use client";

import { AnimatePresence, motion } from "motion/react";
import { Atom, Earth, FlaskConical, Heart, LoaderCircle, Maximize2, Orbit, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlays } from "@/lib/overlays";
import { findPreset, formulaOf } from "@/lib/visuals/molecules";
import { parseVisual } from "@/lib/visuals/parse";
import type { VisualKind, VisualSpec } from "@/lib/visuals/types";
import { Markdown } from "@/components/markdown/Markdown";
import { visualTheme } from "./theme";

const Loading = () => (
  <div className="grid h-full place-items-center">
    <LoaderCircle className="size-8 animate-spin opacity-70" />
  </div>
);

// Heavy parts (three.js, map data) load only when a visual is opened.
const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: Loading });
const Molecule = dynamic(() => import("./Molecule"), { ssr: false, loading: Loading });
const Sim = dynamic(() => import("./Sim"), { ssr: false, loading: Loading });
const Anatomy = dynamic(() => import("./Anatomy"), { ssr: false, loading: Loading });

function describe(spec: VisualSpec): { icon: React.ReactNode; note?: string; subtitle?: string } {
  if (spec.kind === "globe") return { icon: <Earth />, note: spec.note };
  if (spec.kind === "anatomy") return { icon: <Heart />, note: spec.note };
  if (spec.kind === "molecule") {
    const preset = findPreset(spec.preset ?? spec.title);
    const formula = spec.formula || preset?.formula || (spec.atoms.length ? formulaOf(spec.atoms) : "");
    return { icon: <Atom />, note: spec.note ?? preset?.note, subtitle: formula ? `$\\mathrm{${formula}}$` : undefined };
  }
  return { icon: spec.type === "states" ? <FlaskConical /> : <Orbit />, note: spec.note };
}

function titleOf(spec: VisualSpec): string {
  if (spec.kind === "molecule") return spec.title || findPreset(spec.preset)?.title || "مولکول";
  return spec.title;
}

/**
 * A ```globe / ```molecule / ```anatomy / ```sim block. In the chat it is a light card; the
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
        <span className="visual-card-icon">
          <LoaderCircle className="animate-spin" />
        </span>
        <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-muted">
          {streaming ? "در حال آماده شدن…" : "این نمایش آماده نشد"}
        </span>
      </div>
    );
  }

  const info = describe(spec);
  const theme = visualTheme(spec);
  const title = titleOf(spec);
  const accentStyle = { "--accent": theme.accent, "--accent-soft": theme.accentSoft } as React.CSSProperties;

  return (
    <>
      <motion.button
        type="button"
        onClick={open}
        className="visual-card not-prose"
        style={accentStyle}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label={`${title} — نمایش`}
      >
        <span className="visual-card-icon">{info.icon}</span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block truncate text-[15px] font-bold">{title}</span>
          <span className="visual-subject">
            {theme.label} · {theme.kind}
          </span>
        </span>
        <span className="visual-card-open" aria-hidden>
          <Maximize2 />
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
                data-theme={theme.dark ? "dark" : "light"}
                style={accentStyle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="visual-overlay-header">
                  <button type="button" onClick={close} className="visual-icon-btn" aria-label="بستن">
                    <X />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <div className="truncate text-[15.5px] font-bold">{title}</div>
                    {info.subtitle && (
                      <div className="visual-header-formula" dir="ltr">
                        <Markdown text={info.subtitle} />
                      </div>
                    )}
                  </div>
                  <span className="visual-subject-chip">{theme.label}</span>
                </div>
                <motion.div
                  className="visual-body"
                  initial={{ scale: 0.98, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  {spec.kind === "globe" ? (
                    <Globe spec={spec} />
                  ) : spec.kind === "molecule" ? (
                    <Molecule spec={spec} />
                  ) : spec.kind === "anatomy" ? (
                    <Anatomy spec={spec} />
                  ) : (
                    <Sim spec={spec} accent={theme.accent} />
                  )}
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
