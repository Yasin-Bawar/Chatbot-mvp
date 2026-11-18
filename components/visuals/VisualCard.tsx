"use client";

import { motion } from "motion/react";
import { LoaderCircle, Maximize2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useOverlays } from "@/lib/overlays";
import { parseVisual } from "@/lib/visuals/parse";
import type { VisualKind } from "@/lib/visuals/types";
import { visualTheme } from "./theme";
import { describeVisual, VisualLayer, visualTitle } from "./VisualLayer";

/**
 * A ```globe / ```molecule / ```sim / ```anatomy block. In the chat it is a light card; the
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

  const info = describeVisual(spec);
  const theme = visualTheme(spec);
  const title = visualTitle(spec);
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
      <VisualLayer spec={spec} open={expanded} onClose={close} />
    </>
  );
}
