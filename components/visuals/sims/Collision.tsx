"use client";

import { useEffect, useRef } from "react";
import { collision } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const TRACK = 10; // metres
const GAP = 3.5; // metres between the carts at the start

function result(p: Record<string, number>) {
  return collision(p.m1, p.m2, p.v1, 0, p.elastic >= 0.5 ? 1 : 0);
}

export function collisionReadouts(p: Record<string, number>): Readout[] {
  const r = result(p);
  return [
    { label: "بعد ۱", value: fmt(r.after1), unit: "m/s" },
    { label: "بعد ۲", value: fmt(r.after2), unit: "m/s", tone: "accent" },
    { label: "مومنتم", value: fmt(r.momentum), unit: "kg·m/s" },
  ];
}

export function CollisionCanvas({ p, playing, run, accent }: SimProps) {
  const t = useRef(0);
  useEffect(() => {
    t.current = 0;
  }, [p.m1, p.m2, p.v1, p.elastic, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const r = result(p);
    const w1 = 0.5 + 0.18 * Math.sqrt(p.m1); // cart lengths in metres
    const w2 = 0.5 + 0.18 * Math.sqrt(p.m2);
    const start1 = 0.6;
    const start2 = start1 + w1 + GAP;
    const hit = GAP / p.v1;
    // Slow motion: 1.4 s until the hit, then 2.4 s after it (real seconds).
    const slow = hit / 1.4;
    const cycle = hit + 2.4 * slow;
    if (playing) {
      t.current += dt * slow;
      if (t.current > cycle) t.current = 0;
    }
    const time = t.current;
    const after = Math.max(0, time - hit);
    const x1 = time < hit ? start1 + p.v1 * time : start1 + p.v1 * hit + r.after1 * after;
    const x2 = time < hit ? start2 : start2 + r.after2 * after;
    const v1Now = time < hit ? p.v1 : r.after1;
    const v2Now = time < hit ? 0 : r.after2;

    grid(ctx, w, h);
    const k = (w - 40) / TRACK;
    const X = (m: number) => 20 + m * k;
    const rail = h * 0.62;

    // Track.
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, rail, w, h - rail);
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, rail);
    ctx.lineTo(w, rail);
    ctx.stroke();

    const cart = (x: number, len: number, mass: number, fill: string, v: number, name: string) => {
      const left = X(x);
      const cw = len * k;
      const ch = 24 + 6 * Math.sqrt(mass);
      const top = rail - 10 - ch;
      ctx.fillStyle = fill;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(left, top, cw, ch, 6);
      ctx.fill();
      ctx.stroke();
      for (const wx of [left + cw * 0.25, left + cw * 0.75]) {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(wx, rail - 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      text(ctx, `${fmt(mass)} kg`, left + cw / 2, top + ch / 2, {
        size: 12,
        color: fill === accent ? "#fff" : C.ink,
        weight: 700,
      });
      text(ctx, name, left + cw / 2, rail + 18, { size: 12, color: C.muted });
      if (Math.abs(v) > 0.05) {
        const mid = left + cw / 2;
        const len2 = Math.max(16, Math.min(110, Math.abs(v) * 12)) * Math.sign(v);
        arrow(ctx, mid, top - 16, mid + len2, top - 16, C.warm, 3);
        text(ctx, `${fmt(Math.abs(v))} m/s`, mid + len2 / 2, top - 32, { size: 11, color: C.warm, weight: 700 });
      }
    };
    cart(x1, w1, p.m1, accent, v1Now, "۱");
    cart(x2, w2, p.m2, "#e2e8f0", v2Now, "۲");

    // A small flash at the moment of the hit.
    if (time >= hit && time < hit + 0.3 * slow) {
      const cx = X(start2);
      ctx.fillStyle = "rgba(217, 119, 6, 0.25)";
      ctx.beginPath();
      ctx.arc(cx, rail - 34, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    const sticky = p.elastic < 0.5;
    text(ctx, sticky ? "چسپنده" : "ارتجاعی", w - 16, 20, { size: 12, align: "right", color: C.muted, weight: 600 });
  });

  return <canvas ref={ref} />;
}
