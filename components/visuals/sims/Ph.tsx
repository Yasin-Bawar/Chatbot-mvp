"use client";

import { useRef } from "react";
import { PH_EXAMPLES, PH_KIND_FA, phColor, phKind } from "@/lib/visuals/chemistry";
import { C, grid, seeded, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

function nearest(ph: number) {
  return PH_EXAMPLES.reduce((a, b) => (Math.abs(b.ph - ph) < Math.abs(a.ph - ph) ? b : a));
}

export function phReadouts(p: Record<string, number>): Readout[] {
  return [
    { label: "نوع", value: PH_KIND_FA[phKind(p.ph)], tone: "accent" },
    { label: "مثل", value: nearest(p.ph).name },
  ];
}

const IONS = 26;

export function PhCanvas({ p, playing }: SimProps) {
  const ions = useRef(Array.from({ length: IONS }, (_, i) => ({ x: seeded(i), y: seeded(i + 100), seed: i * 2.1 })));

  const ref = useAnimatedCanvas((ctx, w, h, dt, time) => {
    grid(ctx, w, h);
    const color = phColor(p.ph);

    // Beaker.
    const bw = Math.min(w * 0.5, 300);
    const bh = Math.min(h * 0.56, 260);
    const bx = (w - bw) / 2;
    const by = 34;
    const level = by + bh * 0.22;
    const wave = playing ? Math.sin(time * 2) * 2 : 0;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(bx, level + wave);
    ctx.quadraticCurveTo(bx + bw / 2, level - wave * 2, bx + bw, level - wave);
    ctx.lineTo(bx + bw, by + bh - 12);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 12, by + bh);
    ctx.lineTo(bx + 12, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 12);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ions: more H⁺ in an acid, more OH⁻ in a base, equal when neutral.
    const acidShare = 1 / (1 + Math.pow(10, (p.ph - 7) / 3.5));
    const nH = Math.round(IONS * acidShare);
    ions.current.forEach((q, i) => {
      if (playing) {
        q.x += Math.sin(time * 0.7 + q.seed) * dt * 0.05;
        q.y += Math.cos(time * 0.6 + q.seed * 1.7) * dt * 0.05;
        q.x = (q.x + 1) % 1;
        q.y = Math.min(1, Math.max(0, q.y));
      }
      const x = bx + 16 + q.x * (bw - 32);
      const y = level + 16 + q.y * (by + bh - level - 32);
      const acid = i < nH;
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text(ctx, acid ? "+" : "−", x, y + 0.5, { size: 13, color: C.ink, weight: 800 });
    });

    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by - 6);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + bh - 12);
    ctx.quadraticCurveTo(bx, by + bh, bx + 12, by + bh);
    ctx.lineTo(bx + bw - 12, by + bh);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw, by + bh - 12);
    ctx.lineTo(bx + bw, by);
    ctx.stroke();
    text(ctx, "+ H⁺   − OH⁻", bx + bw + 12, level + 10, { size: 12, align: "left", color: C.muted });

    // The pH scale with a marker.
    const sx = 24;
    const sw = w - 48;
    const sy = by + bh + 30;
    const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    for (let v = 0; v <= 14; v += 1) grad.addColorStop(v / 14, phColor(v));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, 14, 7);
    ctx.fill();
    for (const v of [0, 7, 14]) text(ctx, String(v), sx + (sw * v) / 14, sy + 28, { size: 11, color: C.muted, weight: 700 });
    text(ctx, "تیزابی", sx + sw * 0.18, sy + 28, { size: 11, color: C.muted });
    text(ctx, "قلوی", sx + sw * 0.82, sy + 28, { size: 11, color: C.muted });
    const mx = sx + (sw * p.ph) / 14;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(mx, sy - 2);
    ctx.lineTo(mx - 7, sy - 12);
    ctx.lineTo(mx + 7, sy - 12);
    ctx.closePath();
    ctx.fill();
  });

  return <canvas ref={ref} />;
}
