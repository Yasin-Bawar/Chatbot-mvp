"use client";

import { useRef } from "react";
import { circuit } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function circuitReadouts(p: Record<string, number>): Readout[] {
  const r = circuit(p.voltage, p.resistance);
  return [
    { label: "جریان برق", value: fmt(r.current, 2), unit: "A", tex: "I = \\dfrac{V}{R}" },
    { label: "توان (روشنی گروپ)", value: fmt(r.power, 1), unit: "W", tex: "P = V \\cdot I" },
  ];
}

export function CircuitCanvas({ p, playing }: SimProps) {
  const offset = useRef(0);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const { current, power } = circuit(p.voltage, p.resistance);
    grid(ctx, w, h);
    const left = Math.max(60, w * 0.16);
    const right = w - left;
    const topY = Math.max(70, h * 0.2);
    const botY = h - Math.max(60, h * 0.18);
    const perimeter = 2 * (right - left) + 2 * (botY - topY);
    if (playing) offset.current = (offset.current + dt * Math.min(220, 6 + current * 40)) % perimeter;

    // Wire.
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeRect(left, topY, right - left, botY - topY);

    // Battery (left side): long plate +, short plate −.
    const by = (topY + botY) / 2;
    ctx.fillStyle = C.bg;
    ctx.fillRect(left - 30, by - 22, 60, 44);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(left - 26, by - 14, 52, 5);
    ctx.fillRect(left - 15, by + 9, 30, 5);
    text(ctx, "+", left + 38, by - 12, { size: 16, color: C.red, weight: 800 });
    text(ctx, "−", left + 38, by + 12, { size: 16, color: C.blue, weight: 800 });
    text(ctx, `${fmt(p.voltage)} V`, left - 2, by + 40, { size: 13, color: C.accent, weight: 700 });
    text(ctx, "بتری", left - 2, by - 38, { size: 12, color: C.muted });

    // Resistor (top).
    const rx = (left + right) / 2;
    ctx.fillStyle = C.bg;
    ctx.fillRect(rx - 52, topY - 16, 104, 32);
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx - 52, topY);
    for (let i = 0; i < 8; i++) ctx.lineTo(rx - 45 + i * 13, topY + (i % 2 ? 12 : -12));
    ctx.lineTo(rx + 52, topY);
    ctx.stroke();
    text(ctx, `R = ${fmt(p.resistance, 0)} Ω`, rx, topY - 30, { size: 13, color: C.orange, weight: 700 });

    // Bulb (right side): brighter with more power.
    const glow = Math.min(1, power / 40);
    const bx = right;
    const bulbY = (topY + botY) / 2;
    ctx.save();
    const g = ctx.createRadialGradient(bx, bulbY, 4, bx, bulbY, 30 + glow * 90);
    g.addColorStop(0, `rgba(253,224,71,${0.25 + glow * 0.7})`);
    g.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, bulbY, 30 + glow * 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgb(${120 + glow * 135}, ${110 + glow * 120}, ${70 + glow * 40})`;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, bulbY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = glow > 0.15 ? "#fff7cc" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(bx - 8, bulbY + 8);
    ctx.lineTo(bx - 4, bulbY - 6);
    ctx.lineTo(bx, bulbY + 4);
    ctx.lineTo(bx + 4, bulbY - 6);
    ctx.lineTo(bx + 8, bulbY + 8);
    ctx.stroke();
    text(ctx, "گروپ", bx, bulbY + 40, { size: 12, color: C.muted });

    // Ammeter (bottom).
    const ax = (left + right) / 2;
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ax, botY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    text(ctx, "A", ax, botY, { size: 15, color: C.cyan, weight: 800 });
    text(ctx, `I = ${fmt(current, 2)} A`, ax, botY + 38, { size: 13, color: C.cyan, weight: 700 });

    // Electrons travel from − round to + (opposite to the conventional current).
    const pointAt = (dist: number) => {
      let d = ((dist % perimeter) + perimeter) % perimeter;
      const wTop = right - left;
      const hSide = botY - topY;
      // Start at battery − (left, middle-low) going down, then right along the bottom…
      const segs: [number, number, number, number][] = [
        [left, by + 12, left, botY],
        [left, botY, right, botY],
        [right, botY, right, topY],
        [right, topY, left, topY],
        [left, topY, left, by - 12],
      ];
      const lens = [botY - by - 12, wTop, hSide, wTop, by - 12 - topY];
      for (let i = 0; i < segs.length; i++) {
        if (d <= lens[i]) {
          const [x1, y1, x2, y2] = segs[i];
          const t = d / lens[i];
          return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
        }
        d -= lens[i];
      }
      return [left, by];
    };
    const count = 28;
    const usable = perimeter - 24;
    for (let i = 0; i < count; i++) {
      const [x, y] = pointAt((offset.current + (i * usable) / count) % usable);
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    arrow(ctx, right - 70, topY + 26, right - 130, topY + 26, "rgba(125,211,252,0.8)", 2);
    text(ctx, "حرکت الکترون‌ها", right - 100, topY + 44, { size: 11, color: "#7dd3fc" });
  });

  return <canvas ref={ref} />;
}
