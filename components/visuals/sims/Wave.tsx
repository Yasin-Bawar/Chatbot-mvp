"use client";

import { useRef } from "react";
import { wave } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, glowCircle, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const VISIBLE_METERS = 6;

export function waveReadouts(p: Record<string, number>): Readout[] {
  const wv = wave(p.amplitude, p.frequency, p.wavelength);
  return [
    { label: "سرعت موج", value: fmt(wv.speed, 2), unit: "m/s", tex: "v = f \\cdot \\lambda" },
    { label: "دوره", value: fmt(wv.period, 2), unit: "s", tex: "T = \\dfrac{1}{f}" },
  ];
}

export function WaveCanvas({ p, playing }: SimProps) {
  const t = useRef(0);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    if (playing) t.current += dt;
    const wv = wave(p.amplitude, p.frequency, p.wavelength);
    grid(ctx, w, h);
    const left = 30;
    const mid = h / 2;
    const kx = (w - left * 2) / VISIBLE_METERS;
    const ky = (h / 2 - 50) / 1;
    const X = (x: number) => left + x * kx;
    const Y = (y: number) => mid - y * ky;

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, mid);
    ctx.lineTo(w - left, mid);
    ctx.stroke();

    // The rope.
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const x = (VISIBLE_METERS * i) / 240;
      const y = wv.y(x, t.current);
      if (i === 0) ctx.moveTo(X(x), Y(y));
      else ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    // Beads: each one only moves up and down.
    for (let x = 0; x <= VISIBLE_METERS + 1e-6; x += 0.25) {
      ctx.fillStyle = "rgba(34,211,238,0.85)";
      ctx.beginPath();
      ctx.arc(X(x), Y(wv.y(x, t.current)), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const tracked = 1;
    glowCircle(ctx, X(tracked), Y(wv.y(tracked, t.current)), 8, C.red, 16);
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(248,113,113,0.5)";
    ctx.beginPath();
    ctx.moveTo(X(tracked), Y(p.amplitude) - 8);
    ctx.lineTo(X(tracked), Y(-p.amplitude) + 8);
    ctx.stroke();
    ctx.restore();
    text(ctx, "این ذره فقط بالا و پایین می‌رود", X(tracked) + 8, Y(-p.amplitude) + 26, { size: 11, color: C.red, align: "left" });

    // One wavelength between two crests.
    const phase = (p.frequency * t.current) % 1;
    let crest = p.wavelength * (0.25 + phase);
    while (crest > p.wavelength * 1.25) crest -= p.wavelength;
    if (crest + p.wavelength <= VISIBLE_METERS) {
      const y = Y(p.amplitude) - 18;
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(crest), y + 6);
      ctx.lineTo(X(crest), y);
      ctx.lineTo(X(crest + p.wavelength), y);
      ctx.lineTo(X(crest + p.wavelength), y + 6);
      ctx.stroke();
      text(ctx, `λ = ${fmt(p.wavelength)} m`, X(crest + p.wavelength / 2), y - 12, { size: 13, color: C.accent, weight: 700 });
    }
    // Amplitude.
    const ax = X(VISIBLE_METERS) - 6;
    arrow(ctx, ax, mid, ax, Y(p.amplitude), C.violet, 2);
    text(ctx, `A = ${fmt(p.amplitude, 2)} m`, ax - 8, Y(p.amplitude) - 2, { size: 12, color: C.violet, align: "right" });

    arrow(ctx, w / 2 - 50, h - 26, w / 2 + 50, h - 26, "rgba(255,255,255,0.7)", 2);
    text(ctx, `جهت حرکت موج · v = ${fmt(wv.speed, 2)} m/s`, w / 2, h - 44, { size: 12, color: C.muted });
  });

  return <canvas ref={ref} />;
}
