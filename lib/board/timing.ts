import type { BoardStep } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Base timings in seconds at "normal" speed — calm, like a teacher writing for a
 * class to copy. Every duration is multiplied by the chosen speed factor.
 */
export const T = {
  writeBase: 0.9,
  writePerChar: 0.05,
  writeMin: 1.3,
  writeMax: 4,
  noteBase: 0.7,
  notePerChar: 0.035,
  noteMin: 1,
  noteMax: 2.8,
  graphAxes: 1.2,
  graphCurve: 2.2,
  graphPoints: 0.9,
  drawItem: 0.8,
  /** Pause between two steps (the teacher steps back and looks at the class). */
  gap: 1.2,
} as const;

export type BoardSpeed = "slow" | "normal" | "fast";

/** Multiplier applied to every duration. */
export const SPEED_FACTOR: Record<BoardSpeed, number> = { slow: 1.6, normal: 1, fast: 0.55 };

export const SPEED_LABEL: Record<BoardSpeed, string> = { slow: "آهسته", normal: "عادی", fast: "تیز" };

export const NEXT_SPEED: Record<BoardSpeed, BoardSpeed> = { slow: "normal", normal: "fast", fast: "slow" };

export function writeDuration(text: string, perChar: number = T.writePerChar): number {
  return clamp(T.writeBase + text.length * perChar, T.writeMin, T.writeMax);
}

export function noteDuration(note?: string): number {
  return note ? clamp(T.noteBase + note.length * T.notePerChar, T.noteMin, T.noteMax) : 0;
}

export function graphDuration(fnCount: number, hasPoints: boolean): number {
  return T.graphAxes + Math.max(1, fnCount) * T.graphCurve + (hasPoints ? T.graphPoints : 0);
}

export function drawDuration(items: number): number {
  return clamp(items * T.drawItem + 0.5, 1.3, 9);
}

/** Seconds a step takes to write at normal speed (before the speed factor). */
export function stepDuration(step: BoardStep): number {
  switch (step.kind) {
    case "heading":
      return writeDuration(step.text, 0.035);
    case "text":
      return writeDuration(step.text, 0.03);
    case "math":
      return writeDuration(step.tex) + noteDuration(step.note);
    case "answer":
      return writeDuration(step.tex) + 0.6 + noteDuration(step.note);
    case "graph":
      return graphDuration(step.graph.fns.length, Boolean(step.graph.points?.length)) + noteDuration(step.note);
    case "draw":
      return drawDuration(step.items.length) + noteDuration(step.note);
  }
}
