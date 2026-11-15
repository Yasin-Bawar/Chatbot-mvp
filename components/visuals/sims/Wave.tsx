"use client";

import { useRef } from "react";
import { wave } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, dot, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

const VISIBLE_METERS = 6;

export function waveReadouts(p: Record<string, number>): Readout[] {
  const wv = wave(p.amplitude, p.frequency, p.wavelength);
  return [
    { label: "سرعت", value: fmt(wv.speed, 2), unit: "m/s", tone: "accent" },
    { label: "دوره", value: fmt(wv.period, 2), unit: "s" },
  ];
}

export function WaveCanvas({ p, playing, accent }: SimProps) {
  const t = useRef(0);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    if (playing) t.current += dt;
    const wv = wave(p.amplitude, p.frequency, p.wavelength);
    grid(ctx, w, h);
    const left = 24;
    const mid = h / 2;
    const kx = (w - left * 2) / VISIBLE_METERS;
    const ky = h / 2 - 44;
    const X = (x: number) => left + x * kx;
    const Y = (y: number) => mid - y * ky;

    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, mid);
    ctx.lineTo(w - left, mid);
    ctx.stroke();

    // The rope.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const x = (VISIBLE_METERS * i) / 240;
      const y = wv.y(x, t.current);
      if (i === 0) ctx.moveTo(X(x), Y(y));
      else ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();

    // One particle of the rope: it only moves up and down.
    const tracked = 1;
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.moveTo(X(tracked), Y(p.amplitude) - 6);
    ctx.lineTo(X(tracked), Y(-p.amplitude) + 6);
    ctx.stroke();
    ctx.restore();
    dot(ctx, X(tracked), Y(wv.y(tracked, t.current)), 6, "#ffffff");

    // One wavelength between two crests, and the amplitude.
    const crest = p.wavelength * (0.25 + ((p.frequency * t.current) % 1));
    if (crest + p.wavelength <= VISIBLE_METERS) {
      const y = Y(p.amplitude) - 16;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(crest), y + 5);
      ctx.lineTo(X(crest), y);
      ctx.lineTo(X(crest + p.wavelength), y);
      ctx.lineTo(X(crest + p.wavelength), y + 5);
      ctx.stroke();
      text(ctx, "λ", X(crest + p.wavelength / 2), y - 10, { size: 14, color: C.ink, weight: 700 });
    }
    const ax = X(VISIBLE_METERS) - 4;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax - 4, mid);
    ctx.lineTo(ax + 4, mid);
    ctx.moveTo(ax, mid);
    ctx.lineTo(ax, Y(p.amplitude));
    ctx.moveTo(ax - 4, Y(p.amplitude));
    ctx.lineTo(ax + 4, Y(p.amplitude));
    ctx.stroke();
    text(ctx, "A", ax - 12, (mid + Y(p.amplitude)) / 2, { size: 13, color: C.ink, weight: 700 });
  });

  return <canvas ref={ref} />;
}
