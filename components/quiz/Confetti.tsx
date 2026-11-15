"use client";

import { memo, type CSSProperties } from "react";

const COLORS = ["#22c55e", "#4f46e5", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7", "#facc15"];

/** Deterministic pseudo-random in [0, 1) so rendering stays pure. */
function rand(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Small CSS confetti: a burst from the centre, or a rain from the top. */
export const Confetti = memo(function Confetti({ mode = "burst", count = 16 }: { mode?: "burst" | "rain"; count?: number }) {
  return (
    <div aria-hidden className={mode === "burst" ? "confetti-burst" : "confetti-rain"}>
      {Array.from({ length: count }, (_, i) => {
        const angle = rand(i, 1) * Math.PI * 2;
        const dist = 40 + rand(i, 2) * 70;
        const style = {
          "--x": mode === "burst" ? `${Math.cos(angle) * dist}px` : `${rand(i, 3) * 100}vw`,
          "--y": mode === "burst" ? `${Math.sin(angle) * dist - 20}px` : "110dvh",
          "--r": `${rand(i, 4) * 720 - 360}deg`,
          "--d": `${mode === "burst" ? 0.6 + rand(i, 5) * 0.3 : 1.8 + rand(i, 6) * 1.6}s`,
          "--delay": `${mode === "burst" ? 0 : rand(i, 7) * 0.8}s`,
          background: COLORS[i % COLORS.length],
          borderRadius: i % 3 === 0 ? "9999px" : "2px",
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
});
