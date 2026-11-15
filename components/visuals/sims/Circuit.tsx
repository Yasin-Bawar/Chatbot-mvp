"use client";

import { useRef } from "react";
import { circuit } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function circuitReadouts(p: Record<string, number>): Readout[] {
  const r = circuit(p.voltage, p.resistance);
  return [
    { label: "جریان", value: fmt(r.current, 2), unit: "A", tone: "accent" },
    { label: "توان", value: fmt(r.power, 1), unit: "W" },
  ];
}

export function CircuitCanvas({ p, playing, accent }: SimProps) {
  const offset = useRef(0);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const { current, power } = circuit(p.voltage, p.resistance);
    grid(ctx, w, h);
    const cw = Math.min(w - 112, 560);
    const ch = Math.min(h - 104, 340);
    const left = (w - cw) / 2;
    const right = left + cw;
    const topY = (h - ch) / 2;
    const botY = topY + ch;
    const by = (topY + botY) / 2;
    const perimeter = 2 * (right - left) + 2 * (botY - topY);
    if (playing) offset.current = (offset.current + dt * Math.min(220, 6 + current * 40)) % perimeter;

    // Wire.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeRect(left, topY, right - left, botY - topY);

    // Electrons (drawn under the parts).
    const point = (dist: number): [number, number] => {
      let d = ((dist % perimeter) + perimeter) % perimeter;
      const segs: [number, number, number, number][] = [
        [left, by + 14, left, botY],
        [left, botY, right, botY],
        [right, botY, right, topY],
        [right, topY, left, topY],
        [left, topY, left, by - 14],
      ];
      for (const [x1, y1, x2, y2] of segs) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (d <= len) return [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
        d -= len;
      }
      return [left, by];
    };
    const usable = perimeter - 28;
    ctx.fillStyle = accent;
    for (let i = 0; i < 26; i++) {
      const [x, y] = point((offset.current + (i * usable) / 26) % usable);
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Battery (left): long plate +, short plate −.
    ctx.fillStyle = C.page;
    ctx.fillRect(left - 26, by - 16, 52, 32);
    ctx.fillStyle = C.ink;
    ctx.fillRect(left - 22, by - 9, 44, 3);
    ctx.fillRect(left - 12, by + 6, 24, 3);
    text(ctx, "V", left - 40, by, { size: 13, color: C.muted, weight: 700 });

    // Resistor (top).
    const rx = (left + right) / 2;
    ctx.fillStyle = C.page;
    ctx.fillRect(rx - 46, topY - 12, 92, 24);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx - 46, topY);
    for (let i = 0; i < 8; i++) ctx.lineTo(rx - 40 + i * 11.5, topY + (i % 2 ? 9 : -9));
    ctx.lineTo(rx + 46, topY);
    ctx.stroke();
    text(ctx, "R", rx, topY - 22, { size: 13, color: C.muted, weight: 700 });

    // Bulb (right): warmer and bigger with more power.
    const glow = Math.min(1, power / 40);
    ctx.fillStyle = C.page;
    ctx.fillRect(right - 22, by - 22, 44, 44);
    ctx.fillStyle = `rgba(245, 158, 11, ${0.12 + glow * 0.75})`;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(right, by, 16 + glow * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right - 6, by + 6);
    ctx.lineTo(right - 3, by - 5);
    ctx.lineTo(right, by + 3);
    ctx.lineTo(right + 3, by - 5);
    ctx.lineTo(right + 6, by + 6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  return <canvas ref={ref} />;
}
