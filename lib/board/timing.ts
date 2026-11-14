import type { BoardStep } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Seconds the "writing" of a step takes, roughly like a teacher at the board. */
export function writeDuration(text: string, perChar = 0.032): number {
  return clamp(0.5 + text.length * perChar, 0.8, 2.6);
}

export function noteDuration(note?: string): number {
  return note ? clamp(0.4 + note.length * 0.02, 0.6, 1.6) : 0;
}

export function graphDuration(fnCount: number, hasPoints: boolean): number {
  return 0.7 + Math.max(1, fnCount) * 1.2 + (hasPoints ? 0.5 : 0);
}

export const DRAW_ITEM_SECONDS = 0.45;

export function stepDuration(step: BoardStep): number {
  switch (step.kind) {
    case "heading":
      return writeDuration(step.text, 0.025);
    case "text":
      return writeDuration(step.text, 0.022);
    case "math":
      return writeDuration(step.tex) + noteDuration(step.note);
    case "answer":
      return writeDuration(step.tex) + 0.5 + noteDuration(step.note);
    case "graph":
      return graphDuration(step.graph.fns.length, Boolean(step.graph.points?.length)) + noteDuration(step.note);
    case "draw":
      return clamp(step.items.length * DRAW_ITEM_SECONDS + 0.4, 0.8, 5) + noteDuration(step.note);
  }
}

/** Pause between two steps (the teacher steps back and looks at the class). */
export const STEP_GAP_SECONDS = 0.55;
