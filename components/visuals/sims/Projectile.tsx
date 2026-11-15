"use client";

import { useEffect, useRef } from "react";
import { projectile } from "@/lib/visuals/physics";
import { fmt } from "../format";
import { arrow, C, glowCircle, grid, text, useAnimatedCanvas } from "./canvas";
import type { Readout, SimProps } from "./types";

type Shot = ReturnType<typeof projectile>;

export function projectileReadouts(p: Record<string, number>): Readout[] {
  const s = projectile(p.v0, p.angle, p.h0, p.g);
  return [
    {
      label: "برد (فاصله افقی)",
      value: fmt(s.range),
      unit: "m",
      tex: p.h0 === 0 ? "R = \\dfrac{v_0^2 \\sin 2\\theta}{g}" : undefined,
    },
    { label: "بلندترین ارتفاع", value: fmt(s.maxHeight), unit: "m", tex: "H = h_0 + \\dfrac{v_0^2 \\sin^2\\theta}{2g}" },
    { label: "زمان پرواز", value: fmt(s.flightTime, 2), unit: "s" },
  ];
}

export function ProjectileCanvas({ p, playing, run }: SimProps) {
  const shot = useRef<Shot>(projectile(p.v0, p.angle, p.h0, p.g));
  const t = useRef(0);
  const wait = useRef(0);
  const trails = useRef<Shot[]>([]);

  // New values or "again": keep the last flight as a faint trail and start over.
  useEffect(() => {
    if (t.current > 0.2) trails.current = [shot.current, ...trails.current].slice(0, 3);
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
        trails.current = [s, ...trails.current].slice(0, 3);
        t.current = 0;
        wait.current = 0;
      }
    }

    grid(ctx, w, h);
    const left = 54;
    const ground = h - 42;
    const all = [s, ...trails.current];
    const worldW = Math.max(8, ...all.map((x) => x.range)) * 1.08;
    const worldH = Math.max(4, ...all.map((x) => x.maxHeight)) * 1.15;
    const k = Math.min((w - left - 30) / worldW, (ground - 30) / worldH);
    const X = (x: number) => left + x * k;
    const Y = (y: number) => ground - y * k;

    // Ground and launch platform.
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, ground, w, h - ground);
    const h0 = s.at(0).y;
    if (h0 > 0) {
      ctx.fillStyle = "#3a4580";
      ctx.fillRect(0, Y(h0), left + 6, ground - Y(h0));
      text(ctx, `${fmt(h0)} m`, left / 2 + 3, (Y(h0) + ground) / 2, { size: 11, color: C.muted });
    }

    // Faint earlier flights, then the predicted path.
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
    trails.current.forEach((old, i) => {
      ctx.strokeStyle = `rgba(167,139,250,${0.35 - i * 0.09})`;
      path(old, old.flightTime);
    });
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(253,224,71,0.35)";
    path(s, s.flightTime);
    ctx.setLineDash([]);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    if (t.current > 0) path(s, t.current);
    ctx.restore();

    // Cannon.
    const a = Math.atan2(s.vy, s.vx);
    ctx.save();
    ctx.translate(X(0), Y(h0));
    ctx.rotate(-a);
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.roundRect(-6, -7, 40, 14, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.arc(X(0), Y(h0), 11, 0, Math.PI * 2);
    ctx.fill();
    // Launch angle.
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(0), Y(h0), 52, -a, 0);
    ctx.stroke();
    text(ctx, `${fmt(p.angle, 0)}°`, X(0) + 66 * Math.cos(a / 2), Y(h0) - 66 * Math.sin(a / 2), { size: 12, color: C.text });

    // Highest point and range markers.
    const peak = s.at(s.peakTime);
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = "rgba(96,165,250,0.6)";
    ctx.beginPath();
    ctx.moveTo(X(peak.x), Y(peak.y));
    ctx.lineTo(X(peak.x), ground);
    ctx.stroke();
    ctx.restore();
    text(ctx, `H = ${fmt(s.maxHeight)} m`, X(peak.x), Y(peak.y) - 16, { size: 12, color: C.blue, bg: "rgba(15,21,51,0.75)" });
    text(ctx, `R = ${fmt(s.range)} m`, Math.min(w - 50, X(s.range)), ground + 22, { size: 12, color: C.accent });
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.moveTo(X(s.range), ground);
    ctx.lineTo(X(s.range) - 6, ground + 8);
    ctx.lineTo(X(s.range) + 6, ground + 8);
    ctx.fill();

    // Ball and its velocity (horizontal part stays the same, vertical part changes).
    const now = s.at(t.current);
    const bx = X(now.x);
    const by = Y(now.y);
    const vk = 2.2;
    if (t.current > 0 && t.current < s.flightTime) {
      arrow(ctx, bx, by, bx + s.vx * vk, by, C.green, 2.5);
      arrow(ctx, bx, by, bx, by - now.vy * vk, C.blue, 2.5);
      arrow(ctx, bx, by, bx + s.vx * vk, by - now.vy * vk, C.accent, 2);
    }
    glowCircle(ctx, bx, by, 8, "#f8fafc", 18);

    // Legend.
    text(ctx, "سرعت افقی (ثابت)", w - 14, 18, { size: 11, color: C.green, align: "right" });
    text(ctx, "سرعت عمودی (تغییر می‌کند)", w - 14, 36, { size: 11, color: C.blue, align: "right" });
  });

  return <canvas ref={ref} />;
}
