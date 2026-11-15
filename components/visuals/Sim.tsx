"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { GRAVITY_PRESETS, initialParams, SIM_PARAMS, temperatureRange, type ParamDef } from "@/lib/visuals/physics";
import type { SimSpec, SimType } from "@/lib/visuals/types";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown/Markdown";
import { fmt } from "./format";
import { CircuitCanvas, circuitReadouts } from "./sims/Circuit";
import { InclineCanvas, inclineReadouts } from "./sims/Incline";
import { PendulumCanvas, pendulumReadouts } from "./sims/Pendulum";
import { ProjectileCanvas, projectileReadouts } from "./sims/Projectile";
import { StatesCanvas, statesReadouts } from "./sims/States";
import type { Readout, SimProps } from "./sims/types";
import { WaveCanvas, waveReadouts } from "./sims/Wave";

const CANVAS: Record<SimType, (props: SimProps) => React.ReactElement> = {
  projectile: ProjectileCanvas,
  pendulum: PendulumCanvas,
  incline: InclineCanvas,
  circuit: CircuitCanvas,
  wave: WaveCanvas,
  states: StatesCanvas,
};

function readouts(spec: SimSpec, p: Record<string, number>): Readout[] {
  switch (spec.type) {
    case "projectile":
      return projectileReadouts(p);
    case "pendulum":
      return pendulumReadouts(p);
    case "incline":
      return inclineReadouts(p);
    case "circuit":
      return circuitReadouts(p);
    case "wave":
      return waveReadouts(p);
    case "states":
      return statesReadouts(p, spec.substance);
  }
}

/** Slider definitions, with the temperature range fitted to the substance. */
function paramDefs(spec: SimSpec): ParamDef[] {
  const defs = SIM_PARAMS[spec.type];
  if (spec.type !== "states" || !spec.substance) return defs;
  const range = temperatureRange(spec.substance.melt, spec.substance.boil);
  return defs.map((d) =>
    d.key === "temperature" ? { ...d, ...range, value: Math.round((spec.substance!.melt + spec.substance!.boil) / 2) } : d,
  );
}

function Slider({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number) => void }) {
  const decimals = def.step < 0.1 ? 2 : def.step < 1 ? 1 : 0;
  return (
    <label className="sim-slider">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold opacity-85">{def.label}</span>
        <span className="sim-value">
          {fmt(value, decimals)}
          {def.unit && (
            <span className="ms-1 text-[11px] opacity-70">
              <bdi dir="ltr">{def.unit}</bdi>
            </span>
          )}
        </span>
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={def.label}
      />
    </label>
  );
}

export default function Sim({ spec }: { spec: SimSpec }) {
  const defs = useMemo(() => paramDefs(spec), [spec]);
  const [p, setP] = useState(() => {
    const base = initialParams(spec.type, spec.params);
    if (spec.type === "states") {
      const t = defs.find((d) => d.key === "temperature")!;
      base.temperature =
        typeof spec.params.temperature === "number" ? Math.min(t.max, Math.max(t.min, spec.params.temperature)) : t.value;
    }
    return base;
  });
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0);
  const Canvas = CANVAS[spec.type];
  const hasGravity = defs.some((d) => d.key === "g");

  return (
    <div className="sim-layout">
      <div className="sim-canvas">
        <Canvas p={p} playing={playing} run={run} substance={spec.substance} />
      </div>

      <div className="sim-panel">
        <div className="flex gap-2">
          <button type="button" onClick={() => setPlaying((x) => !x)} className="sim-btn sim-btn-primary">
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
            {playing ? "توقف" : "ادامه"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRun((r) => r + 1);
              setPlaying(true);
            }}
            className="sim-btn"
          >
            <RotateCcw className="size-4" /> از نو
          </button>
        </div>

        <div className="grid gap-3">
          {defs.map((def) => (
            <Slider key={def.key} def={def} value={p[def.key]} onChange={(v) => setP((prev) => ({ ...prev, [def.key]: v }))} />
          ))}
        </div>

        {hasGravity && (
          <div className="flex flex-wrap gap-1.5">
            {GRAVITY_PRESETS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setP((prev) => ({ ...prev, g: g.g }))}
                className="sim-chip"
                data-active={Math.abs(p.g - g.g) < 0.05 ? "true" : undefined}
              >
                {g.label} {fmt(g.g)}
              </button>
            ))}
          </div>
        )}

        <div className="sim-readouts">
          {readouts(spec, p).map((r) => (
            <div key={r.label} className={cn("sim-readout", r.tone && `sim-readout-${r.tone}`)}>
              <div className="text-[11.5px] opacity-75">{r.label}</div>
              <div className="sim-readout-value">
                {r.value}
                {r.unit && (
                  <span className="ms-1 text-[12px] font-semibold opacity-70">
                    <bdi dir="ltr">{r.unit}</bdi>
                  </span>
                )}
              </div>
              {r.tex && (
                <div className="sim-tex" dir="ltr">
                  <Markdown text={`$${r.tex}$`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
