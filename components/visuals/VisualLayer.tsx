"use client";

import { AnimatePresence, motion } from "motion/react";
import { Atom, Earth, FlaskConical, LoaderCircle, Orbit, PersonStanding, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { findPreset, formulaOf } from "@/lib/visuals/molecules";
import { CHEMISTRY_SIMS } from "@/lib/visuals/physics";
import type { VisualSpec } from "@/lib/visuals/types";
import { Markdown } from "@/components/markdown/Markdown";
import { visualTheme } from "./theme";

const Loading = () => (
  <div className="grid h-full place-items-center">
    <LoaderCircle className="size-8 animate-spin opacity-70" />
  </div>
);

// Heavy parts (three.js, map data, the body model) load only when a visual is opened.
const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: Loading });
const Molecule = dynamic(() => import("./Molecule"), { ssr: false, loading: Loading });
const Sim = dynamic(() => import("./Sim"), { ssr: false, loading: Loading });
const Anatomy = dynamic(() => import("./Anatomy"), { ssr: false, loading: Loading });

export function describeVisual(spec: VisualSpec): { icon: React.ReactNode; note?: string; subtitle?: string } {
  if (spec.kind === "globe") return { icon: <Earth />, note: spec.note };
  if (spec.kind === "molecule") {
    const preset = findPreset(spec.preset ?? spec.title);
    const formula = spec.formula || preset?.formula || (spec.atoms.length ? formulaOf(spec.atoms) : "");
    return { icon: <Atom />, note: spec.note ?? preset?.note, subtitle: formula ? `$\\mathrm{${formula}}$` : undefined };
  }
  if (spec.kind === "anatomy") return { icon: <PersonStanding />, note: spec.note };
  return { icon: CHEMISTRY_SIMS.includes(spec.type) ? <FlaskConical /> : <Orbit />, note: spec.note };
}

export function visualTitle(spec: VisualSpec): string {
  if (spec.kind === "molecule") return spec.title || findPreset(spec.preset)?.title || "مولکول";
  return spec.title;
}

/** The full-screen layer of a visual (shared by the chat cards and the «نمایش‌ها» page). */
export function VisualLayer({ spec, open, onClose }: { spec: VisualSpec | null; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>{open && spec && <Overlay spec={spec} onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}

function Overlay({ spec, onClose }: { spec: VisualSpec; onClose: () => void }) {
  const info = describeVisual(spec);
  const theme = visualTheme(spec);
  const title = visualTitle(spec);
  const accentStyle = { "--accent": theme.accent, "--accent-soft": theme.accentSoft } as React.CSSProperties;
  return (
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
        <button type="button" onClick={onClose} className="visual-icon-btn" aria-label="بستن">
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
