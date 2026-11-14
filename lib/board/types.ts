/** A single thing the teacher writes or draws on the board. */
export type ChalkColor = "white" | "yellow" | "pink" | "blue" | "green" | "orange";

export type Vec = [number, number];

export type DrawItem =
  | { t: "point"; at: Vec; label?: string; color?: ChalkColor }
  | { t: "line"; from: Vec; to: Vec; label?: string; dashed?: boolean; color?: ChalkColor }
  | { t: "arrow"; from: Vec; to: Vec; label?: string; color?: ChalkColor }
  | { t: "polygon"; points: Vec[]; label?: string; fill?: boolean; color?: ChalkColor }
  | { t: "circle"; center: Vec; r: number; label?: string; color?: ChalkColor }
  | { t: "angle"; at: Vec; from: Vec; to: Vec; label?: string; right?: boolean; color?: ChalkColor }
  | { t: "text"; at: Vec; text: string; color?: ChalkColor };

export interface GraphSpec {
  fns: string[];
  labels?: string[];
  x?: [number, number];
  y?: [number, number];
  points?: Array<[number, number] | [number, number, string]>;
}

export type BoardStep =
  | { kind: "heading"; text: string }
  | { kind: "math"; tex: string; note?: string; color?: ChalkColor }
  | { kind: "text"; text: string; color?: ChalkColor }
  | { kind: "graph"; graph: GraphSpec; note?: string }
  | { kind: "draw"; items: DrawItem[]; grid?: boolean; note?: string }
  | { kind: "answer"; tex: string; note?: string };

export interface Board {
  title?: string;
  steps: BoardStep[];
}
