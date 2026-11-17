"use client";

import { useEffect, useRef } from "react";
import { spring } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

export function springReadouts(p: Record<string, number>): Readout[] {
  const s = spring(p.k, p.mass, p.amplitude);
  return [
    { label: "دوره", value: fmt(s.period, 2), unit: "s", tone: "accent" },
    { label: "سرعت اعظمی", value: fmt(s.maxSpeed, 2), unit: "m/s" },
  ];
}

/** A zig-zag coil from (x, y1) to (x, y2). */
function coil(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, turns: number, width: number) {
  const lead = 10;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y1 + lead);
  const span = y2 - y1 - 2 * lead;
  const n = turns * 2;
  for (let i = 0; i < n; i++) {
    ctx.lineTo(x + (i % 2 === 0 ? width : -width), y1 + lead + (span * (i + 0.5)) / n);
  }
  ctx.lineTo(x, y2 - lead);
  ctx.lineTo(x, y2);
  ctx.stroke();
}

export function SpringCanvas({ p, playing, run, accent }: SimProps) {
  const t = useRef(0);
  useEffect(() => {
    t.current = 0;
  }, [p.k, p.mass, p.amplitude, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const s = spring(p.k, p.mass, p.amplitude);
    if (playing) t.current += dt;

    grid(ctx, w, h);
    const sx = Math.max(70, w * 0.24);
    const ceiling = 30;
    const scale = (h * 0.26) / 0.5; // pixels per metre
    const rest = ceiling + h * 0.42;
    const x = s.position(t.current); // + is stretched (down)
    const blockY = rest + x * scale;
    const side = 26 + 14 * Math.sqrt(p.mass);

    // Ceiling.
    ctx.fillStyle = C.ink;
    ctx.fillRect(sx - 46, ceiling - 6, 92, 4);

    // Spring: thinner coils for a soft spring, more turns for a stiff one.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1 + p.k / 50;
    ctx.lineJoin = "round";
    coil(ctx, sx, ceiling - 2, blockY - side / 2, 9, 13);

    // Rest position.
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.moveTo(sx - 60, rest);
    ctx.lineTo(w - 16, rest);
    ctx.stroke();
    ctx.restore();

    // The mass.
    ctx.fillStyle = accent;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx - side / 2, blockY - side / 2, side, side, 6);
    ctx.fill();
    ctx.stroke();
    text(ctx, "m", sx, blockY, { size: 13, color: "#fff", weight: 700 });

    // Position–time graph, like a pen drawing on moving paper.
    const gx = sx + 70;
    const gw = w - gx - 20;
    if (gw > 60) {
      const window = 2.2 * s.period;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) {
        const back = (window * i) / 140;
        const y = rest + s.position(Math.max(0, t.current - back)) * scale;
        if (i === 0) ctx.moveTo(gx + (gw * i) / 140, y);
        else ctx.lineTo(gx + (gw * i) / 140, y);
        if (t.current - back < 0) break;
      }
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + side / 2 + 4, blockY);
      ctx.lineTo(gx, blockY);
      ctx.stroke();
      ctx.restore();
      // One period marked under the graph.
      const pw = (gw * s.period) / window;
      const py = rest + p.amplitude * scale + 22;
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, py - 4);
      ctx.lineTo(gx, py + 4);
      ctx.moveTo(gx, py);
      ctx.lineTo(gx + pw, py);
      ctx.moveTo(gx + pw, py - 4);
      ctx.lineTo(gx + pw, py + 4);
      ctx.stroke();
      text(ctx, "T", gx + pw / 2, py + 12, { size: 12, color: C.muted, weight: 700 });
    }
  });

  return <canvas ref={ref} />;
}
