"use client";

import { useRef } from "react";
import { PHASE_FA, phaseAt, temperatureRange } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const COLS = 7;
const ROWS = 6;
const N = COLS * ROWS;

export function statesReadouts(p: Record<string, number>, substance: SimProps["substance"]): Readout[] {
  const s = substance ?? { name: "آب", melt: 0, boil: 100 };
  const phase = phaseAt(p.temperature, s.melt, s.boil);
  return [{ label: s.name, value: PHASE_FA[phase], tone: "accent" }];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  seed: number;
}

export function StatesCanvas({ p, playing, substance, accent }: SimProps) {
  const s = substance ?? { name: "آب", melt: 0, boil: 100 };
  const particles = useRef<Particle[] | null>(null);

  const ref = useAnimatedCanvas((ctx, w, h, dt, time) => {
    const phase = phaseAt(p.temperature, s.melt, s.boil);
    const range = temperatureRange(s.melt, s.boil);

    grid(ctx, w, h);
    const thermoW = 96;
    const boxW = Math.min(w - thermoW - 20, 560);
    const boxH = Math.min(h - 56, 360);
    const bx = (w - thermoW - boxW) / 2 + thermoW;
    const by = (h - boxH) / 2;
    const r = Math.max(6, Math.min(11, boxW / 40));

    // Particles live in box coordinates (0..1).
    if (!particles.current) {
      particles.current = Array.from({ length: N }, (_, i) => ({ x: 0.5, y: 0.8, vx: 0, vy: 0, seed: i * 1.37 }));
    }
    const list = particles.current;
    const rx = r / boxW;
    const ry = r / boxH;
    // How "hot" within the current phase (0..1) → how strongly particles move.
    const heat =
      phase === "solid"
        ? (p.temperature - range.min) / Math.max(1, s.melt - range.min)
        : phase === "liquid"
          ? (p.temperature - s.melt) / Math.max(1, s.boil - s.melt)
          : (p.temperature - s.boil) / Math.max(1, range.max - s.boil);

    if (playing) {
      const step = Math.min(dt, 0.03);
      list.forEach((q, i) => {
        if (phase === "solid") {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const spacing = 2.3 * rx;
          const tx = 0.5 + (col - (COLS - 1) / 2) * spacing;
          const ty = 1 - ry * 1.2 - (ROWS - 1 - row) * 2.3 * ry;
          const jitter = (0.25 + heat * 0.9) * rx * 0.5;
          const jx = tx + Math.sin(time * 23 + q.seed * 5) * jitter;
          const jy = ty + Math.cos(time * 19 + q.seed * 7) * jitter;
          q.x += (jx - q.x) * Math.min(1, step * 6);
          q.y += (jy - q.y) * Math.min(1, step * 6);
          q.vx = (jx - q.x) * 2;
          q.vy = (jy - q.y) * 2;
          return;
        }
        const speed = phase === "liquid" ? 0.08 + heat * 0.12 : 0.45 + heat * 0.5;
        // Random kicks keep the motion going (thermal energy).
        q.vx += (Math.random() - 0.5) * speed * step * 30;
        q.vy += (Math.random() - 0.5) * speed * step * 30;
        if (phase === "liquid") q.vy += 0.9 * step; // the liquid settles at the bottom
        const v = Math.hypot(q.vx, q.vy);
        if (v > speed) {
          q.vx = (q.vx / v) * speed;
          q.vy = (q.vy / v) * speed;
        }
        q.x += q.vx * step;
        q.y += q.vy * step;
        // Bounce off the walls of the jar.
        if (q.x < rx) {
          q.x = rx;
          q.vx = Math.abs(q.vx);
        }
        if (q.x > 1 - rx) {
          q.x = 1 - rx;
          q.vx = -Math.abs(q.vx);
        }
        if (q.y < ry) {
          q.y = ry;
          q.vy = Math.abs(q.vy);
        }
        if (q.y > 1 - ry) {
          q.y = 1 - ry;
          q.vy = -Math.abs(q.vy) * (phase === "liquid" ? 0.3 : 1);
        }
      });
      // Particles don't overlap (and in a liquid they stay close together).
      if (phase !== "solid") {
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const a = list[i];
            const b = list[j];
            const dx = (b.x - a.x) * boxW;
            const dy = (b.y - a.y) * boxH;
            const d = Math.hypot(dx, dy) || 0.01;
            const min = 2.1 * r;
            if (d < min) {
              const push = (min - d) / 2 / d;
              a.x -= (dx * push) / boxW;
              a.y -= (dy * push) / boxH;
              b.x += (dx * push) / boxW;
              b.y += (dy * push) / boxH;
            } else if (phase === "liquid" && d < 3.4 * r) {
              const pull = 0.02 * step * 60;
              a.vx += (dx / d) * pull * 0.02;
              a.vy += (dy / d) * pull * 0.02;
              b.vx -= (dx / d) * pull * 0.02;
              b.vy -= (dy / d) * pull * 0.02;
            }
          }
        }
      }
    }

    // The jar.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by - 10);
    ctx.lineTo(bx - 6, by + boxH + 6);
    ctx.lineTo(bx + boxW + 6, by + boxH + 6);
    ctx.lineTo(bx + boxW + 6, by - 10);
    ctx.stroke();

    // Particles: same colour in every phase; only the motion changes.
    ctx.fillStyle = accent;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = 1;
    for (const q of list) {
      ctx.beginPath();
      ctx.arc(bx + q.x * boxW, by + q.y * boxH, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Thermometer with the melting and boiling points.
    const tx = 30;
    const tTop = by;
    const tBottom = by + boxH - 14;
    const level = (value: number) => tBottom - ((value - range.min) / (range.max - range.min)) * (tBottom - tTop);
    ctx.fillStyle = C.ground;
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.roundRect(tx - 6, tTop - 4, 12, tBottom - tTop + 8, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(tx - 3, level(p.temperature), 6, tBottom - level(p.temperature) + 4);
    ctx.beginPath();
    ctx.arc(tx, tBottom + 10, 10, 0, Math.PI * 2);
    ctx.fill();
    for (const [value, label] of [
      [s.melt, "ذوب"],
      [s.boil, "جوش"],
    ] as const) {
      const y = level(value);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + 8, y);
      ctx.lineTo(tx + 14, y);
      ctx.stroke();
      text(ctx, `${label} ${fmt(value, 0)}°`, tx + 17, y, { size: 11, color: C.muted, align: "left", weight: 500 });
    }
  });

  return <canvas ref={ref} />;
}
