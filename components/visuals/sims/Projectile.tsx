"use client";

import { useEffect, useRef } from "react";
import { projectile } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, dot, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

type Shot = ReturnType<typeof projectile>;

export function projectileReadouts(p: Record<string, number>): Readout[] {
  const s = projectile(p.v0, p.angle, p.h0, p.g);
  return [
    { label: "برد", value: fmt(s.range), unit: "m", tone: "accent" },
    { label: "ارتفاع", value: fmt(s.maxHeight), unit: "m" },
  ];
}

export function ProjectileCanvas({ p, playing, run, accent }: SimProps) {
  const shot = useRef<Shot>(projectile(p.v0, p.angle, p.h0, p.g));
  const t = useRef(0);
  const wait = useRef(0);
  const trails = useRef<Shot[]>([]);

  // New values or "again": keep the last flight as a faint trail and start over.
  useEffect(() => {
    if (t.current > 0.2) trails.current = [shot.current, ...trails.current].slice(0, 2);
    shot.current = projectile(p.v0, p.angle, p.h0, p.g);
    t.current = 0;
    wait.current = 0;
  }, [p.v0, p.angle, p.h0, p.g, run]);

  const ref = useAnimatedCanvas((ctx, w, h, dt) => {
    const s = shot.current;
    const speed = Math.max(1, s.flightTime / 3.2);
    if (playing) {
      if (t.current < s.flightTime) t.current = Math.min(s.flightTime, t.current + dt * speed);
      else if ((wait.current += dt) > 1.6) {
        t.current = 0;
        wait.current = 0;
      }
    }

    grid(ctx, w, h);
    const left = 48;
    const ground = h - 36;
    const all = [s, ...trails.current];
    const worldW = Math.max(8, ...all.map((x) => x.range)) * 1.08;
    const worldH = Math.max(4, ...all.map((x) => x.maxHeight)) * 1.2;
    const k = Math.min((w - left - 28) / worldW, (ground - 28) / worldH);
    const X = (x: number) => left + x * k;
    const Y = (y: number) => ground - y * k;

    // Ground (and a platform when thrown from a height).
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(w, ground);
    ctx.stroke();
    const h0 = s.at(0).y;
    if (h0 > 0) {
      ctx.fillStyle = C.faint;
      ctx.fillRect(0, Y(h0), left + 4, ground - Y(h0));
    }

    const path = (shotX: Shot, until: number) => {
      ctx.beginPath();
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const q = shotX.at((until * i) / steps);
        if (i === 0) ctx.moveTo(X(q.x), Y(q.y));
        else ctx.lineTo(X(q.x), Y(q.y));
      }
      ctx.stroke();
    };
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.faint;
    for (const old of trails.current) path(old, old.flightTime);
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = C.muted;
    ctx.globalAlpha = 0.5;
    path(s, s.flightTime);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    if (t.current > 0) path(s, t.current);
    ctx.restore();

    // Cannon and launch angle.
    const a = Math.atan2(s.vy, s.vx);
    ctx.save();
    ctx.translate(X(0), Y(h0));
    ctx.rotate(-a);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(-4, -5, 32, 10, 5);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(X(0), Y(h0), 44, -a, 0);
    ctx.stroke();
    text(ctx, `θ`, X(0) + 56 * Math.cos(a / 2), Y(h0) - 56 * Math.sin(a / 2), { size: 13, color: C.muted });

    // Highest point and range.
    const peak = s.at(s.peakTime);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = C.faint;
    ctx.beginPath();
    ctx.moveTo(X(peak.x), Y(peak.y));
    ctx.lineTo(X(peak.x), ground);
    ctx.stroke();
    ctx.restore();
    text(ctx, "H", X(peak.x) + 12, (Y(peak.y) + ground) / 2, { size: 13, color: C.muted, weight: 700 });
    text(ctx, "R", Math.min(w - 16, X(s.range)), ground + 18, { size: 13, color: accent, weight: 800 });

    // The ball and its velocity.
    const now = s.at(t.current);
    const bx = X(now.x);
    const by = Y(now.y);
    if (t.current > 0 && t.current < s.flightTime) arrow(ctx, bx, by, bx + s.vx * 2, by - now.vy * 2, accent, 2);
    dot(ctx, bx, by, 7, "#ffffff");
  });

  return <canvas ref={ref} />;
}
