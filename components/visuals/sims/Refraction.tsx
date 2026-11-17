"use client";

import { materialName, refraction } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function refractionReadouts(p: Record<string, number>): Readout[] {
  const r = refraction(p.n1, p.n2, p.angle);
  const out: Readout[] = r.totalReflection
    ? [{ label: "انعکاس کامل", value: "✓", tone: "warn" }]
    : [{ label: "زاویه شکست", value: fmt(r.angle!, 1), unit: "°", tone: "accent" }];
  if (r.critical !== null) out.push({ label: "زاویه حد", value: fmt(r.critical, 1), unit: "°" });
  return out;
}

/** Pale tint for a material: denser looks a little bluer. */
function tint(n: number): string {
  const a = Math.min(0.32, (n - 1) * 0.36);
  return `rgba(56, 189, 248, ${a.toFixed(3)})`;
}

export function RefractionCanvas({ p, playing, accent }: SimProps) {
  const ref = useAnimatedCanvas((ctx, w, h, _dt, time) => {
    const r = refraction(p.n1, p.n2, p.angle);
    const mid = h / 2;
    const cx = w / 2;
    const L = Math.min(w, h) * 0.46;

    grid(ctx, w, h);
    ctx.fillStyle = tint(p.n1);
    ctx.fillRect(0, 0, w, mid);
    ctx.fillStyle = tint(p.n2);
    ctx.fillRect(0, mid, w, h - mid);
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    text(ctx, `${materialName(p.n1)}  n = ${fmt(p.n1, 2)}`, w - 14, 18, { size: 12, align: "right", color: C.muted });
    text(ctx, `${materialName(p.n2)}  n = ${fmt(p.n2, 2)}`, w - 14, h - 16, { size: 12, align: "right", color: C.muted });

    // Normal.
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, mid - L);
    ctx.lineTo(cx, mid + L);
    ctx.stroke();
    ctx.restore();

    const a1 = (p.angle * Math.PI) / 180;
    const start: [number, number] = [cx - L * Math.sin(a1), mid - L * Math.cos(a1)];
    const reflected: [number, number] = [cx + L * Math.sin(a1), mid - L * Math.cos(a1)];
    const flow = playing ? -time * 50 : 0;
    const beam = (from: [number, number], to: [number, number], alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.setLineDash([16, 7]);
      ctx.lineDashOffset = flow;
      ctx.beginPath();
      ctx.moveTo(...from);
      ctx.lineTo(...to);
      ctx.stroke();
      ctx.restore();
    };
    beam(start, [cx, mid], 1);
    // Some light always reflects; all of it does past the critical angle.
    beam([cx, mid], reflected, r.totalReflection ? 1 : 0.22);
    if (r.angle !== null) {
      const a2 = (r.angle * Math.PI) / 180;
      beam([cx, mid], [cx + L * Math.sin(a2), mid + L * Math.cos(a2)], 1);
      // Angle of refraction.
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, mid, 38, Math.PI / 2 - a2, Math.PI / 2);
      ctx.stroke();
      text(ctx, "θ₂", cx + 50 * Math.sin(a2 / 2) + 6, mid + 52 * Math.cos(a2 / 2) + 4, { size: 13, color: C.warm, weight: 700 });
    }
    // Angle of incidence.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, mid, 44, -Math.PI / 2 - a1, -Math.PI / 2);
    ctx.stroke();
    text(ctx, "θ₁", cx - 58 * Math.sin(a1 / 2) - 6, mid - 58 * Math.cos(a1 / 2), { size: 13, color: C.ink, weight: 700 });

    // Light source.
    ctx.fillStyle = C.warm;
    ctx.beginPath();
    ctx.arc(start[0], start[1], 6, 0, Math.PI * 2);
    ctx.fill();
  });

  return <canvas ref={ref} />;
}
