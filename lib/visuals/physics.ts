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

/* ---------- free fall (with and without air) ---------- */

export function freeFall(height: number, g: number) {
  const time = Math.sqrt((2 * height) / g);
  return { time, speed: g * time };
}

/**
 * Falling with air resistance (quadratic drag): the object speeds up towards a
 * terminal speed. A feather has a terminal speed of about 1 m/s, a ball ~30 m/s.
 */
export function fallWithAir(height: number, g: number, terminal: number) {
  const time = (terminal / g) * Math.acosh(Math.exp((g * height) / (terminal * terminal)));
  return {
    time,
    speed: terminal * Math.tanh((g * time) / terminal),
    /** Distance fallen after t seconds. */
    distance(t: number) {
      return ((terminal * terminal) / g) * Math.log(Math.cosh((g * Math.min(t, time)) / terminal));
    },
  };
}

/* ---------- spring (simple harmonic motion) ---------- */

export function spring(k: number, mass: number, amplitude: number) {
  const omega = Math.sqrt(k / mass);
  return {
    period: (2 * Math.PI) / omega,
    maxSpeed: amplitude * omega,
    energy: 0.5 * k * amplitude * amplitude,
    position(t: number) {
      return amplitude * Math.cos(omega * t);
    },
  };
}

/* ---------- collisions ---------- */

/** 1D collision. e = 1 is elastic (bounce), e = 0 sticks together. */
export function collision(m1: number, m2: number, v1: number, v2: number, e: number) {
  const total = m1 + m2;
  const after1 = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / total;
  const after2 = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / total;
  return {
    after1,
    after2,
    momentum: m1 * v1 + m2 * v2,
    energyBefore: 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2,
    energyAfter: 0.5 * m1 * after1 * after1 + 0.5 * m2 * after2 * after2,
  };
}

/* ---------- convex lens ---------- */

/** Thin convex lens, distances positive on the real side: 1/f = 1/u + 1/v. */
export function lens(focal: number, objectDistance: number) {
  if (Math.abs(objectDistance - focal) < 1e-9) {
    return { image: Infinity, magnification: Infinity, real: false, atInfinity: true };
  }
  const image = (objectDistance * focal) / (objectDistance - focal);
  return { image, magnification: -image / objectDistance, real: image > 0, atInfinity: false };
}

/* ---------- refraction ---------- */

/** Snell's law n1·sin θ1 = n2·sin θ2; null angle means total internal reflection. */
export function refraction(n1: number, n2: number, angleDeg: number) {
  const s = (n1 * Math.sin(rad(angleDeg))) / n2;
  const critical = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
  return { angle: Math.abs(s) > 1 ? null : (Math.asin(s) * 180) / Math.PI, critical, totalReflection: Math.abs(s) > 1 };
}

/** Dari name of a material from its refractive index. */
export function materialName(n: number): string {
  if (n < 1.15) return "هوا";
  if (n < 1.42) return "آب";
  if (n < 1.7) return "شیشه";
  if (n < 2.2) return "یاقوت";
  return "الماس";
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
  /** A two-state switch instead of a slider: labels for 0 and 1. */
  options?: [string, string];
}

/** Gravity is a small planet switch instead of a slider (fewer controls). */
export const GRAVITY_PRESETS = [
  { label: "زمین", g: 9.8 },
  { label: "مهتاب", g: 1.6 },
  { label: "مشتری", g: 24.8 },
];

/** Experiments that depend on gravity (they get the planet switch). */
export const USES_GRAVITY: SimType[] = ["projectile", "pendulum", "incline", "freefall"];

/** Experiments that belong to chemistry (the rest are physics). */
export const CHEMISTRY_SIMS: SimType[] = ["states", "atom", "reaction", "ph", "gas"];

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
  freefall: [
    { key: "height", label: "ارتفاع", unit: "m", min: 2, max: 100, step: 1, value: 20 },
    { key: "air", label: "هوا", unit: "", min: 0, max: 1, step: 1, value: 1, options: ["بدون هوا", "با هوا"] },
  ],
  spring: [
    { key: "k", label: "سختی فنر", unit: "N/m", min: 5, max: 100, step: 1, value: 20 },
    { key: "mass", label: "کتله", unit: "kg", min: 0.2, max: 5, step: 0.1, value: 1 },
    { key: "amplitude", label: "کشش", unit: "m", min: 0.05, max: 0.5, step: 0.01, value: 0.2 },
  ],
  collision: [
    { key: "m1", label: "کتله ۱", unit: "kg", min: 1, max: 10, step: 0.5, value: 2 },
    { key: "m2", label: "کتله ۲", unit: "kg", min: 1, max: 10, step: 0.5, value: 2 },
    { key: "v1", label: "سرعت ۱", unit: "m/s", min: 1, max: 10, step: 0.5, value: 4 },
    { key: "elastic", label: "نوع", unit: "", min: 0, max: 1, step: 1, value: 1, options: ["چسپنده", "ارتجاعی"] },
  ],
  lens: [
    { key: "focal", label: "فاصله محراق", unit: "cm", min: 5, max: 25, step: 1, value: 10 },
    { key: "object", label: "فاصله جسم", unit: "cm", min: 3, max: 60, step: 1, value: 25 },
  ],
  refraction: [
    { key: "angle", label: "زاویه تابش", unit: "°", min: 0, max: 89, step: 1, value: 40 },
    { key: "n1", label: "محیط ۱", unit: "", min: 1, max: 2.4, step: 0.01, value: 1 },
    { key: "n2", label: "محیط ۲", unit: "", min: 1, max: 2.4, step: 0.01, value: 1.5 },
  ],
  atom: [{ key: "z", label: "عدد اتومی", unit: "", min: 1, max: 20, step: 1, value: 6 }],
  reaction: [],
  ph: [{ key: "ph", label: "pH", unit: "", min: 0, max: 14, step: 0.1, value: 7 }],
  gas: [
    { key: "temperature", label: "درجه حرارت", unit: "°C", min: -50, max: 300, step: 5, value: 27 },
    { key: "volume", label: "حجم", unit: "L", min: 0.3, max: 2, step: 0.05, value: 1 },
  ],
};

export const SIM_TITLES: Record<SimType, string> = {
  projectile: "حرکت پرتابی",
  pendulum: "رقاصک ساده",
  incline: "سطح مایل و اصطکاک",
  circuit: "مدار ساده برقی",
  wave: "موج",
  states: "حالت‌های ماده",
  freefall: "سقوط آزاد",
  spring: "فنر و نوسان",
  collision: "تصادم و مومنتم",
  lens: "عدسیه محدب",
  refraction: "انکسار نور",
  atom: "ساختمان اتوم",
  reaction: "تعامل کیمیاوی",
  ph: "تیزاب و قلوی (pH)",
  gas: "قانون گازها",
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
