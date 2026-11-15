"use client";

import { useEffect, useRef } from "react";
import { incline } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const SLOPE_METERS = 6;

export function inclineReadouts(p: Record<string, number>): Readout[] {
  const r = incline(p.mass, p.angle, p.mu, p.g);
  return [
    {
      label: "تعجیل",
      value: fmt(r.acceleration, 2),
      unit: "m/s²",
      tex: "a = g(\\sin\\theta - \\mu\\cos\\theta)",
      tone: r.moves ? "good" : "warn",
    },
    { label: "وزن", value: fmt(r.weight), unit: "N", tex: "W = mg" },
    { label: "قوه عمودی", value: fmt(r.normal), unit: "N", tex: "N = mg\\cos\\theta" },
    { label: "اصطکاک", value: fmt(r.friction), unit: "N", tex: r.moves ? "f = \\mu N" : undefined },
  ];
}

export function InclineCanvas({ p, playing, run }: SimProps) {
  const s = useRef(0); // metres down the slope
  const v = useRef(0);
  const rest = useRef(0);

  useEffect(() => {
    s.current = 0;
    v.current = 0;
    rest.current = 0;
  }, [p.mass, p.angle, p.mu, p.g, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const r = incline(p.mass, p.angle, p.mu, p.g);
    if (playing && r.moves) {
      if (s.current < SLOPE_METERS) {
        v.current += r.acceleration * dt;
        s.current = Math.min(SLOPE_METERS, s.current + v.current * dt);
      } else if ((rest.current += dt) > 1.2) {
        s.current = 0;
        v.current = 0;
        rest.current = 0;
      }
    }

    grid(ctx, w, h);
    const th = (p.angle * Math.PI) / 180;
    const ground = h - 46;
    let base = w - 120;
    let rise = base * Math.tan(th);
    if (rise > h - 150) {
      rise = h - 150;
      base = rise / Math.tan(th);
    }
    const x0 = (w - base) / 2;
    const top = { x: x0, y: ground - rise };
    const bottom = { x: x0 + base, y: ground };
    const slopePx = Math.hypot(base, rise);

    ctx.fillStyle = C.ground;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = "#3a4580";
    ctx.beginPath();
    ctx.moveTo(x0, ground);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7c87c9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
    // Angle at the bottom.
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bottom.x, bottom.y, 46, Math.PI, Math.PI + th);
    ctx.stroke();
    text(ctx, `θ = ${fmt(p.angle, 0)}°`, bottom.x - 76, bottom.y - 16, { size: 12 });

    // Block on the slope.
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const d = 28 + (s.current / SLOPE_METERS) * (slopePx - 80);
    const size = 46;
    const nx = Math.sin(th); // outward normal (up-right)
    const ny = -Math.cos(th);
    const cx = top.x + ux * d + nx * (size / 2);
    const cy = top.y + uy * d + ny * (size / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(th);
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 6);
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    ctx.font = `700 12px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${p.mass} kg`, 0, 0);
    ctx.restore();

    // Forces (all drawn to the same scale: the weight is 90 px).
    const k = 90 / r.weight;
    arrow(ctx, cx, cy, cx, cy + r.weight * k, C.red, 3.5);
    text(ctx, "W", cx + 12, cy + r.weight * k - 4, { size: 13, color: C.red, weight: 800 });
    arrow(ctx, cx, cy, cx + nx * r.normal * k, cy + ny * r.normal * k, C.blue, 3.5);
    text(ctx, "N", cx + nx * r.normal * k + 10, cy + ny * r.normal * k - 8, { size: 13, color: C.blue, weight: 800 });
    if (r.friction > 0.01) {
      arrow(ctx, cx, cy, cx - ux * r.friction * k, cy - uy * r.friction * k, C.orange, 3.5);
      text(ctx, "f", cx - ux * r.friction * k - 10, cy - uy * r.friction * k - 10, { size: 13, color: C.orange, weight: 800 });
    }
    ctx.save();
    ctx.setLineDash([5, 5]);
    arrow(ctx, cx, cy, cx + ux * r.parallel * k, cy + uy * r.parallel * k, "rgba(248,113,113,0.65)", 2);
    ctx.restore();

    text(ctx, r.moves ? "بلاک به پایین می‌لغزد ⬇" : "اصطکاک کافی است؛ بلاک ساکن می‌ماند ✋", w / 2, 22, {
      size: 14,
      color: r.moves ? C.green : C.orange,
      weight: 700,
      bg: "rgba(15,21,51,0.8)",
    });
    text(ctx, "W وزن · N قوه عمودی · f اصطکاک", w - 14, h - 18, { size: 11, color: C.muted, align: "right" });
  });

  return <canvas ref={ref} />;
}
