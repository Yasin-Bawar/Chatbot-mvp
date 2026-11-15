import type { MoleculeAtom } from "./types";

/**
 * Molecules for the 3D viewer: element data, built-in presets and a small
 * VSEPR-style layout. Lone pairs are invisible "balloons" that push the bonds
 * apart, so water comes out bent, ammonia pyramidal and methane tetrahedral.
 * Pure functions (tested in tests/molecules.test.ts).
 */

export type Vec3 = [number, number, number];

export interface ElementInfo {
  name: string; // Dari
  color: string; // CPK colour
  /** Covalent radius in Å (bond lengths). */
  covalent: number;
  /** Ball radius for drawing. */
  ball: number;
  valence: number;
}

export const ELEMENTS: Record<string, ElementInfo> = {
  H: { name: "هایدروجن", color: "#f8fafc", covalent: 0.31, ball: 0.24, valence: 1 },
  He: { name: "هیلیم", color: "#99e9f2", covalent: 0.28, ball: 0.24, valence: 2 },
  Li: { name: "لیتیم", color: "#cc5de8", covalent: 1.28, ball: 0.42, valence: 1 },
  Be: { name: "بریلیم", color: "#c0eb75", covalent: 0.96, ball: 0.36, valence: 2 },
  B: { name: "بورون", color: "#ffa8a8", covalent: 0.84, ball: 0.34, valence: 3 },
  C: { name: "کاربن", color: "#3f3f46", covalent: 0.76, ball: 0.34, valence: 4 },
  N: { name: "نایتروجن", color: "#3b5bdb", covalent: 0.71, ball: 0.33, valence: 5 },
  O: { name: "اکسیجن", color: "#e03131", covalent: 0.66, ball: 0.32, valence: 6 },
  F: { name: "فلورین", color: "#8ce99a", covalent: 0.57, ball: 0.3, valence: 7 },
  Na: { name: "سودیم", color: "#9775fa", covalent: 1.66, ball: 0.42, valence: 1 },
  Mg: { name: "مگنیزیم", color: "#40c057", covalent: 1.41, ball: 0.4, valence: 2 },
  Al: { name: "المونیم", color: "#adb5bd", covalent: 1.21, ball: 0.4, valence: 3 },
  Si: { name: "سلیکان", color: "#f0c38e", covalent: 1.11, ball: 0.4, valence: 4 },
  P: { name: "فاسفورس", color: "#fd7e14", covalent: 1.07, ball: 0.38, valence: 5 },
  S: { name: "سلفر", color: "#fcc419", covalent: 1.05, ball: 0.38, valence: 6 },
  Cl: { name: "کلورین", color: "#2f9e44", covalent: 1.02, ball: 0.4, valence: 7 },
  K: { name: "پتاشیم", color: "#8f5bd6", covalent: 2.03, ball: 0.48, valence: 1 },
  Ca: { name: "کلسیم", color: "#868e96", covalent: 1.76, ball: 0.46, valence: 2 },
  Fe: { name: "آهن", color: "#e8590c", covalent: 1.32, ball: 0.4, valence: 2 },
  Cu: { name: "مس", color: "#d9480f", covalent: 1.32, ball: 0.4, valence: 1 },
  Zn: { name: "جست", color: "#748ffc", covalent: 1.22, ball: 0.4, valence: 2 },
  Br: { name: "برومین", color: "#a52a2a", covalent: 1.2, ball: 0.42, valence: 7 },
  I: { name: "آیودین", color: "#7048e8", covalent: 1.39, ball: 0.46, valence: 7 },
};

const FALLBACK: ElementInfo = { name: "", color: "#ff8cc6", covalent: 0.9, ball: 0.36, valence: 4 };

/** "cl" / "CL" → "Cl"; unknown symbols are kept. */
export function normalizeElement(el: string): string {
  const s = el.trim();
  const fixed = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return ELEMENTS[fixed] ? fixed : s;
}

export function elementInfo(el: string): ElementInfo {
  return ELEMENTS[normalizeElement(el)] ?? { ...FALLBACK, name: el };
}

/** Metals form ions, not shared-electron bonds; they get no lone pairs. */
const METALS = new Set(["Li", "Be", "Na", "Mg", "Al", "K", "Ca", "Fe", "Cu", "Zn"]);

export type Bond = [number, number, number];

export interface Preset {
  title: string;
  formula: string;
  names: string[];
  atoms: MoleculeAtom[];
  bonds: Bond[];
  /** Fixed coordinates (crystals); otherwise the layout is computed. */
  positions?: Vec3[];
  note?: string;
}

const a = (...els: string[]): MoleculeAtom[] => els.map((el) => ({ el }));

function saltCrystal(): { atoms: MoleculeAtom[]; bonds: Bond[]; positions: Vec3[] } {
  const atoms: MoleculeAtom[] = [];
  const positions: Vec3[] = [];
  const index = new Map<string, number>();
  const n = 3;
  const d = 2.4;
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        index.set(`${x},${y},${z}`, atoms.length);
        atoms.push({ el: (x + y + z) % 2 === 0 ? "Na" : "Cl" });
        positions.push([(x - 1) * d, (y - 1) * d, (z - 1) * d]);
      }
  const bonds: Bond[] = [];
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        const i = index.get(`${x},${y},${z}`)!;
        for (const [dx, dy, dz] of [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]) {
          const j = index.get(`${x + dx},${y + dy},${z + dz}`);
          if (j !== undefined) bonds.push([i, j, 1]);
        }
      }
  return { atoms, bonds, positions };
}

export const PRESETS: Record<string, Preset> = {
  water: {
    title: "مولکول آب",
    formula: "H_2O",
    names: ["water", "h2o", "آب", "اب"],
    atoms: a("O", "H", "H"),
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
    ],
    note: "دو جفت الکترون آزاد اکسیجن، هایدروجن‌ها را به پایین فشار می‌دهند؛ برای همین مولکول آب خمیده است (حدود ۱۰۴٫۵ درجه).",
  },
  "carbon-dioxide": {
    title: "کاربن دای‌اکساید",
    formula: "CO_2",
    names: ["carbon dioxide", "co2", "کاربن دای اکساید", "کاربن دای‌اکساید", "دی اکسید کربن", "گاز کاربنیک"],
    atoms: a("C", "O", "O"),
    bonds: [
      [0, 1, 2],
      [0, 2, 2],
    ],
    note: "کاربن با هر اکسیجن پیوند دوگانه دارد و جفت الکترون آزاد ندارد؛ پس مولکول خطی است (۱۸۰ درجه).",
  },
  methane: {
    title: "میتان",
    formula: "CH_4",
    names: ["methane", "ch4", "میتان", "متان"],
    atoms: a("C", "H", "H", "H", "H"),
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
    ],
    note: "چهار پیوند کاربن تا جای ممکن از هم دور می‌شوند و شکل چهاروجهی (تتراهیدرال) می‌سازند؛ زاویه ۱۰۹٫۵ درجه.",
  },
  ammonia: {
    title: "امونیا",
    formula: "NH_3",
    names: ["ammonia", "nh3", "امونیا", "آمونیاک", "امونیاک"],
    atoms: a("N", "H", "H", "H"),
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
    ],
    note: "یک جفت الکترون آزاد بالای نایتروجن است؛ برای همین امونیا شکل هرمی دارد (حدود ۱۰۷ درجه).",
  },
  oxygen: {
    title: "مولکول اکسیجن",
    formula: "O_2",
    names: ["oxygen", "o2", "اکسیجن", "اکسیژن"],
    atoms: a("O", "O"),
    bonds: [[0, 1, 2]],
  },
  nitrogen: {
    title: "مولکول نایتروجن",
    formula: "N_2",
    names: ["nitrogen", "n2", "نایتروجن", "نیتروژن"],
    atoms: a("N", "N"),
    bonds: [[0, 1, 3]],
    note: "پیوند سه‌گانه بسیار محکم است؛ برای همین نایتروجن هوا به‌آسانی واکنش نمی‌کند.",
  },
  hydrogen: {
    title: "مولکول هایدروجن",
    formula: "H_2",
    names: ["hydrogen", "h2", "هایدروجن", "هیدروژن"],
    atoms: a("H", "H"),
    bonds: [[0, 1, 1]],
  },
  "hydrogen-chloride": {
    title: "هایدروجن کلوراید",
    formula: "HCl",
    names: ["hydrogen chloride", "hcl", "هایدروجن کلوراید", "تیزاب نمک", "اسید کلریدریک", "hydrochloric acid"],
    atoms: a("Cl", "H"),
    bonds: [[0, 1, 1]],
  },
  ethanol: {
    title: "ایتانول (الکول)",
    formula: "C_2H_5OH",
    names: ["ethanol", "c2h5oh", "ایتانول", "اتانول", "الکول", "alcohol"],
    atoms: a("C", "C", "O", "H", "H", "H", "H", "H", "H"),
    bonds: [
      [0, 1, 1],
      [1, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
      [0, 5, 1],
      [1, 6, 1],
      [1, 7, 1],
      [2, 8, 1],
    ],
  },
  ethene: {
    title: "ایتلین",
    formula: "C_2H_4",
    names: ["ethene", "ethylene", "c2h4", "ایتلین", "اتیلن", "ایتن"],
    atoms: a("C", "C", "H", "H", "H", "H"),
    bonds: [
      [0, 1, 2],
      [0, 2, 1],
      [0, 3, 1],
      [1, 4, 1],
      [1, 5, 1],
    ],
    note: "پیوند دوگانه نمی‌گذارد مولکول بچرخد؛ همه اتوم‌ها در یک سطح هستند (۱۲۰ درجه).",
  },
  ethyne: {
    title: "استیلین",
    formula: "C_2H_2",
    names: ["ethyne", "acetylene", "c2h2", "استیلین", "اتین"],
    atoms: a("C", "C", "H", "H"),
    bonds: [
      [0, 1, 3],
      [0, 2, 1],
      [1, 3, 1],
    ],
  },
  benzene: {
    title: "بنزین (حلقه بنزن)",
    formula: "C_6H_6",
    names: ["benzene", "c6h6", "بنزن", "بنزین حلقوی"],
    atoms: a("C", "C", "C", "C", "C", "C", "H", "H", "H", "H", "H", "H"),
    bonds: [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 0, 1],
      [0, 6, 1],
      [1, 7, 1],
      [2, 8, 1],
      [3, 9, 1],
      [4, 10, 1],
      [5, 11, 1],
    ],
    note: "شش کاربن یک حلقه مسطح شش‌ضلعی می‌سازند.",
  },
  "sodium-chloride": {
    title: "بلور نمک طعام",
    formula: "NaCl",
    names: ["sodium chloride", "nacl", "salt", "نمک", "نمک طعام", "سودیم کلوراید", "کلرید سدیم"],
    ...saltCrystal(),
    note: "در بلور نمک، هر یون سودیم با شش یون کلورین احاطه شده است (پیوند آیونی).",
  },
};

/** Finds a preset by key, English name, formula or Dari name. */
export function findPreset(name: string | undefined): (Preset & { key: string }) | null {
  if (!name) return null;
  const k = name
    .trim()
    .toLowerCase()
    .replace(/[_\s‌]+/g, " ")
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (key === k.replace(/ /g, "-") || preset.names.includes(k)) return { ...preset, key };
  }
  return null;
}

/* ---------------- layout ---------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const len = (p: Vec3) => Math.sqrt(dot(p, p)) || 1e-9;
const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

export function bondLength(elA: string, elB: string, order = 1): number {
  const base = elementInfo(elA).covalent + elementInfo(elB).covalent;
  return base * (order >= 3 ? 0.78 : order === 2 ? 0.87 : 1);
}

/** Lone pairs that shape the geometry around an atom (only for atoms with 2+ neighbours). */
export function lonePairs(atom: MoleculeAtom, bondOrderSum: number, degree: number): number {
  const el = normalizeElement(atom.el);
  if (degree < 2 || el === "H" || METALS.has(el)) return 0;
  const info = ELEMENTS[el];
  if (!info) return 0;
  return Math.max(0, Math.floor((info.valence - (atom.charge ?? 0) - bondOrderSum) / 2));
}

/**
 * 3D coordinates (Å, centred) for atoms and bonds, from a force layout:
 * bonds are springs, electron domains around each atom repel each other,
 * and double bonds keep their neighbours in one plane.
 */
export function layoutMolecule(atoms: MoleculeAtom[], bonds: Bond[], seed = 7): Vec3[] {
  const n = atoms.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 0]];

  const neighbors: number[][] = atoms.map(() => []);
  const orderSum = atoms.map(() => 0);
  for (const [i, j, order] of bonds) {
    if (i === j || i >= n || j >= n) continue;
    neighbors[i].push(j);
    neighbors[j].push(i);
    orderSum[i] += order;
    orderSum[j] += order;
  }

  // Nodes = atoms, then lone pairs.
  const parentOf: number[] = [];
  const domains: number[][] = neighbors.map((list) => [...list]);
  let total = n;
  atoms.forEach((atom, i) => {
    const lp = lonePairs(atom, orderSum[i], neighbors[i].length);
    for (let k = 0; k < lp; k++) {
      parentOf[total] = i;
      domains[i].push(total);
      total++;
    }
  });
  const isLp = (k: number) => k >= n;

  // Initial placement: a stress layout on graph distances unfolds chains and
  // rings (a ring starts as a circle, not a tangle). Lone pairs go next to their atom.
  const rand = mulberry32(seed);
  const pos: Vec3[] = Array.from({ length: total }, () => [0, 0, 0] as Vec3);
  const hops: number[][] = atoms.map((_, s0) => {
    const dist = new Array(n).fill(Infinity);
    dist[s0] = 0;
    const queue = [s0];
    while (queue.length) {
      const c = queue.shift()!;
      for (const k of neighbors[c]) {
        if (dist[k] === Infinity) {
          dist[k] = dist[c] + 1;
          queue.push(k);
        }
      }
    }
    return dist;
  });
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 0.6 * n;
    pos[i] = [r * Math.cos(t), r * Math.sin(t), (rand() - 0.5) * 0.1];
  }
  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < n; i++) {
      const next: Vec3 = [0, 0, 0];
      let wsum = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const h = hops[i][j];
        const target = (h === Infinity ? n + 2 : h) * 1.25;
        const w = 1 / (target * target);
        const d = sub(pos[i], pos[j]);
        const l = len(d);
        next[0] += w * (pos[j][0] + (target * d[0]) / l);
        next[1] += w * (pos[j][1] + (target * d[1]) / l);
        next[2] += w * (pos[j][2] + (target * d[2]) / l);
        wsum += w;
      }
      if (wsum > 0) pos[i] = [next[0] / wsum, next[1] / wsum, next[2] / wsum];
    }
  }
  for (let k = n; k < total; k++) {
    const p = pos[parentOf[k]];
    const z = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    pos[k] = [p[0] + r * Math.cos(t) * 0.6, p[1] + r * Math.sin(t) * 0.6, p[2] + z * 0.6];
  }

  const springs: [number, number, number][] = [];
  for (const [i, j, order] of bonds) {
    if (i === j || i >= n || j >= n) continue;
    springs.push([i, j, bondLength(atoms[i].el, atoms[j].el, order)]);
  }
  for (let k = n; k < total; k++) springs.push([parentOf[k], k, 0.6]);

  // Bonds between sp2 atoms (3 domains, part of a double bond) keep their
  // neighbours in one plane: ethene is flat, a benzene ring is flat.
  const hasDouble = atoms.map(() => false);
  for (const [i, j, order] of bonds) if (order === 2 && i < n && j < n) hasDouble[i] = hasDouble[j] = true;
  const sp2 = (k: number) => domains[k]?.length === 3 && hasDouble[k];
  const planar: [number, number][] = [];
  for (const [i, j] of bonds) {
    if (i < n && j < n && i !== j && sp2(i) && sp2(j)) planar.push([i, j], [j, i]);
  }

  // Pairs whose distance is set by bonds and angles (1-2 and 1-3) are not pushed apart.
  const bonded = new Set<string>();
  for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) if (hops[p][q] <= 2) bonded.add(`${p}-${q}`);
  const force: Vec3[] = pos.map(() => [0, 0, 0]);
  const addF = (k: number, v: Vec3, s: number) => {
    force[k][0] += v[0] * s;
    force[k][1] += v[1] * s;
    force[k][2] += v[2] * s;
  };

  const STEPS = n <= 24 ? 2500 : 1200;
  for (let step = 0; step < STEPS; step++) {
    for (const f of force) f[0] = f[1] = f[2] = 0;

    // Springs.
    for (const [i, j, L] of springs) {
      const d = sub(pos[j], pos[i]);
      const dist = len(d);
      const s = (dist - L) / dist;
      addF(i, d, s * 0.5);
      addF(j, d, -s * 0.5);
    }

    // Electron domains around each atom repel (angular, as on a sphere).
    for (let c = 0; c < n; c++) {
      const list = domains[c];
      if (list.length < 2) continue;
      const units = list.map((k) => {
        const d = sub(pos[k], pos[c]);
        const l = len(d);
        return { k, u: [d[0] / l, d[1] / l, d[2] / l] as Vec3, l };
      });
      for (let x = 0; x < units.length; x++) {
        for (let y = x + 1; y < units.length; y++) {
          const A = units[x];
          const B = units[y];
          const diff = sub(A.u, B.u);
          const d2 = Math.max(0.02, dot(diff, diff));
          const strength = (isLp(A.k) && isLp(B.k) ? 1.3 : isLp(A.k) || isLp(B.k) ? 1.15 : 1) * 0.12;
          const s = strength / d2;
          // Tangential push for A (away from B) and B (away from A).
          const ta = sub(diff, [A.u[0] * dot(diff, A.u), A.u[1] * dot(diff, A.u), A.u[2] * dot(diff, A.u)]);
          const nd: Vec3 = [-diff[0], -diff[1], -diff[2]];
          const tb = sub(nd, [B.u[0] * dot(nd, B.u), B.u[1] * dot(nd, B.u), B.u[2] * dot(nd, B.u)]);
          addF(A.k, ta, s * A.l);
          addF(B.k, tb, s * B.l);
          // Equal and opposite push on the centre atom (no net twist).
          addF(c, ta, -s * A.l);
          addF(c, tb, -s * B.l);
        }
      }
    }

    // Coplanar substituents around double bonds.
    for (const [i, j] of planar) {
      const ref = domains[i].find((k) => k !== j);
      if (ref === undefined) continue;
      const normal = cross(sub(pos[j], pos[i]), sub(pos[ref], pos[i]));
      const nl = len(normal);
      if (nl < 1e-6) continue;
      const nu: Vec3 = [normal[0] / nl, normal[1] / nl, normal[2] / nl];
      for (const k of domains[j]) {
        if (k === i) continue;
        const off = dot(sub(pos[k], pos[i]), nu);
        addF(k, nu, -off * 0.3);
      }
    }

    // Atoms that are not bonded keep some distance (bigger molecules).
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (bonded.has(`${p}-${q}`)) continue;
        const d = sub(pos[q], pos[p]);
        const dist = len(d);
        if (dist > 3) continue;
        const s = 0.02 / (dist * dist * dist);
        addF(p, d, -s);
        addF(q, d, s);
      }
    }

    const rate = step < STEPS * 0.6 ? 0.5 : 0.25;
    for (let k = 0; k < total; k++) {
      pos[k][0] += force[k][0] * rate;
      pos[k][1] += force[k][1] * rate;
      pos[k][2] += force[k][2] * rate;
    }
  }

  // Centre on the atoms (lone pairs are dropped).
  const atomsPos = pos.slice(0, n);
  const centre = atomsPos.reduce<Vec3>((acc, p) => [acc[0] + p[0] / n, acc[1] + p[1] / n, acc[2] + p[2] / n], [0, 0, 0]);
  return atomsPos.map((p) => sub(p, centre));
}

/** Angle in degrees at atom b for atoms a-b-c. */
export function bondAngle(pos: Vec3[], a: number, b: number, c: number): number {
  const u = sub(pos[a], pos[b]);
  const v = sub(pos[c], pos[b]);
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180) / Math.PI;
}

/** Hill-style formula with subscripts in LaTeX, e.g. "C_2H_6O". */
export function formulaOf(atoms: MoleculeAtom[]): string {
  const counts = new Map<string, number>();
  for (const atom of atoms) {
    const el = normalizeElement(atom.el);
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  const order = [...counts.keys()].sort((x, y) => {
    const rank = (e: string) => (e === "C" ? 0 : e === "H" ? 1 : 2);
    return rank(x) - rank(y) || x.localeCompare(y);
  });
  return order.map((el) => `${el}${counts.get(el)! > 1 ? `_${counts.get(el)}` : ""}`).join("");
}

export interface BuiltMolecule {
  title: string;
  formula: string;
  atoms: { el: string; pos: Vec3 }[];
  bonds: Bond[];
  note?: string;
  crystal: boolean;
}

/** Resolves a molecule spec (preset or custom atoms/bonds) to drawable atoms. */
export function buildMolecule(spec: {
  preset?: string;
  title?: string;
  formula?: string;
  atoms?: MoleculeAtom[];
  bonds?: Bond[];
}): BuiltMolecule | null {
  const preset = findPreset(spec.preset) ?? (spec.atoms?.length ? null : (findPreset(spec.title) ?? findPreset(spec.formula)));
  const atoms = preset?.atoms ?? spec.atoms ?? [];
  const bonds = (preset?.bonds ?? spec.bonds ?? []).filter(
    ([i, j]) => Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < atoms.length && j < atoms.length && i !== j,
  );
  if (!atoms.length || atoms.length > 80) return null;
  const positions = preset?.positions ?? layoutMolecule(atoms, bonds);
  return {
    title: spec.title || preset?.title || "مولکول",
    formula: spec.formula || preset?.formula || formulaOf(atoms),
    atoms: atoms.map((atom, i) => ({ el: normalizeElement(atom.el), pos: positions[i] })),
    bonds,
    note: preset?.note,
    crystal: Boolean(preset?.positions),
  };
}
