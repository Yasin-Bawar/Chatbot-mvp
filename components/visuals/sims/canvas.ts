"use client";

import { useEffect, useRef } from "react";

export const FONT = '"Vazirmatn Variable", "Vazirmatn", Tahoma, sans-serif';

/** Light "textbook page" colours. The subject colour comes in as `accent`. */
export const C = {
  page: "#ffffff",
  grid: "#eef2f7",
  ground: "#eef2f7",
  groundLine: "#94a3b8",
  ink: "#1e293b",
  text: "#1e293b",
  muted: "#64748b",
  faint: "#cbd5e1",
  warm: "#d97706",
};

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, time: number) => void;

/**
 * Keeps a canvas sized to its parent (sharp on high-density screens) and calls
 * `draw` every frame. `draw` may change between renders; the newest is used.
 */
export function useAnimatedCanvas(draw: DrawFn) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 1;
    let h = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, parent.clientWidth);
      h = Math.max(1, parent.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h, dt, now / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return canvasRef;
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    weight?: number;
    baseline?: CanvasTextBaseline;
    bg?: string;
  } = {},
) {
  ctx.save();
  ctx.font = `${opts.weight ?? 600} ${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "middle";
  // Labels with Dari words are right-to-left; numbers, units and formulas left-to-right.
  ctx.direction = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/.test(value) ? "rtl" : "ltr";
  if (opts.bg) {
    const m = ctx.measureText(value);
    const pw = m.width + 12;
    const ph = (opts.size ?? 13) + 8;
    const left = opts.align === "left" ? x - 6 : opts.align === "right" ? x - m.width - 6 : x - pw / 2;
    ctx.fillStyle = opts.bg;
    ctx.beginPath();
    ctx.roundRect(left, y - ph / 2, pw, ph, 7);
    ctx.fill();
  }
  ctx.fillStyle = opts.color ?? C.text;
  ctx.fillText(value, x, y);
  ctx.restore();
}

export function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 3) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 2) return;
  const head = Math.min(12, len * 0.4);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(angle) * head * 0.7, y2 - Math.sin(angle) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
  ctx.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function grid(ctx: CanvasRenderingContext2D, w: number, h: number, step = 32) {
  ctx.save();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y < h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

/** A filled circle with a thin ink outline (balls, bobs, particles). */
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = C.ink) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
