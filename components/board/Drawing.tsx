"use client";

import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { T } from "@/lib/board/timing";
import type { ChalkColor, DrawItem, Vec } from "@/lib/board/types";
import { textDirection } from "@/lib/persian";
import { CHALK, ChalkText } from "./Chalk";

const W = 560;
const MAX_H = 400;
const PAD = 44;
const MAX_SCALE = 90; // px per unit

const DEFAULT_COLOR: Record<DrawItem["t"], ChalkColor> = {
  point: "white",
  line: "white",
  arrow: "yellow",
  polygon: "white",
  circle: "blue",
  angle: "pink",
  text: "white",
};

function itemPoints(item: DrawItem): Vec[] {
  switch (item.t) {
    case "point":
    case "text":
      return [item.at];
    case "line":
    case "arrow":
      return [item.from, item.to];
    case "polygon":
      return item.points;
    case "circle":
      return [
        [item.center[0] - item.r, item.center[1] - item.r],
        [item.center[0] + item.r, item.center[1] + item.r],
      ];
    case "angle":
      return [item.at];
  }
}

/** Rough half-width in px of a label once rendered (math markup stripped). */
function labelHalfWidth(label: string): number {
  const visible = label.replace(/\\[a-zA-Z]+|[$\\{}^_]/g, "");
  return Math.min(70, Math.max(6, visible.length * 4.6));
}

/** Label that supports $math$; falls back to plain SVG text. */
function Label({ x, y, text, color, className, style }: { x: number; y: number; text: string; color: string; className?: string; style?: CSSProperties }) {
  const rich = /[$\\^_]/.test(text);
  if (!rich) {
    return (
      <text
        x={x}
        y={y + 5}
        fill={color}
        fontSize="15"
        fontWeight="600"
        textAnchor="middle"
        direction={textDirection(text)}
        className={className}
        style={style}
      >
        {text}
      </text>
    );
  }
  return (
    <foreignObject x={x - 80} y={y - 16} width="160" height="34" className={className} style={style}>
      <div className="flex h-full items-center justify-center text-[15px] font-semibold" style={{ color }}>
        <span>
          <ChalkText text={text.includes("$") ? text : `$${text}$`} />
        </span>
      </div>
    </foreignObject>
  );
}

/** Geometry / physics sketch drawn on the board item by item. */
export const BoardDrawing = memo(function BoardDrawing({
  items,
  grid,
  animate,
  delay = 0,
  k = 1,
}: {
  items: DrawItem[];
  grid?: boolean;
  animate: boolean;
  delay?: number;
  /** Time scale (board speed). */
  k?: number;
}) {
  const uid = useId().replace(/:/g, "");

  const geo = useMemo(() => {
    const pts = items.flatMap(itemPoints);
    let minX = Math.min(...pts.map((p) => p[0]));
    let maxX = Math.max(...pts.map((p) => p[0]));
    let minY = Math.min(...pts.map((p) => p[1]));
    let maxY = Math.max(...pts.map((p) => p[1]));
    if (!Number.isFinite(minX)) [minX, maxX, minY, maxY] = [0, 1, 0, 1];
    if (maxX - minX < 1e-6) {
      minX -= 1;
      maxX += 1;
    }
    if (maxY - minY < 1e-6) {
      minY -= 1;
      maxY += 1;
    }
    const scale = Math.min((W - 2 * PAD) / (maxX - minX), (MAX_H - 2 * PAD) / (maxY - minY), MAX_SCALE);
    const height = Math.max(160, (maxY - minY) * scale + 2 * PAD);
    const offsetX = (W - (maxX - minX) * scale) / 2;
    const px = (p: Vec): Vec => [offsetX + (p[0] - minX) * scale, height - PAD - (p[1] - minY) * scale];
    const cxy = pts.reduce<Vec>((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    return { px, height, scale, centroid: px(cxy), minX, maxX, minY, maxY };
  }, [items]);

  const timing = (i: number, extra = 0) =>
    (animate ? { "--delay": `${(delay + i * T.drawItem + extra) * k}s`, "--draw": `${T.drawItem * k}s` } : undefined) as
      | CSSProperties
      | undefined;
  const stroke = animate ? "chalk-stroke" : undefined;
  const pop = animate ? "chalk-pop" : undefined;

  /**
   * Label position next to a segment (at fraction t along it), on the side away
   * from the figure's centre, pushed far enough that a wide label clears the line.
   */
  const sideLabel = (a: Vec, b: Vec, label: string, t = 0.5): Vec => {
    const m: Vec = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let n: Vec = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    if ((m[0] - geo.centroid[0]) * n[0] + (m[1] - geo.centroid[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const gap = 10 + Math.abs(n[0]) * labelHalfWidth(label) + Math.abs(n[1]) * 10;
    return [m[0] + n[0] * gap, m[1] + n[1] * gap];
  };

  /** Point labels sit outside the figure (away from its centre). */
  const pointLabel = (p: Vec, label: string): Vec => {
    let d: Vec = [p[0] - geo.centroid[0], p[1] - geo.centroid[1]];
    const len = Math.hypot(d[0], d[1]);
    d = len < 1 ? [0.7, -0.7] : [d[0] / len, d[1] / len];
    const gap = 12 + Math.abs(d[0]) * labelHalfWidth(label) + Math.abs(d[1]) * 6;
    return [p[0] + d[0] * gap, p[1] + d[1] * gap];
  };

  const render = (item: DrawItem, i: number): ReactNode => {
    const color = CHALK[item.color ?? DEFAULT_COLOR[item.t]];
    switch (item.t) {
      case "point": {
        const [x, y] = geo.px(item.at);
        return (
          <g key={i} className={pop} style={timing(i)}>
            <circle cx={x} cy={y} r="4.5" fill={color} />
            {item.label &&
              (() => {
                const [lx, ly] = pointLabel([x, y], item.label);
                return <Label x={lx} y={ly} text={item.label} color={color} />;
              })()}
          </g>
        );
      }
      case "line": {
        const a = geo.px(item.from);
        const b = geo.px(item.to);
        const l = item.label ? sideLabel(a, b, item.label) : null;
        return (
          <g key={i}>
            <path
              d={`M${a[0]},${a[1]}L${b[0]},${b[1]}`}
              stroke={color}
              strokeWidth="2.6"
              strokeDasharray={item.dashed ? "7 7" : undefined}
              pathLength={item.dashed ? undefined : 1}
              className={item.dashed ? pop : stroke}
              style={timing(i)}
              filter={`url(#${uid}-chalk)`}
            />
            {l && <Label x={l[0]} y={l[1]} text={item.label!} color={color} className={pop} style={timing(i, 0.3)} />}
          </g>
        );
      }
      case "arrow": {
        const a = geo.px(item.from);
        const b = geo.px(item.to);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const h = 13;
        const p1: Vec = [b[0] - h * Math.cos(ang - 0.45), b[1] - h * Math.sin(ang - 0.45)];
        const p2: Vec = [b[0] - h * Math.cos(ang + 0.45), b[1] - h * Math.sin(ang + 0.45)];
        const tip = sideLabel(a, b, item.label ?? "", 0.72);
        return (
          <g key={i} filter={`url(#${uid}-chalk)`}>
            <path d={`M${a[0]},${a[1]}L${b[0]},${b[1]}`} stroke={color} strokeWidth="3" pathLength={1} className={stroke} style={timing(i)} />
            <path d={`M${p1[0]},${p1[1]}L${b[0]},${b[1]}L${p2[0]},${p2[1]}`} stroke={color} strokeWidth="3" className={pop} style={timing(i, 0.35)} />
            {item.label && <Label x={tip[0]} y={tip[1]} text={item.label} color={color} className={pop} style={timing(i, 0.35)} />}
          </g>
        );
      }
      case "polygon": {
        const ps = item.points.map(geo.px);
        const d = `M${ps.map((p) => `${p[0]},${p[1]}`).join("L")}Z`;
        const c = ps.reduce<Vec>((acc, p) => [acc[0] + p[0] / ps.length, acc[1] + p[1] / ps.length], [0, 0]);
        return (
          <g key={i}>
            {item.fill && <path d={d} fill={color} fillOpacity="0.12" className={pop} style={timing(i, 0.3)} />}
            <path d={d} stroke={color} strokeWidth="2.6" pathLength={1} className={stroke} style={timing(i)} filter={`url(#${uid}-chalk)`} />
            {item.label && <Label x={c[0]} y={c[1]} text={item.label} color={color} className={pop} style={timing(i, 0.3)} />}
          </g>
        );
      }
      case "circle": {
        const [x, y] = geo.px(item.center);
        const r = item.r * geo.scale;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} stroke={color} strokeWidth="2.6" pathLength={1} className={stroke} style={timing(i)} filter={`url(#${uid}-chalk)`} />
            {item.label && <Label x={x} y={y - r - 14} text={item.label} color={color} className={pop} style={timing(i, 0.3)} />}
          </g>
        );
      }
      case "angle": {
        const v = geo.px(item.at);
        const a = geo.px(item.from);
        const b = geo.px(item.to);
        const r = 26;
        const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
        const a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
        let delta = a2 - a1;
        while (delta <= -Math.PI) delta += 2 * Math.PI;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        const mid = a1 + delta / 2;
        const s: Vec = [v[0] + r * Math.cos(a1), v[1] + r * Math.sin(a1)];
        const e: Vec = [v[0] + r * Math.cos(a2), v[1] + r * Math.sin(a2)];
        const d = item.right
          ? (() => {
              const q = 16;
              const u: Vec = [Math.cos(a1) * q, Math.sin(a1) * q];
              const w: Vec = [Math.cos(a2) * q, Math.sin(a2) * q];
              return `M${v[0] + u[0]},${v[1] + u[1]}L${v[0] + u[0] + w[0]},${v[1] + u[1] + w[1]}L${v[0] + w[0]},${v[1] + w[1]}`;
            })()
          : `M${s[0]},${s[1]}A${r},${r} 0 0 ${delta > 0 ? 1 : 0} ${e[0]},${e[1]}`;
        const lp: Vec = [v[0] + (r + 18) * Math.cos(mid), v[1] + (r + 18) * Math.sin(mid)];
        return (
          <g key={i}>
            <path d={d} stroke={color} strokeWidth="2.2" pathLength={1} className={stroke} style={timing(i)} />
            {item.label && <Label x={lp[0]} y={lp[1]} text={item.label} color={color} className={pop} style={timing(i, 0.3)} />}
          </g>
        );
      }
      case "text": {
        const [x, y] = geo.px(item.at);
        return <Label key={i} x={x} y={y} text={item.text} color={color} className={pop} style={timing(i)} />;
      }
    }
  };

  const gridLines: ReactNode[] = [];
  if (grid) {
    for (let gx = Math.ceil(geo.minX); gx <= Math.floor(geo.maxX); gx++) {
      const [x] = geo.px([gx, 0]);
      gridLines.push(<line key={`gx${gx}`} x1={x} x2={x} y1={PAD / 2} y2={geo.height - PAD / 2} />);
    }
    for (let gy = Math.ceil(geo.minY); gy <= Math.floor(geo.maxY); gy++) {
      const [, y] = geo.px([0, gy]);
      gridLines.push(<line key={`gy${gy}`} x1={PAD / 2} x2={W - PAD / 2} y1={y} y2={y} />);
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${geo.height}`} className="mx-auto h-auto w-full max-w-[560px]" role="img" aria-label="drawing" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <filter id={`${uid}-chalk`} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={geo.height}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
      </defs>
      {grid && (
        <g stroke="rgba(244,241,232,0.08)" strokeWidth="1">
          {gridLines}
        </g>
      )}
      {items.map(render)}
    </svg>
  );
});
