"use client";

import { useEffect, useRef } from "react";
import { pendulumPeriod, pendulumStep } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, dot, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function pendulumReadouts(p: Record<string, number>): Readout[] {
  const T = pendulumPeriod(p.length, p.g);
  return [
    { label: "دوره", value: fmt(T, 2), unit: "s", tone: "accent" },
    { label: "فریکونسی", value: fmt(1 / T, 2), unit: "Hz" },
  ];
}

export function PendulumCanvas({ p, playing, run, accent }: SimProps) {
  const state = useRef<[number, number]>([(p.amplitude * Math.PI) / 180, 0]);

  useEffect(() => {
    state.current = [(p.amplitude * Math.PI) / 180, 0];
  }, [p.amplitude, p.length, p.g, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    if (playing) {
      const n = 12;
      for (let i = 0; i < n; i++) state.current = pendulumStep(state.current[0], state.current[1], p.length, p.g, dt / n);
    }
    const theta = state.current[0];

    grid(ctx, w, h);
    const px = w / 2;
    const py = 36;
    const Lpx = Math.max(50, ((h - py - 50) * p.length) / 3);
    const bx = px + Lpx * Math.sin(theta);
    const by = py + Lpx * Math.cos(theta);

    // Support.
    ctx.fillStyle = C.ink;
    ctx.fillRect(px - 50, py - 8, 100, 4);

    // Rest line and the arc of the swing.
    const amp = (p.amplitude * Math.PI) / 180;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + Lpx + 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(px, py, Lpx, Math.PI / 2 - amp, Math.PI / 2 + amp);
    ctx.stroke();
    ctx.restore();

    // String and bob.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(bx, by);
    ctx.stroke();
    dot(ctx, px, py, 3, C.ink);
    dot(ctx, bx, by, 14, accent);
    text(ctx, "L", (px + bx) / 2 + 12, (py + by) / 2, { size: 13, color: C.muted, weight: 700 });
  });

  return <canvas ref={ref} />;
}
