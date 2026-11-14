import { parseLooseJson } from "@/lib/json-repair";
import type { Board, BoardStep, ChalkColor, DrawItem, GraphSpec, Vec } from "./types";

const COLORS = new Set<ChalkColor>(["white", "yellow", "pink", "blue", "green", "orange"]);

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const color = (v: unknown): ChalkColor | undefined => (COLORS.has(v as ChalkColor) ? (v as ChalkColor) : undefined);

function vec(v: unknown): Vec | undefined {
  if (!Array.isArray(v) || v.length < 2) return undefined;
  const x = num(v[0]);
  const y = num(v[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function range(v: unknown): [number, number] | undefined {
  const r = vec(v);
  return r && r[1] > r[0] ? r : undefined;
}

function drawItem(raw: unknown): DrawItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = str(o.label);
  const c = color(o.color);
  switch (o.t ?? o.type) {
    case "point": {
      const at = vec(o.at);
      return at ? { t: "point", at, label, color: c } : null;
    }
    case "line":
    case "segment": {
      const from = vec(o.from);
      const to = vec(o.to);
      return from && to ? { t: "line", from, to, label, dashed: o.dashed === true, color: c } : null;
    }
    case "arrow":
    case "vector":
    case "force": {
      const from = vec(o.from);
      const to = vec(o.to);
      return from && to ? { t: "arrow", from, to, label, color: c } : null;
    }
    case "polygon":
    case "triangle":
    case "rect": {
      const points = Array.isArray(o.points) ? o.points.map(vec).filter((p): p is Vec => Boolean(p)) : [];
      return points.length >= 2 ? { t: "polygon", points, label, fill: o.fill === true, color: c } : null;
    }
    case "circle": {
      const center = vec(o.center ?? o.c);
      const r = num(o.r);
      return center && r && r > 0 ? { t: "circle", center, r, label, color: c } : null;
    }
    case "angle": {
      const at = vec(o.at);
      const from = vec(o.from);
      const to = vec(o.to);
      return at && from && to ? { t: "angle", at, from, to, label, right: o.right === true, color: c } : null;
    }
    case "text": {
      const at = vec(o.at);
      const text = str(o.text) ?? label;
      return at && text ? { t: "text", at, text, color: c } : null;
    }
    default:
      return null;
  }
}

/** Converts one parsed JSON object into a board step (or title). */
function toStep(o: Record<string, unknown>): BoardStep | { title: string } | null {
  const note = str(o.note);
  if (str(o.title) && Object.keys(o).length === 1) return { title: o.title as string };
  if (str(o.step) ?? str(o.heading)) return { kind: "heading", text: (str(o.step) ?? str(o.heading))! };
  if (str(o.math) ?? str(o.tex)) return { kind: "math", tex: (str(o.math) ?? str(o.tex))!, note, color: color(o.color) };
  if (str(o.answer)) return { kind: "answer", tex: o.answer as string, note };
  if (str(o.text)) return { kind: "text", text: o.text as string, color: color(o.color) };
  if (o.graph && typeof o.graph === "object") {
    const g = o.graph as Record<string, unknown>;
    const fns = (Array.isArray(g.fns) ? g.fns : typeof g.fn === "string" ? [g.fn] : []).filter(
      (f): f is string => typeof f === "string" && f.trim().length > 0,
    );
    if (!fns.length && !Array.isArray(g.points)) return null;
    const points = Array.isArray(g.points)
      ? g.points
          .map((p) => {
            const v = vec(p);
            if (!v) return null;
            const label = Array.isArray(p) ? str(p[2]) : undefined;
            return label ? ([v[0], v[1], label] as [number, number, string]) : v;
          })
          .filter((p): p is [number, number] | [number, number, string] => Boolean(p))
      : undefined;
    const graph: GraphSpec = {
      fns: fns.slice(0, 4),
      labels: Array.isArray(g.labels) ? g.labels.filter((l): l is string => typeof l === "string") : undefined,
      x: range(g.x),
      y: range(g.y),
      points,
    };
    return { kind: "graph", graph, note };
  }
  if (o.draw && typeof o.draw === "object") {
    const d = o.draw as Record<string, unknown>;
    const list = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : [];
    const items = list.map(drawItem).filter((i): i is DrawItem => Boolean(i)).slice(0, 60);
    return items.length ? { kind: "draw", items, grid: (d as { grid?: unknown }).grid === true, note } : null;
  }
  return null;
}

/**
 * Parses a ```board block. Each line is one JSON object (JSON Lines), so steps
 * can appear on the board while the answer is still streaming. While streaming,
 * an unfinished last line is ignored. A single JSON object {title, steps:[…]}
 * is accepted as a fallback.
 */
export function parseBoard(raw: string, streaming = false): Board {
  const board: Board = { steps: [] };
  const lines = raw.split("\n");
  if (streaming && !raw.endsWith("\n")) lines.pop();

  let parsedAny = false;
  for (const line of lines) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed.startsWith("{")) continue;
    const obj = parseLooseJson<Record<string, unknown>>(trimmed);
    if (!obj || typeof obj !== "object") continue;
    parsedAny = true;
    const step = toStep(obj);
    if (!step) continue;
    if ("title" in step) board.title = step.title;
    else board.steps.push(step);
  }

  if (!parsedAny && !streaming) {
    const whole = parseLooseJson<{ title?: unknown; steps?: unknown }>(raw);
    if (whole && Array.isArray(whole.steps)) {
      board.title = str(whole.title);
      for (const s of whole.steps) {
        if (s && typeof s === "object") {
          const step = toStep(s as Record<string, unknown>);
          if (step && !("title" in step)) board.steps.push(step);
        }
      }
    }
  }
  return board;
}
