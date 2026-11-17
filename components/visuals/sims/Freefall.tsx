"use client";

import { useEffect, useRef } from "react";
import { fallWithAir, freeFall } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { C, dot, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

/** Terminal speeds in air (m/s): a heavy ball and a feather. */
const BALL_VT = 30;
const FEATHER_VT = 1.6;

function falls(p: Record<string, number>) {
  if (p.air < 0.5) {
    const f = freeFall(p.height, p.g);
    const d = (t: number) => Math.min(p.height, 0.5 * p.g * t * t);
    return { ball: { ...f, distance: d }, feather: { ...f, distance: d } };
  }
  return { ball: fallWithAir(p.height, p.g, BALL_VT), feather: fallWithAir(p.height, p.g, FEATHER_VT) };
}

export function freefallReadouts(p: Record<string, number>): Readout[] {
  const { ball, feather } = falls(p);
  const out: Readout[] = [
    { label: "زمان توپ", value: fmt(ball.time, 2), unit: "s", tone: "accent" },
    { label: "سرعت", value: fmt(ball.speed), unit: "m/s" },
  ];
  if (p.air >= 0.5) out.push({ label: "زمان پَر", value: fmt(feather.time, 1), unit: "s" });
  return out;
}

function feather(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = "#f1f5f9";
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(11, -10, 9, 8, 0, 16);
  ctx.bezierCurveTo(-9, 8, -11, -10, 0, -18);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 22);
  ctx.stroke();
  ctx.restore();
}

export function FreefallCanvas({ p, playing, run, accent }: SimProps) {
  const t = useRef(0);
  const wait = useRef(0);

  useEffect(() => {
    t.current = 0;
    wait.current = 0;
  }, [p.height, p.g, p.air, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt, time) => {
    const { ball, feather: fth } = falls(p);
    const end = Math.max(ball.time, fth.time);
    // Slow motion for short drops, fast-forward for a slowly drifting feather.
    const speed = Math.max(ball.time / 2.4, end / 10, 0.35);
    if (playing) {
      if (t.current < end) t.current = Math.min(end, t.current + dt * speed);
      else if ((wait.current += dt) > 1.6) {
        t.current = 0;
        wait.current = 0;
      }
    }

    grid(ctx, w, h);
    const top = 40;
    const ground = h - 40;
    const k = (ground - top) / p.height;
    const Y = (fallen: number) => top + fallen * k;

    // Ground and the starting height.
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(w, ground);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.moveTo(40, top);
    ctx.lineTo(w - 20, top);
    ctx.stroke();
    ctx.restore();

    // Height ruler.
    const rx = 34;
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, top);
    ctx.lineTo(rx, ground);
    ctx.stroke();
    const tick = p.height > 50 ? 20 : p.height > 20 ? 10 : 5;
    for (let m = 0; m <= p.height + 0.01; m += tick) {
      const y = ground - m * k;
      ctx.beginPath();
      ctx.moveTo(rx - 4, y);
      ctx.lineTo(rx, y);
      ctx.stroke();
      text(ctx, fmt(m, 0), rx - 8, y, { size: 10, color: C.muted, align: "right", weight: 500 });
    }

    const bx = w * 0.42;
    const fx = w * 0.68;
    const by = Y(ball.distance(t.current));
    const fy = Y(fth.distance(t.current));
    const air = p.air >= 0.5;

    // Ball.
    dot(ctx, bx, Math.min(by, ground - 13), 13, accent);
    // Feather drifts and sways in air; in a vacuum it drops like the ball.
    const fallingFeather = t.current < fth.time;
    const sway = air && fallingFeather ? Math.sin(time * 3) : 0;
    feather(ctx, fx + sway * 12, Math.min(fy, ground - 18), air ? sway * 0.5 + (fallingFeather ? 0 : 1.4) : 0);

    text(ctx, "توپ", bx, ground + 20, { size: 12, color: C.muted });
    text(ctx, "پَر", fx, ground + 20, { size: 12, color: C.muted });
    text(ctx, `t = ${fmt(t.current, 2)} s`, w - 16, 18, { size: 13, align: "right", weight: 700, color: C.ink });
  });

  return <canvas ref={ref} />;
}
