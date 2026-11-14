"use client";

import { memo, useId, useMemo, type CSSProperties } from "react";
import { compileExpr, niceStep } from "@/lib/board/expr";
import type { ChalkColor, GraphSpec } from "@/lib/board/types";
import { CHALK, ChalkMath } from "./Chalk";

const W = 560;
const H = 340;
const PAD = { l: 34, r: 18, t: 18, b: 28 };
const CURVE_COLORS: ChalkColor[] = ["yellow", "blue", "pink", "green"];
const SAMPLES = 260;

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** A function graph drawn in chalk on the board, curve by curve. */
export const BoardGraph = memo(function BoardGraph({
  spec,
  animate,
  delay = 0,
}: {
  spec: GraphSpec;
  animate: boolean;
  delay?: number;
}) {
  const uid = useId().replace(/:/g, "");

  const model = useMemo(() => {
    const [x0, x1] = spec.x ?? [-10, 10];
    const fns = spec.fns.map((src) => ({ src, f: compileExpr(src) }));
    const samples = fns.map(({ f }) =>
      Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / SAMPLES;
        const y = f ? f(x) : NaN;
        return [x, y] as const;
      }),
    );

    let y0: number;
    let y1: number;
    if (spec.y) {
      [y0, y1] = spec.y;
    } else {
      const ys = samples.flat().map(([, y]) => y).filter((y) => Number.isFinite(y));
      for (const p of spec.points ?? []) ys.push(p[1]);
      ys.sort((a, b) => a - b);
      // Ignore extreme outliers (asymptotes) by using the 3rd–97th percentile.
      const lo = ys[Math.floor(ys.length * 0.03)] ?? -10;
      const hi = ys[Math.ceil(ys.length * 0.97) - 1] ?? 10;
      y0 = Math.min(lo, 0);
      y1 = Math.max(hi, 0);
      if (y1 - y0 < 1e-6) {
        y0 -= 1;
        y1 += 1;
      }
      const pad = (y1 - y0) * 0.1;
      y0 -= pad;
      y1 += pad;
    }

    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const sy = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    const span = y1 - y0;

    const paths = samples.map((pts) => {
      let d = "";
      let pen = false;
      let prevY = NaN;
      for (const [x, y] of pts) {
        const ok = Number.isFinite(y) && y > y0 - span && y < y1 + span && !(pen && Math.abs(y - prevY) > span * 1.2);
        if (!ok) {
          pen = false;
          prevY = y;
          continue;
        }
        d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
        pen = true;
        prevY = y;
      }
      return d;
    });

    const xStep = niceStep(x1 - x0, 8);
    const yStep = niceStep(y1 - y0, 6);
    const xTicks: number[] = [];
    for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1 + 1e-9; v += xStep) xTicks.push(v);
    const yTicks: number[] = [];
    for (let v = Math.ceil(y0 / yStep) * yStep; v <= y1 + 1e-9; v += yStep) yTicks.push(v);

    const axisY = y0 <= 0 && y1 >= 0 ? sy(0) : H - PAD.b;
    const axisX = x0 <= 0 && x1 >= 0 ? sx(0) : PAD.l;

    return { fns, paths, sx, sy, xTicks, yTicks, axisX, axisY };
  }, [spec]);

  const strokeStyle = (d: number, dur: number) =>
    (animate ? { "--delay": `${delay + d}s`, "--draw": `${dur}s` } : undefined) as CSSProperties | undefined;
  const strokeClass = animate ? "chalk-stroke" : undefined;
  const popClass = animate ? "chalk-pop" : undefined;
  const curvesStart = 0.7;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="graph">
        <defs>
          <filter id={`${uid}-chalk`} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
          </filter>
          <clipPath id={`${uid}-plot`}>
            <rect x={PAD.l} y={PAD.t - 4} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b + 8} />
          </clipPath>
        </defs>

        {/* faint grid */}
        <g stroke="rgba(244,241,232,0.08)" strokeWidth="1" className={popClass} style={strokeStyle(0, 0.4)}>
          {model.xTicks.map((v) => (
            <line key={`gx${v}`} x1={model.sx(v)} x2={model.sx(v)} y1={PAD.t} y2={H - PAD.b} />
          ))}
          {model.yTicks.map((v) => (
            <line key={`gy${v}`} x1={PAD.l} x2={W - PAD.r} y1={model.sy(v)} y2={model.sy(v)} />
          ))}
        </g>

        {/* axes */}
        <g filter={`url(#${uid}-chalk)`} stroke={CHALK.white} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9">
          <path pathLength={1} className={strokeClass} style={strokeStyle(0, 0.5)} d={`M${PAD.l - 6},${model.axisY}L${W - PAD.r + 4},${model.axisY}`} />
          <path pathLength={1} className={strokeClass} style={strokeStyle(0.15, 0.5)} d={`M${model.axisX},${H - PAD.b + 6}L${model.axisX},${PAD.t - 6}`} />
          <path className={popClass} style={strokeStyle(0.5, 0.3)} d={`M${W - PAD.r - 4},${model.axisY - 5}L${W - PAD.r + 4},${model.axisY}L${W - PAD.r - 4},${model.axisY + 5}`} />
          <path className={popClass} style={strokeStyle(0.6, 0.3)} d={`M${model.axisX - 5},${PAD.t + 2}L${model.axisX},${PAD.t - 6}L${model.axisX + 5},${PAD.t + 2}`} />
        </g>

        {/* tick labels */}
        <g fill="rgba(244,241,232,0.55)" fontSize="11" className={popClass} style={strokeStyle(0.4, 0.3)} direction="ltr">
          {model.xTicks.map((v) =>
            Math.abs(v) < 1e-9 ? null : (
              <text key={`tx${v}`} x={model.sx(v)} y={Math.min(H - 6, model.axisY + 16)} textAnchor="middle">
                {fmt(v)}
              </text>
            ),
          )}
          {model.yTicks.map((v) =>
            Math.abs(v) < 1e-9 ? null : (
              <text key={`ty${v}`} x={Math.max(14, model.axisX - 7)} y={model.sy(v) + 4} textAnchor="end">
                {fmt(v)}
              </text>
            ),
          )}
          <text x={W - PAD.r + 2} y={model.axisY - 9} textAnchor="end" fontStyle="italic" fontSize="13" fill={CHALK.white}>
            x
          </text>
          <text x={model.axisX + 9} y={PAD.t + 4} fontStyle="italic" fontSize="13" fill={CHALK.white}>
            y
          </text>
        </g>

        {/* curves */}
        <g clipPath={`url(#${uid}-plot)`} filter={`url(#${uid}-chalk)`} fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          {model.paths.map((d, i) =>
            d ? (
              <path
                key={i}
                d={d}
                pathLength={1}
                stroke={CHALK[CURVE_COLORS[i % CURVE_COLORS.length]]}
                className={strokeClass}
                style={strokeStyle(curvesStart + i * 1.2, 1.2)}
              />
            ) : null,
          )}
        </g>

        {/* marked points */}
        {(spec.points ?? []).map((p, i) => {
          const x = model.sx(p[0]);
          const y = model.sy(p[1]);
          const label = p[2] ?? `(${fmt(p[0])}, ${fmt(p[1])})`;
          const t = curvesStart + Math.max(1, model.paths.length) * 1.2 + i * 0.15;
          return (
            <g key={i} className={popClass} style={strokeStyle(t, 0.3)}>
              <circle cx={x} cy={y} r="5" fill={CHALK.pink} stroke="#1b352d" strokeWidth="1.5" />
              <text x={x + 8} y={y - 9} fill={CHALK.pink} fontSize="13" direction="ltr">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {spec.fns.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1" dir="ltr">
          {spec.fns.map((src, i) => {
            const color = CHALK[CURVE_COLORS[i % CURVE_COLORS.length]];
            const label = spec.labels?.[i];
            return (
              <span key={i} className="flex items-center gap-1.5 text-[13px]" style={{ color }}>
                <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: color }} />
                {label ? <ChalkMath tex={label} /> : <ChalkMath tex={`y = ${src.replace(/^(y|f\(x\))\s*=\s*/, "").replace(/\*/g, " \\cdot ")}`} />}
                {!model.fns[i].f && <span className="text-[11px] opacity-70">(?)</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});
