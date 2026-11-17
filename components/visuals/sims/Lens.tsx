"use client";

import { lens } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function lensReadouts(p: Record<string, number>): Readout[] {
  const l = lens(p.focal, p.object);
  if (l.atInfinity) return [{ label: "تصویر", value: "بی‌نهایت", tone: "warn" }];
  return [
    { label: "فاصله تصویر", value: fmt(Math.abs(l.image)), unit: "cm", tone: "accent" },
    { label: "بزرگنمایی", value: fmt(Math.abs(l.magnification), 2), unit: "×" },
    { label: "تصویر", value: l.real ? "حقیقی" : "مجازی" },
  ];
}

/** An upright (or upside-down) arrow standing on the axis. */
function standing(ctx: CanvasRenderingContext2D, x: number, axis: number, height: number, color: string, dashed = false) {
  const tip = axis - height;
  const dir = Math.sign(height) || 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  if (dashed) ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x, axis);
  ctx.lineTo(x, tip + dir * 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x, tip);
  ctx.lineTo(x - 7, tip + dir * 12);
  ctx.lineTo(x + 7, tip + dir * 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function LensCanvas({ p, playing, accent }: SimProps) {
  const ref = useAnimatedCanvas((ctx, w, h, _dt, time) => {
    const f = p.focal;
    const u = p.object;
    const l = lens(f, u);

    grid(ctx, w, h);
    const axis = h * 0.55;
    const lx = w / 2;
    const reach = Math.max(u, 2.2 * f, l.atInfinity ? 0 : Math.min(Math.abs(l.image), 70)) * 1.12;
    const k = (w / 2 - 16) / reach; // pixels per cm
    const X = (cm: number) => lx + cm * k; // + is to the right of the lens
    const objH = Math.min(h * 0.24, 70);

    // Axis, focal points.
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, axis);
    ctx.lineTo(w, axis);
    ctx.stroke();
    for (const [cm, label] of [
      [-f, "F"],
      [f, "F"],
      [-2 * f, "2F"],
      [2 * f, "2F"],
    ] as const) {
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(X(cm), axis, 3, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, label, X(cm), axis + 16, { size: 11, color: C.muted, weight: 700 });
    }

    // The lens (thicker for a shorter focal length).
    const lh = Math.min(h * 0.38, 130);
    const bulge = 10 + 120 / f;
    ctx.fillStyle = "rgba(14, 165, 233, 0.16)";
    ctx.strokeStyle = "rgba(2, 132, 199, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, axis - lh);
    ctx.quadraticCurveTo(lx + bulge, axis, lx, axis + lh);
    ctx.quadraticCurveTo(lx - bulge, axis, lx, axis - lh);
    ctx.fill();
    ctx.stroke();

    // Object.
    const ox = X(-u);
    standing(ctx, ox, axis, objH, C.ink);

    // Rays, with "light" flowing along them.
    const top = axis - objH;
    const flow = playing ? -time * 40 : 0;
    const ray = (pts: [number, number][], dashed = false) => {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = dashed ? 0.5 : 1;
      ctx.lineWidth = dashed ? 1.5 : 2;
      ctx.setLineDash(dashed ? [4, 5] : [14, 6]);
      ctx.lineDashOffset = dashed ? 0 : flow;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    };
    /** Continues the line a→b to the edge of the canvas. */
    const beyond = (a: [number, number], b: [number, number]): [number, number] => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const s = dx === 0 ? 1 : (w + 40 - a[0]) / dx;
      return [a[0] + dx * s, a[1] + dy * s];
    };
    const atLens1: [number, number] = [lx, top];
    const focusRight: [number, number] = [X(f), axis];
    // 1. Parallel to the axis, then through F on the far side.
    ray([[ox, top], atLens1, beyond(atLens1, focusRight)]);
    // 2. Straight through the centre.
    const centre: [number, number] = [lx, axis];
    ray([[ox, top], beyond([ox, top], centre)]);
    // 3. Through the near F (or as if from it), then parallel.
    if (u > f + 0.01) {
      const yAtLens = axis + ((top - axis) * (0 - -f)) / (-u - -f);
      ray([
        [ox, top],
        [lx, yAtLens],
        [w + 40, yAtLens],
      ]);
    }

    if (l.atInfinity) {
      text(ctx, "تصویر در بی‌نهایت", w - 16, 22, { size: 13, align: "right", color: C.warm, weight: 700 });
      return;
    }
    const ix = X(l.image);
    const ih = objH * l.magnification;
    if (!l.real) {
      // Virtual image: trace the rays back (dashed) to where they seem to come from.
      ray([atLens1, [ix, axis - ih]], true);
      ray([centre, [ix, axis - ih]], true);
    }
    if (ix > -40 && ix < w + 40 && Math.abs(ih) < h) {
      standing(ctx, ix, axis, ih, C.warm, !l.real);
      text(ctx, l.real ? "حقیقی" : "مجازی", ix, Math.min(h - 14, Math.max(14, axis - ih + (ih > 0 ? -16 : 16))), {
        size: 12,
        color: C.warm,
        weight: 700,
      });
    }
  });

  return <canvas ref={ref} />;
}
