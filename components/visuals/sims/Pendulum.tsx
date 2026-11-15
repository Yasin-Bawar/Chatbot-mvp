"use client";

import { useEffect, useRef } from "react";
import { pendulumPeriod, pendulumStep } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, glowCircle, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function pendulumReadouts(p: Record<string, number>): Readout[] {
  const T = pendulumPeriod(p.length, p.g);
  return [
    { label: "دوره (یک رفت و برگشت)", value: fmt(T, 2), unit: "s", tex: "T = 2\\pi\\sqrt{\\dfrac{L}{g}}" },
    { label: "فریکونسی", value: fmt(1 / T, 2), unit: "Hz", tex: "f = \\dfrac{1}{T}" },
  ];
}

export function PendulumCanvas({ p, playing, run }: SimProps) {
  const state = useRef<[number, number]>([(p.amplitude * Math.PI) / 180, 0]);
  const swings = useRef(0);
  const time = useRef(0);
  const trail = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    state.current = [(p.amplitude * Math.PI) / 180, 0];
    swings.current = 0;
    time.current = 0;
    trail.current = [];
  }, [p.amplitude, p.length, p.g, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    if (playing) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const before = state.current[0];
        state.current = pendulumStep(state.current[0], state.current[1], p.length, p.g, dt / n);
        if (Math.sign(before) !== Math.sign(state.current[0]) && before !== 0) swings.current += 0.5;
      }
      time.current += dt;
    }
    const [theta, omega] = state.current;

    grid(ctx, w, h);
    const px = w / 2;
    const py = 46;
    const Lpx = Math.max(50, ((h - py - 70) * p.length) / 3);
    const bx = px + Lpx * Math.sin(theta);
    const by = py + Lpx * Math.cos(theta);

    // Ceiling.
    ctx.fillStyle = "#3a4580";
    ctx.fillRect(px - 80, py - 14, 160, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    for (let x = px - 76; x < px + 80; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, py - 14);
      ctx.lineTo(x - 8, py - 24);
      ctx.stroke();
    }

    // Rest line and the starting angle.
    const amp = (p.amplitude * Math.PI) / 180;
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + Lpx + 20);
    ctx.stroke();
    ctx.strokeStyle = "rgba(167,139,250,0.45)";
    ctx.beginPath();
    ctx.arc(px, py, Lpx, Math.PI / 2 - amp, Math.PI / 2 + amp);
    ctx.stroke();
    ctx.restore();
    text(ctx, `${fmt(p.amplitude, 0)}°`, px + 26 * Math.sin(amp / 2) + 10, py + 40, { size: 12, color: C.violet });

    // Trail.
    trail.current.push({ x: bx, y: by });
    if (trail.current.length > 40) trail.current.shift();
    trail.current.forEach((pt, i) => {
      ctx.fillStyle = `rgba(253,224,71,${(i / trail.current.length) * 0.35})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // String and bob.
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    const v = omega * p.length;
    arrow(ctx, bx, by, bx + Math.cos(theta) * v * 28, by - Math.sin(theta) * v * 28, C.green, 2.5);
    glowCircle(ctx, bx, by, 16, C.accent, 22);
    text(ctx, `L = ${fmt(p.length)} m`, (px + bx) / 2 + 34, (py + by) / 2, { size: 12, color: C.muted });

    // Energy bars: potential ↔ kinetic.
    const pe = p.g * p.length * (1 - Math.cos(theta));
    const ke = 0.5 * v * v;
    const total = Math.max(1e-6, pe + ke);
    const barH = Math.min(150, h - 120);
    const x0 = 22;
    const y0 = h - 30;
    const bars = [
      { label: "انرژی پتانسیل", value: pe / total, color: C.violet },
      { label: "انرژی حرکی", value: ke / total, color: C.green },
    ];
    bars.forEach((b, i) => {
      const x = x0 + i * 46;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y0 - barH, 26, barH);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y0 - barH * b.value, 26, barH * b.value);
    });
    text(ctx, "پتانسیل", x0 + 13, y0 + 14, { size: 10, color: C.violet });
    text(ctx, "حرکی", x0 + 59, y0 + 14, { size: 10, color: C.green });

    text(ctx, `زمان: ${fmt(time.current)} s · رفت و برگشت: ${fmt(Math.floor(swings.current), 0)}`, w - 14, h - 18, {
      size: 12,
      color: C.muted,
      align: "right",
    });
  });

  return <canvas ref={ref} />;
}
