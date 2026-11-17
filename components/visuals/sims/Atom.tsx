"use client";

import { useMemo } from "react";
import { bohrShells, FIRST_20 } from "@/lib/visuals/chemistry";
import { fmt } from "../format";
import { C, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const PROTON = "#ef4444";
const NEUTRON = "#94a3b8";

function element(z: number) {
  return FIRST_20[Math.max(1, Math.min(20, Math.round(z))) - 1];
}

export function atomReadouts(p: Record<string, number>): Readout[] {
  const e = element(p.z);
  return [
    { label: e.name, value: e.symbol, tone: "accent" },
    {
      label: "لایه‌ها",
      value: bohrShells(e.z)
        .map((n) => fmt(n, 0))
        .join("، "),
    },
  ];
}

export function AtomCanvas({ p, playing, accent }: SimProps) {
  const e = element(p.z);
  // Nucleus: protons and neutrons packed on a sunflower spiral, mixed evenly.
  const nucleons = useMemo(() => {
    const n = e.mass;
    const list: { x: number; y: number; proton: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      // Exactly z protons, spread evenly among the neutrons.
      const proton = Math.floor(((i + 1) * e.z) / n) > Math.floor((i * e.z) / n);
      const r = Math.sqrt(i + 0.5);
      const a = i * 2.39996;
      list.push({ x: r * Math.cos(a), y: r * Math.sin(a), proton });
    }
    return list.reverse(); // draw the outer ones first so the centre is on top
  }, [e]);

  const ref = useAnimatedCanvas((ctx, w, h, _dt, time) => {
    const shells = bohrShells(e.z);
    grid(ctx, w, h);
    const cx = w / 2;
    const cy = h / 2 + 6;
    const maxR = Math.min(w, h) / 2 - 26;
    const nr = Math.max(4, Math.min(7, maxR / 22)); // nucleon radius
    const nucleusR = nr * Math.sqrt(nucleons.length) + nr;
    const gap = (maxR - nucleusR - 10) / Math.max(1, shells.length);

    // Shells and electrons.
    shells.forEach((count, s) => {
      const r = nucleusR + 14 + gap * (s + 0.6);
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      const spin = playing ? time * (0.9 / (s + 1)) : 0;
      for (let i = 0; i < count; i++) {
        const a = spin + (i / count) * Math.PI * 2 + s * 0.4;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Nucleus.
    const wobble = playing ? 0.6 : 0;
    nucleons.forEach((q, i) => {
      const x = cx + q.x * nr * 1.55 + Math.sin(time * 9 + i) * wobble;
      const y = cy + q.y * nr * 1.55 + Math.cos(time * 8 + i * 1.3) * wobble;
      ctx.fillStyle = q.proton ? PROTON : NEUTRON;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, nr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Legend: what the three colours are, with counts.
    const legend: [string, string, number][] = [
      [PROTON, "پروتون", e.z],
      [NEUTRON, "نیوترون", e.mass - e.z],
      [accent, "الکترون", e.z],
    ];
    legend.forEach(([color, name, n], i) => {
      const y = 20 + i * 20;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w - 18, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, `${name} ${fmt(n, 0)}`, w - 30, y, { size: 12, align: "right", color: C.ink, weight: 600 });
    });
    text(ctx, e.symbol, 18, 26, { size: 26, align: "left", color: C.ink, weight: 800 });
    text(ctx, e.name, 18, 52, { size: 13, align: "left", color: C.muted });
  });

  return <canvas ref={ref} />;
}
