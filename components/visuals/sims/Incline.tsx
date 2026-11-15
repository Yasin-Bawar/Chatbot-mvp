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
    { label: "تعجیل", value: fmt(r.acceleration, 2), unit: "m/s²", tone: "accent" },
    { label: "بلاک", value: r.moves ? "می‌لغزد" : "ساکن", tone: r.moves ? undefined : "warn" },
  ];
}

export function InclineCanvas({ p, playing, run, accent }: SimProps) {
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
    // Room under the ground line, so the weight arrow always fits.
    const ground = h - 80;
    let base = Math.min(w - 100, 600);
    let rise = base * Math.tan(th);
    if (rise > ground - 70) {
      rise = ground - 70;
      base = rise / Math.tan(th);
    }
    const x0 = (w - base) / 2;
    const top = { x: x0, y: ground - rise };
    const bottom = { x: x0 + base, y: ground };
    const slopePx = Math.hypot(base, rise);

    // Ground and ramp.
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(w, ground);
    ctx.stroke();
    ctx.fillStyle = C.ground;
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(x0, ground);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bottom.x, bottom.y, 40, Math.PI, Math.PI + th);
    ctx.stroke();
    text(ctx, "θ", bottom.x - 54, bottom.y - 10, { size: 13, color: C.muted });

    // Block on the slope.
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const d = 24 + (s.current / SLOPE_METERS) * (slopePx * 0.62 - 24);
    const size = Math.max(40, Math.min(60, base / 10));
    const nx = Math.sin(th);
    const ny = -Math.cos(th);
    const cx = top.x + ux * d + nx * (size / 2);
    const cy = top.y + uy * d + ny * (size / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(th);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 5);
    ctx.fill();
    ctx.restore();

    // Forces, all to the same scale (the weight arrow is 1.6 block sizes long).
    const k = (size * 1.6) / r.weight;
    arrow(ctx, cx, cy, cx, cy + r.weight * k, C.ink, 2.5);
    text(ctx, "W", cx + 12, cy + r.weight * k - 4, { size: 13, color: C.ink, weight: 800 });
    arrow(ctx, cx, cy, cx + nx * r.normal * k, cy + ny * r.normal * k, accent, 2.5);
    text(ctx, "N", cx + nx * r.normal * k + 10, cy + ny * r.normal * k - 8, { size: 13, color: accent, weight: 800 });
    if (r.friction > 0.01) {
      arrow(ctx, cx, cy, cx - ux * r.friction * k, cy - uy * r.friction * k, C.warm, 2.5);
      text(ctx, "f", cx - ux * r.friction * k - 10, cy - uy * r.friction * k - 10, { size: 13, color: C.warm, weight: 800 });
    }
  });

  return <canvas ref={ref} />;
}
