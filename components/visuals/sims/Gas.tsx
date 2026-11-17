"use client";

import { useRef } from "react";
import { gasPressure } from "@/lib/visuals/chemistry";
import { fmt } from "../format";
import { C, grid, seeded, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function gasReadouts(p: Record<string, number>): Readout[] {
  return [
    { label: "فشار", value: fmt(gasPressure(p.temperature, p.volume), 0), unit: "kPa", tone: "accent" },
    { label: "دما", value: fmt(p.temperature + 273, 0), unit: "K" },
  ];
}

const N = 36;
const MAX_P = 700;

export function GasCanvas({ p, playing, accent }: SimProps) {
  const parts = useRef(
    Array.from({ length: N }, (_, i) => {
      const a = seeded(i) * Math.PI * 2;
      return { x: seeded(i + 50), y: seeded(i + 99), vx: Math.cos(a), vy: Math.sin(a) };
    }),
  );

  const ref = useAnimatedCanvas((ctx, w, h, dt, time) => {
    const kelvin = p.temperature + 273;
    const pressure = gasPressure(p.temperature, p.volume);
    grid(ctx, w, h);

    // Cylinder: the piston height follows the volume.
    const cw = Math.min(w * 0.42, 240);
    const cx = w * 0.36 - cw / 2;
    const bottom = h - 62;
    const full = bottom - 40;
    const gasH = (full * p.volume) / 2;
    const top = bottom - gasH;

    // Particles: speed grows with √T.
    const speed = 0.55 * Math.sqrt(kelvin / 300);
    const r = 5;
    if (playing) {
      for (const q of parts.current) {
        q.x += (q.vx * speed * dt * 160) / cw;
        q.y += (q.vy * speed * dt * 160) / gasH;
        // Bounce off the walls and the piston.
        if (q.x < 0 || q.x > 1) {
          q.x = Math.min(1, Math.max(0, q.x));
          q.vx = -q.vx;
        }
        if (q.y < 0 || q.y > 1) {
          q.y = Math.min(1, Math.max(0, q.y));
          q.vy = -q.vy;
        }
      }
    }
    const warmth = Math.max(0, Math.min(1, (kelvin - 223) / 350));
    ctx.fillStyle = `rgb(${Math.round(59 + 180 * warmth)}, ${Math.round(130 - 60 * warmth)}, ${Math.round(246 - 200 * warmth)})`;
    for (const q of parts.current) {
      ctx.beginPath();
      ctx.arc(cx + r + q.x * (cw - 2 * r), top + 8 + r + q.y * (gasH - 8 - 2 * r), r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Walls and piston.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, 30);
    ctx.lineTo(cx - 4, bottom + 4);
    ctx.lineTo(cx + cw + 4, bottom + 4);
    ctx.lineTo(cx + cw + 4, 30);
    ctx.stroke();
    ctx.fillStyle = "#cbd5e1";
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - 2, top - 4, cw + 4, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(cx + cw / 2 - 4, 22, 8, top - 26);

    // Flame or ice under the cylinder.
    const heat = (p.temperature - 27) / 270;
    const fx = cx + cw / 2;
    if (heat > 0.05) {
      for (const [dx, s] of [
        [-18, 0.7],
        [0, 1],
        [18, 0.7],
      ]) {
        const fh = (14 + 26 * heat) * s * (1 + 0.12 * Math.sin(time * 12 + dx));
        ctx.fillStyle = "rgba(249, 115, 22, 0.85)";
        ctx.beginPath();
        ctx.moveTo(fx + dx - 7, bottom + 34);
        ctx.quadraticCurveTo(fx + dx - 8, bottom + 34 - fh * 0.6, fx + dx, bottom + 34 - fh);
        ctx.quadraticCurveTo(fx + dx + 8, bottom + 34 - fh * 0.6, fx + dx + 7, bottom + 34);
        ctx.closePath();
        ctx.fill();
      }
    } else if (p.temperature < 0) {
      text(ctx, "❄", fx, bottom + 24, { size: 20, color: "#38bdf8" });
    }

    // Pressure gauge.
    const gx = Math.min(w - 70, cx + cw + 40 + (w - cx - cw - 40) / 2);
    const gy = h * 0.42;
    const gr = Math.min(56, (w - cx - cw - 40) / 2 - 6, h * 0.22);
    if (gr > 24) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const a0 = Math.PI * 0.75;
      const span = Math.PI * 1.5;
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(gx, gy, gr - 9, a0, a0 + span);
      ctx.stroke();
      const frac = Math.min(1, pressure / MAX_P);
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(gx, gy, gr - 9, a0, a0 + span * frac);
      ctx.stroke();
      const na = a0 + span * frac;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (gr - 16) * Math.cos(na), gy + (gr - 16) * Math.sin(na));
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, "kPa", gx, gy + gr * 0.5, { size: 10, color: C.muted, weight: 700 });
      text(ctx, fmt(pressure, 0), gx, gy + gr + 18, { size: 15, color: C.ink, weight: 800 });
    }
    text(ctx, `${fmt(p.volume, 2)} L`, cx + cw + 12, (top + bottom) / 2, {
      size: 12,
      align: "left",
      color: C.muted,
      weight: 700,
    });
  });

  return <canvas ref={ref} />;
}
