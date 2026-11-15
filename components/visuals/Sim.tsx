"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { GRAVITY_PRESETS, initialParams, SIM_PARAMS, temperatureRange, USES_GRAVITY, type ParamDef } from "@/lib/visuals/physics";
import type { SimSpec, SimType } from "@/lib/visuals/types";
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
      <span className="sim-slider-label">{def.label}</span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={def.label}
      />
      <span className="sim-value">
        {fmt(value, decimals)}
        {def.unit && (
          <small>
            <bdi dir="ltr">{def.unit}</bdi>
          </small>
        )}
      </span>
    </label>
  );
}

export default function Sim({ spec, accent }: { spec: SimSpec; accent: string }) {
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
  const hasGravity = USES_GRAVITY.includes(spec.type);

  return (
    <div className="sim-layout">
      <div className="sim-canvas">
        <Canvas p={p} playing={playing} run={run} accent={accent} substance={spec.substance} />
      </div>

      <div className="sim-panel">
        <div className="sim-top">
          <div className="sim-stats">
            {readouts(spec, p).map((r) => (
              <span key={r.label} className="sim-stat" data-tone={r.tone}>
                {r.label}
                <b>{r.value}</b>
                {r.unit && (
                  <small>
                    <bdi dir="ltr">{r.unit}</bdi>
                  </small>
                )}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((x) => !x)}
            className="visual-icon-btn visual-icon-btn-primary"
            aria-label={playing ? "توقف" : "ادامه"}
          >
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setRun((r) => r + 1);
              setPlaying(true);
            }}
            className="visual-icon-btn"
            aria-label="از نو"
          >
            <RotateCcw />
          </button>
        </div>

        {defs.map((def) => (
          <Slider key={def.key} def={def} value={p[def.key]} onChange={(v) => setP((prev) => ({ ...prev, [def.key]: v }))} />
        ))}

        {hasGravity && (
          <div className="sim-segmented" role="group" aria-label="جاذبه">
            {GRAVITY_PRESETS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setP((prev) => ({ ...prev, g: g.g }))}
                data-active={Math.abs(p.g - g.g) < 0.05 ? "true" : undefined}
                aria-pressed={Math.abs(p.g - g.g) < 0.05}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
