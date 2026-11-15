import type { SimType } from "./types";

/**
 * Formulas behind the physics and chemistry simulations (SI units).
 * Pure functions, tested in tests/physics.test.ts.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

/* ---------- projectile ---------- */

export function projectile(v0: number, angleDeg: number, h0: number, g: number) {
  const vx = v0 * Math.cos(rad(angleDeg));
  const vy = v0 * Math.sin(rad(angleDeg));
  const flightTime = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  return {
    vx,
    vy,
    flightTime,
    range: vx * flightTime,
    maxHeight: h0 + (vy * vy) / (2 * g),
    peakTime: Math.max(0, vy / g),
    at(t: number) {
      const tt = Math.min(Math.max(t, 0), flightTime);
      return { x: vx * tt, y: Math.max(0, h0 + vy * tt - (g * tt * tt) / 2), vy: vy - g * tt };
    },
  };
}

/* ---------- pendulum ---------- */

export function pendulumPeriod(length: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(length / g);
}

/** One RK4 step of θ'' = −(g/L)·sin θ (works for large swings too). */
export function pendulumStep(theta: number, omega: number, length: number, g: number, dt: number): [number, number] {
  const acc = (th: number) => -(g / length) * Math.sin(th);
  const k1t = omega;
  const k1w = acc(theta);
  const k2t = omega + (dt / 2) * k1w;
  const k2w = acc(theta + (dt / 2) * k1t);
  const k3t = omega + (dt / 2) * k2w;
  const k3w = acc(theta + (dt / 2) * k2t);
  const k4t = omega + dt * k3w;
  const k4w = acc(theta + dt * k3t);
  return [theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)];
}

/* ---------- inclined plane ---------- */

export function incline(mass: number, angleDeg: number, mu: number, g: number) {
  const weight = mass * g;
  const parallel = weight * Math.sin(rad(angleDeg));
  const normal = weight * Math.cos(rad(angleDeg));
  const frictionMax = mu * normal;
  const moves = parallel > frictionMax + 1e-9;
  return {
    weight,
    parallel,
    normal,
    friction: moves ? frictionMax : parallel,
    moves,
    acceleration: moves ? (parallel - frictionMax) / mass : 0,
  };
}

/* ---------- simple circuit ---------- */

export function circuit(voltage: number, resistance: number) {
  const current = voltage / resistance;
  return { current, power: voltage * current };
}

/* ---------- waves ---------- */

export function wave(amplitude: number, frequency: number, wavelength: number) {
  return {
    speed: frequency * wavelength,
    period: 1 / frequency,
    y(x: number, t: number) {
      return amplitude * Math.sin(2 * Math.PI * (x / wavelength - frequency * t));
    },
  };
}

/* ---------- states of matter ---------- */

export type Phase = "solid" | "liquid" | "gas";

export function phaseAt(temperature: number, melt: number, boil: number): Phase {
  if (temperature < melt) return "solid";
  if (temperature < boil) return "liquid";
  return "gas";
}

export const PHASE_FA: Record<Phase, string> = { solid: "جامد", liquid: "مایع", gas: "گاز" };

/* ---------- sliders for each simulation ---------- */

export interface ParamDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

/** Gravity is a small planet switch instead of a slider (fewer controls). */
export const GRAVITY_PRESETS = [
  { label: "زمین", g: 9.8 },
  { label: "مهتاب", g: 1.6 },
  { label: "مشتری", g: 24.8 },
];

/** Experiments that depend on gravity (they get the planet switch). */
export const USES_GRAVITY: SimType[] = ["projectile", "pendulum", "incline"];

export const SIM_PARAMS: Record<SimType, ParamDef[]> = {
  projectile: [
    { key: "v0", label: "سرعت", unit: "m/s", min: 5, max: 50, step: 1, value: 20 },
    { key: "angle", label: "زاویه", unit: "°", min: 5, max: 85, step: 1, value: 45 },
    { key: "h0", label: "ارتفاع", unit: "m", min: 0, max: 30, step: 1, value: 0 },
  ],
  pendulum: [
    { key: "length", label: "طول ریسمان", unit: "m", min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: "amplitude", label: "زاویه", unit: "°", min: 5, max: 70, step: 1, value: 20 },
  ],
  incline: [
    { key: "mass", label: "کتله", unit: "kg", min: 1, max: 20, step: 1, value: 5 },
    { key: "angle", label: "زاویه", unit: "°", min: 5, max: 60, step: 1, value: 30 },
    { key: "mu", label: "اصطکاک (μ)", unit: "", min: 0, max: 1, step: 0.05, value: 0.2 },
  ],
  circuit: [
    { key: "voltage", label: "ولتاژ", unit: "V", min: 1, max: 24, step: 0.5, value: 9 },
    { key: "resistance", label: "مقاومت", unit: "Ω", min: 1, max: 100, step: 1, value: 10 },
  ],
  wave: [
    { key: "amplitude", label: "دامنه", unit: "m", min: 0.1, max: 1, step: 0.05, value: 0.5 },
    { key: "frequency", label: "فریکونسی", unit: "Hz", min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: "wavelength", label: "طول موج", unit: "m", min: 0.5, max: 4, step: 0.1, value: 2 },
  ],
  states: [{ key: "temperature", label: "درجه حرارت", unit: "°C", min: -50, max: 150, step: 1, value: 20 }],
};

export const SIM_TITLES: Record<SimType, string> = {
  projectile: "حرکت پرتابی",
  pendulum: "رقاصک ساده",
  incline: "سطح مایل و اصطکاک",
  circuit: "مدار ساده برقی",
  wave: "موج",
  states: "حالت‌های ماده",
};

/** Slider values: Dana's starting values (clamped to the slider range), else defaults. */
export function initialParams(type: SimType, given: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of SIM_PARAMS[type]) {
    const v = given[def.key];
    out[def.key] = typeof v === "number" && Number.isFinite(v) ? Math.min(def.max, Math.max(def.min, v)) : def.value;
  }
  if (USES_GRAVITY.includes(type)) {
    const g = given.g;
    out.g = typeof g === "number" && Number.isFinite(g) ? Math.min(30, Math.max(0.5, g)) : 9.8;
  }
  return out;
}

/** Widens the temperature slider so both melting and boiling points fit. */
export function temperatureRange(melt: number, boil: number): { min: number; max: number } {
  const span = Math.max(40, boil - melt);
  return {
    min: Math.floor((melt - span * 0.4) / 10) * 10,
    max: Math.ceil((boil + span * 0.4) / 10) * 10,
  };
}
