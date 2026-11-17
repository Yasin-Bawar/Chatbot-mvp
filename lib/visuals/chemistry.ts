/**
 * Logic behind the chemistry experiments: Bohr atoms, chemical formulas and
 * equations, pH and the gas law. Pure functions - tested in tests/chemistry.test.ts.
 */

/** The first 20 elements (school chemistry), with their most common mass number. */
export const FIRST_20: { z: number; symbol: string; name: string; mass: number }[] = [
  { z: 1, symbol: "H", name: "هایدروجن", mass: 1 },
  { z: 2, symbol: "He", name: "هیلیم", mass: 4 },
  { z: 3, symbol: "Li", name: "لیتیم", mass: 7 },
  { z: 4, symbol: "Be", name: "بریلیم", mass: 9 },
  { z: 5, symbol: "B", name: "بورون", mass: 11 },
  { z: 6, symbol: "C", name: "کاربن", mass: 12 },
  { z: 7, symbol: "N", name: "نایتروجن", mass: 14 },
  { z: 8, symbol: "O", name: "اکسیجن", mass: 16 },
  { z: 9, symbol: "F", name: "فلورین", mass: 19 },
  { z: 10, symbol: "Ne", name: "نیون", mass: 20 },
  { z: 11, symbol: "Na", name: "سودیم", mass: 23 },
  { z: 12, symbol: "Mg", name: "مگنیزیم", mass: 24 },
  { z: 13, symbol: "Al", name: "المونیم", mass: 27 },
  { z: 14, symbol: "Si", name: "سلیکان", mass: 28 },
  { z: 15, symbol: "P", name: "فاسفورس", mass: 31 },
  { z: 16, symbol: "S", name: "سلفر", mass: 32 },
  { z: 17, symbol: "Cl", name: "کلورین", mass: 35 },
  { z: 18, symbol: "Ar", name: "ارگون", mass: 40 },
  { z: 19, symbol: "K", name: "پتاشیم", mass: 39 },
  { z: 20, symbol: "Ca", name: "کلسیم", mass: 40 },
];

/** Atomic number from a symbol ("na"), a Dari name ("سودیم") or a number. */
export function elementZ(value: string | number | undefined): number | null {
  if (typeof value === "number") return value >= 1 && value <= 20 ? Math.round(value) : null;
  if (!value) return null;
  const v = value.trim();
  const found = FIRST_20.find((e) => e.symbol.toLowerCase() === v.toLowerCase() || e.name === v);
  return found?.z ?? null;
}

/** Electrons per shell in the simple (Bohr) school model: 2, 8, 8, 2. */
export function bohrShells(z: number): number[] {
  const capacity = [2, 8, 8, 2];
  const shells: number[] = [];
  let left = Math.max(0, Math.min(20, Math.round(z)));
  for (const cap of capacity) {
    if (left <= 0) break;
    const n = Math.min(cap, left);
    shells.push(n);
    left -= n;
  }
  return shells;
}

export type AtomCounts = Record<string, number>;

/** Counts atoms in a formula such as "H2O", "Ca(OH)2" or "C6H12O6". Returns null if it can't be read. */
export function parseFormula(formula: string): AtomCounts | null {
  const s = formula.replace(/\s+/g, "").replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  if (!s || /[^A-Za-z0-9()[\]]/.test(s)) return null;
  let i = 0;
  const readNumber = () => {
    let n = "";
    while (i < s.length && /\d/.test(s[i])) n += s[i++];
    return n ? Number(n) : 1;
  };
  const readGroup = (close: string | null): AtomCounts | null => {
    const counts: AtomCounts = {};
    while (i < s.length) {
      const c = s[i];
      if (c === "(" || c === "[") {
        i++;
        const inner = readGroup(c === "(" ? ")" : "]");
        if (!inner) return null;
        const k = readNumber();
        for (const [el, n] of Object.entries(inner)) counts[el] = (counts[el] ?? 0) + n * k;
      } else if (c === ")" || c === "]") {
        if (c !== close) return null;
        i++;
        return counts;
      } else if (/[A-Z]/.test(c)) {
        let el = c;
        i++;
        if (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
        const k = readNumber();
        counts[el] = (counts[el] ?? 0) + k;
      } else return null;
    }
    return close ? null : counts;
  };
  const result = readGroup(null);
  return result && Object.keys(result).length ? result : null;
}

export interface Term {
  coef: number;
  formula: string;
  atoms: AtomCounts;
}

export interface Equation {
  reactants: Term[];
  products: Term[];
  balanced: boolean;
}

function parseSide(side: string): Term[] | null {
  const terms: Term[] = [];
  for (const raw of side.split("+")) {
    // State symbols like (aq) or (s) are allowed and ignored.
    const m = raw
      .replace(/\s*\((?:s|l|g|aq)\)/g, "")
      .trim()
      .match(/^(\d*)\s*([A-Za-z0-9()[\]₀-₉]+)$/);
    if (!m) return null;
    const atoms = parseFormula(m[2]);
    if (!atoms) return null;
    terms.push({ coef: m[1] ? Number(m[1]) : 1, formula: m[2], atoms });
  }
  return terms.length ? terms : null;
}

export function totalAtoms(terms: Term[]): AtomCounts {
  const out: AtomCounts = {};
  for (const t of terms) for (const [el, n] of Object.entries(t.atoms)) out[el] = (out[el] ?? 0) + n * t.coef;
  return out;
}

/** Reads "2H2 + O2 -> 2H2O" (arrows: ->, →, =, ⟶) and checks that atoms balance. */
export function parseEquation(text: string): Equation | null {
  const parts = text.split(/\s*(?:->|→|⟶|=>|=)\s*/);
  if (parts.length !== 2) return null;
  const reactants = parseSide(parts[0]);
  const products = parseSide(parts[1]);
  if (!reactants || !products) return null;
  const a = totalAtoms(reactants);
  const b = totalAtoms(products);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const balanced = [...keys].every((k) => a[k] === b[k]);
  return { reactants, products, balanced };
}

/** Well-known reactions by name (English or Dari) - used when Dana gives a name instead of an equation. */
export const REACTIONS: Record<string, string> = {
  water: "2H2 + O2 -> 2H2O",
  "تشکیل آب": "2H2 + O2 -> 2H2O",
  methane: "CH4 + 2O2 -> CO2 + 2H2O",
  combustion: "CH4 + 2O2 -> CO2 + 2H2O",
  "سوختن میتان": "CH4 + 2O2 -> CO2 + 2H2O",
  salt: "2Na + Cl2 -> 2NaCl",
  "نمک طعام": "2Na + Cl2 -> 2NaCl",
  ammonia: "N2 + 3H2 -> 2NH3",
  امونیا: "N2 + 3H2 -> 2NH3",
  rust: "4Fe + 3O2 -> 2Fe2O3",
  "زنگ زدن آهن": "4Fe + 3O2 -> 2Fe2O3",
  neutralization: "HCl + NaOH -> NaCl + H2O",
  خنثی‌سازی: "HCl + NaOH -> NaCl + H2O",
  photosynthesis: "6CO2 + 6H2O -> C6H12O6 + 6O2",
  فتوسنتز: "6CO2 + 6H2O -> C6H12O6 + 6O2",
};

/* ---------- pH ---------- */

export type PhKind = "acid" | "neutral" | "base";

export function phKind(ph: number): PhKind {
  if (ph < 6.5) return "acid";
  if (ph <= 7.5) return "neutral";
  return "base";
}

export const PH_KIND_FA: Record<PhKind, string> = { acid: "تیزابی", neutral: "خنثی", base: "قلوی" };

/** Universal indicator colour for a pH value (red → green → purple). */
export function phColor(ph: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [220, 38, 38]],
    [2, [239, 68, 68]],
    [4, [249, 115, 22]],
    [5.5, [234, 179, 8]],
    [7, [34, 197, 94]],
    [8.5, [20, 184, 166]],
    [10, [59, 130, 246]],
    [12, [99, 102, 241]],
    [14, [126, 34, 206]],
  ];
  const x = Math.max(0, Math.min(14, ph));
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (x <= p1) {
      const t = (x - p0) / (p1 - p0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return "rgb(126, 34, 206)";
}

/** Everyday substances on the pH scale (approximate values). */
export const PH_EXAMPLES: { ph: number; name: string }[] = [
  { ph: 1, name: "تیزاب معده" },
  { ph: 2, name: "آب لیمو" },
  { ph: 3, name: "سرکه" },
  { ph: 4.5, name: "رومی" },
  { ph: 6.5, name: "شیر" },
  { ph: 7, name: "آب خالص" },
  { ph: 7.4, name: "خون" },
  { ph: 9, name: "سودا" },
  { ph: 10, name: "صابون" },
  { ph: 11.5, name: "امونیا" },
  { ph: 13, name: "سفیدکننده" },
];

/* ---------- gases ---------- */

/**
 * Pressure of a fixed amount of gas (ideal gas law, P·V/T constant), scaled so
 * that 1 litre at 27 °C is 100 kPa.
 */
export function gasPressure(temperatureC: number, volumeL: number): number {
  const kelvin = temperatureC + 273.15;
  return (100 * (kelvin / 300.15)) / volumeL;
}
