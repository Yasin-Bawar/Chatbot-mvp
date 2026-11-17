"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseEquation, REACTIONS, totalAtoms, type Term } from "@/lib/visuals/chemistry";
import { elementInfo } from "@/lib/visuals/molecules";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

type Pt = [number, number];

/** "H2O" → "H₂O" (coefficients stay normal size). */
export function subscript(formula: string): string {
  return formula.replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + [...d].map((c) => "₀₁₂₃₄₅₆₇₈₉"[+c]).join(""));
}

function termText(t: Term): string {
  return `${t.coef > 1 ? t.coef : ""}${subscript(t.formula)}`;
}

export function equationText(eq: { reactants: Term[]; products: Term[] }): string {
  return `${eq.reactants.map(termText).join(" + ")}  →  ${eq.products.map(termText).join(" + ")}`;
}

function equationOf(source: string | undefined) {
  return parseEquation(source ?? "") ?? parseEquation(REACTIONS.water)!;
}

export function reactionReadouts(_p: Record<string, number>, equation?: string): Readout[] {
  const eq = equationOf(equation);
  const left = totalAtoms(eq.reactants);
  const right = totalAtoms(eq.products);
  return Object.keys(left)
    .slice(0, 4)
    .map((el) => ({
      label: el,
      value: left[el] === right[el] ? fmt(left[el], 0) : `${fmt(left[el], 0)} ≠ ${fmt(right[el] ?? 0, 0)}`,
      tone: left[el] === right[el] ? undefined : ("warn" as const),
    }));
}

const radius = (el: string) => (el === "H" ? 0.7 : 1);

/** Atoms of one molecule, laid out around the origin in "atom" units. */
function moleculeShape(atoms: Record<string, number>): { el: string; at: Pt }[] {
  const list: string[] = [];
  for (const [el, n] of Object.entries(atoms)) for (let i = 0; i < n; i++) list.push(el);
  if (list.length === 1) return [{ el: list[0], at: [0, 0] }];
  if (list.length === 2) {
    const d = 0.45 * (radius(list[0]) + radius(list[1]));
    return [
      { el: list[0], at: [-d, 0] },
      { el: list[1], at: [d, 0] },
    ];
  }
  // One central atom (H2O, CH4, CO2, NH3): the others around it.
  const singles = Object.entries(atoms).filter(([, n]) => n === 1);
  if (singles.length === 1 && list.length <= 7) {
    const centre = singles[0][0];
    const others = list.filter((el) => el !== centre);
    const k = others.length;
    const bent = k === 2 && (centre === "O" || centre === "S");
    return [
      { el: centre, at: [0, 0] },
      ...others.map((el, i) => {
        const a = bent ? Math.PI / 2 + (i ? 1 : -1) * 0.91 : -Math.PI / 2 + (i / k) * Math.PI * 2 + (k === 2 ? Math.PI / 2 : 0);
        const d = 0.9 * (radius(centre) + radius(el));
        return { el, at: [d * Math.cos(a), d * Math.sin(a)] as Pt };
      }),
    ];
  }
  // A short chain (NaOH), else a compact sunflower cluster (Fe2O3, glucose).
  if (list.length <= 4) {
    let x = 0;
    const out = list.map((el, i) => {
      if (i) x += 0.9 * (radius(list[i - 1]) + radius(el));
      return { el, at: [x, 0] as Pt };
    });
    return out.map((a) => ({ ...a, at: [a.at[0] - x / 2, 0] as Pt }));
  }
  const sorted = [...list].sort((a, b) => radius(b) - radius(a));
  return sorted.map((el, i) => {
    const r = 1.75 * Math.sqrt(i);
    const a = i * 2.39996;
    return { el, at: [r * Math.cos(a), r * Math.sin(a)] as Pt };
  });
}

interface Molecule {
  atoms: { el: string; at: Pt }[];
  size: number;
}

function sideMolecules(terms: Term[]): Molecule[] {
  const out: Molecule[] = [];
  for (const t of terms) {
    const atoms = moleculeShape(t.atoms);
    const size = Math.max(...atoms.map((a) => Math.hypot(...a.at) + radius(a.el)));
    for (let i = 0; i < t.coef; i++) out.push({ atoms, size });
  }
  return out;
}

/** Places molecules in a grid inside a box; returns each atom's screen position and molecule bubbles. */
function place(mols: Molecule[], box: { x: number; y: number; w: number; h: number }) {
  const biggest = Math.max(...mols.map((m) => m.size));
  let best = { cols: 1, rows: mols.length, scale: 0 };
  for (let cols = 1; cols <= mols.length; cols++) {
    const rows = Math.ceil(mols.length / cols);
    const scale = Math.min(box.w / cols, box.h / rows) / (2 * biggest * 1.18);
    if (scale > best.scale) best = { cols, rows, scale };
  }
  const s = Math.min(best.scale, 36);
  // Cells just big enough for the largest molecule; the block sits in the middle of the box.
  const cell = Math.min(box.w / best.cols, box.h / best.rows, 2 * biggest * 1.18 * s * 1.15);
  const cw = cell;
  const ch = cell;
  const top = box.y + (box.h - best.rows * ch) / 2;
  const atoms: { el: string; pos: Pt; mol: number; centre: Pt }[] = [];
  const bubbles: { centre: Pt; r: number }[] = [];
  mols.forEach((m, i) => {
    const row = Math.floor(i / best.cols);
    const inRow = Math.min(best.cols, mols.length - row * best.cols);
    const col = i % best.cols;
    const centre: Pt = [box.x + (box.w - inRow * cw) / 2 + (col + 0.5) * cw, top + (row + 0.5) * ch];
    bubbles.push({ centre, r: (m.size + 0.35) * s });
    for (const a of m.atoms) atoms.push({ el: a.el, pos: [centre[0] + a.at[0] * s, centre[1] + a.at[1] * s], mol: i, centre });
  });
  return { atoms, bubbles, scale: s };
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 150;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Timeline in seconds.
const HOLD = 1.2;
const SPLIT = 0.6;
const TRAVEL = 2;
const JOIN = 0.6;
const CYCLE = HOLD + SPLIT + TRAVEL + JOIN + 2.6;

export function ReactionCanvas({ playing, run, accent, equation }: SimProps) {
  const eq = useMemo(() => equationOf(equation), [equation]);
  const left = useMemo(() => sideMolecules(eq.reactants), [eq]);
  const right = useMemo(() => sideMolecules(eq.products), [eq]);
  const t = useRef(0);
  useEffect(() => {
    t.current = 0;
  }, [run, eq]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    if (playing && eq.balanced) t.current = (t.current + dt) % CYCLE;
    const time = t.current;

    grid(ctx, w, h);
    text(ctx, equationText(eq), w / 2, 26, { size: Math.min(20, Math.max(14, w / 40)), weight: 700, color: C.ink });

    const top = 50;
    const arrowW = Math.min(70, w * 0.1);
    const sideW = (w - arrowW - 32) / 2;
    const boxH = h - top - 20;
    const L = place(left, { x: 16, y: top, w: sideW, h: boxH });
    const R = place(right, { x: w - 16 - sideW, y: top, w: sideW, h: boxH });

    // Arrow in the middle, with the balance check.
    const ax = w / 2;
    const ay = top + boxH / 2;
    ctx.strokeStyle = C.muted;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax - arrowW / 2 + 6, ay);
    ctx.lineTo(ax + arrowW / 2 - 10, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + arrowW / 2 - 4, ay);
    ctx.lineTo(ax + arrowW / 2 - 14, ay - 7);
    ctx.lineTo(ax + arrowW / 2 - 14, ay + 7);
    ctx.closePath();
    ctx.fill();
    text(ctx, eq.balanced ? "✓" : "⚠", ax, ay - 24, { size: 24, weight: 800, color: eq.balanced ? accent : C.warm });
    if (!eq.balanced) text(ctx, "معادله متوازن نیست", ax, ay + 26, { size: 12, color: C.warm, weight: 700 });

    // Phases of the animation.
    const split = clamp01((time - HOLD) / SPLIT);
    const travel = ease(clamp01((time - HOLD - SPLIT) / TRAVEL));
    const join = clamp01((time - HOLD - SPLIT - TRAVEL) / JOIN);
    const leftAlpha = eq.balanced ? 1 - split : 1;
    const rightAlpha = eq.balanced ? join : 1;

    const bubble = (b: { centre: Pt; r: number }, alpha: number) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.centre[0], b.centre[1], b.r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.08 * alpha;
      ctx.fill();
      ctx.globalAlpha = 0.3 * alpha;
      ctx.stroke();
      ctx.restore();
    };
    L.bubbles.forEach((b) => bubble(b, leftAlpha));
    R.bubbles.forEach((b) => bubble(b, rightAlpha));

    const drawAtom = (el: string, [x, y]: Pt, s: number) => {
      const info = elementInfo(el);
      const r = radius(el) * s * 0.92;
      ctx.fillStyle = info.color;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (r >= 8)
        text(ctx, el, x, y + 0.5, { size: Math.min(14, r * 0.95), weight: 700, color: isDark(info.color) ? "#fff" : C.ink });
    };

    if (!eq.balanced) {
      // Nothing moves: atoms can't be created or destroyed.
      L.atoms.forEach((a) => drawAtom(a.el, a.pos, L.scale));
      R.atoms.forEach((a) => drawAtom(a.el, a.pos, R.scale));
      return;
    }

    // Each atom moves from its place in a reactant to a place in a product of the same element.
    const used = new Map<string, number>();
    const pushOut = (a: { pos: Pt; centre: Pt }, k: number): Pt => [
      a.pos[0] + (a.pos[0] - a.centre[0]) * 0.35 * k,
      a.pos[1] + (a.pos[1] - a.centre[1]) * 0.35 * k,
    ];
    L.atoms.forEach((a, i) => {
      const n = used.get(a.el) ?? 0;
      used.set(a.el, n + 1);
      const targets = R.atoms.filter((b) => b.el === a.el);
      const b = targets[n % targets.length];
      const from = pushOut(a, split);
      const to = pushOut(b, 1 - join);
      const arc = Math.sin(Math.PI * travel) * (i % 2 ? 18 : -18);
      const x = from[0] + (to[0] - from[0]) * travel;
      const y = from[1] + (to[1] - from[1]) * travel + arc;
      const s = L.scale + (R.scale - L.scale) * travel;
      drawAtom(a.el, [x, y], s);
    });
  });

  return <canvas ref={ref} />;
}
