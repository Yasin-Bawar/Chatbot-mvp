"use client";

import katex from "katex";
import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import type { ChalkColor } from "@/lib/board/types";
import { cn } from "@/lib/utils";

export const CHALK: Record<ChalkColor, string> = {
  white: "#F4F1E8",
  yellow: "#FDE68A",
  pink: "#F9A8D4",
  blue: "#93C5FD",
  green: "#86EFAC",
  orange: "#FDBA74",
};

function texToHtml(tex: string, display = false): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: "ignore", output: "html" });
  } catch {
    return tex.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  }
}

/** A LaTeX formula written in chalk (always left-to-right). */
export const ChalkMath = memo(function ChalkMath({ tex, className }: { tex: string; className?: string }) {
  const html = useMemo(() => texToHtml(tex), [tex]);
  return <span dir="ltr" className={cn("chalk-math", className)} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Dari text with optional inline $…$ math. */
export const ChalkText = memo(function ChalkText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { math: boolean; value: string }[] = [];
    const re = /\$\$?([^$]+?)\$\$?/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ math: false, value: text.slice(last, m.index) });
      out.push({ math: true, value: m[1] });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ math: false, value: text.slice(last) });
    return out;
  }, [text]);
  return (
    <>
      {parts.map((p, i) => (p.math ? <ChalkMath key={i} tex={p.value} /> : <span key={i}>{p.value}</span>))}
    </>
  );
});

/**
 * Reveals its content like chalk being written: a wipe in the writing
 * direction with a small piece of chalk travelling along the edge.
 */
export function ChalkWrite({
  children,
  dir,
  animate,
  delay = 0,
  duration,
  className,
}: {
  children: ReactNode;
  dir: "ltr" | "rtl";
  animate: boolean;
  delay?: number;
  duration: number;
  className?: string;
}) {
  const style = { "--dur": `${duration}s`, "--delay": `${delay}s` } as CSSProperties;
  return (
    <span dir={dir} className={cn("relative inline-block max-w-full", className)} style={style}>
      <span className={cn("block", animate && (dir === "ltr" ? "wipe-ltr" : "wipe-rtl"))}>{children}</span>
      {animate && <span aria-hidden className={cn("chalk-piece", dir === "ltr" ? "chalk-move-ltr" : "chalk-move-rtl")} />}
    </span>
  );
}
