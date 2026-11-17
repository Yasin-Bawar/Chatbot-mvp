import { describe, expect, it } from "vitest";
import {
  bohrShells,
  elementZ,
  FIRST_20,
  gasPressure,
  parseEquation,
  parseFormula,
  phColor,
  phKind,
  REACTIONS,
} from "@/lib/visuals/chemistry";
import { collision, fallWithAir, freeFall, lens, refraction, spring } from "@/lib/visuals/physics";
import { equationText, subscript } from "@/components/visuals/sims/Reaction";

describe("chemistry helpers", () => {
  it("fills Bohr shells 2-8-8-2", () => {
    expect(bohrShells(1)).toEqual([1]);
    expect(bohrShells(6)).toEqual([2, 4]);
    expect(bohrShells(11)).toEqual([2, 8, 1]);
    expect(bohrShells(18)).toEqual([2, 8, 8]);
    expect(bohrShells(20)).toEqual([2, 8, 8, 2]);
    for (const e of FIRST_20) expect(bohrShells(e.z).reduce((a, b) => a + b, 0)).toBe(e.z);
  });

  it("finds elements by symbol, Dari name or number", () => {
    expect(elementZ("Na")).toBe(11);
    expect(elementZ("cl")).toBe(17);
    expect(elementZ("اکسیجن")).toBe(8);
    expect(elementZ(20)).toBe(20);
    expect(elementZ("Fe")).toBeNull();
    expect(elementZ(30)).toBeNull();
  });

  it("counts atoms in formulas", () => {
    expect(parseFormula("H2O")).toEqual({ H: 2, O: 1 });
    expect(parseFormula("Ca(OH)2")).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula("C6H12O6")).toEqual({ C: 6, H: 12, O: 6 });
    expect(parseFormula("H₂SO₄")).toEqual({ H: 2, S: 1, O: 4 });
    expect(parseFormula("Al2(SO4)3")).toEqual({ Al: 2, S: 3, O: 12 });
    expect(parseFormula("H2O)")).toBeNull();
    expect(parseFormula("water")).toBeNull();
  });

  it("checks that equations balance", () => {
    const water = parseEquation("2H2 + O2 -> 2H2O")!;
    expect(water.balanced).toBe(true);
    expect(water.reactants.map((t) => t.coef)).toEqual([2, 1]);
    expect(parseEquation("H2 + O2 → H2O")!.balanced).toBe(false);
    expect(parseEquation("CH4 + 2O2 = CO2 + 2H2O")!.balanced).toBe(true);
    expect(parseEquation("NaCl(aq) + AgNO3(aq) -> AgCl(s) + NaNO3(aq)")!.balanced).toBe(true);
    expect(parseEquation("nonsense")).toBeNull();
    for (const eq of Object.values(REACTIONS)) expect(parseEquation(eq)?.balanced).toBe(true);
  });

  it("writes equations with subscripts", () => {
    expect(subscript("C6H12O6")).toBe("C₆H₁₂O₆");
    expect(subscript("Ca(OH)2")).toBe("Ca(OH)₂");
    expect(equationText(parseEquation("2H2 + O2 -> 2H2O")!)).toBe("2H₂ + O₂  →  2H₂O");
  });

  it("classifies pH and colours it", () => {
    expect(phKind(2)).toBe("acid");
    expect(phKind(7)).toBe("neutral");
    expect(phKind(12)).toBe("base");
    expect(phColor(0)).toBe("rgb(220, 38, 38)");
    expect(phColor(14)).toBe("rgb(126, 34, 206)");
    expect(phColor(-3)).toBe(phColor(0));
  });

  it("follows the gas laws", () => {
    expect(gasPressure(27, 1)).toBeCloseTo(100, 6);
    // Boyle: half the volume, twice the pressure.
    expect(gasPressure(27, 0.5)).toBeCloseTo(200, 6);
    // Charles/Gay-Lussac: twice the kelvin temperature, twice the pressure.
    expect(gasPressure(327.15, 1)).toBeCloseTo(200, 6);
  });
});

describe("more physics", () => {
  it("free fall without air", () => {
    const f = freeFall(20, 9.8);
    expect(f.time).toBeCloseTo(Math.sqrt(40 / 9.8), 6);
    expect(f.speed).toBeCloseTo(Math.sqrt(2 * 9.8 * 20), 6);
  });

  it("air slows a feather far more than a ball", () => {
    const ball = fallWithAir(20, 9.8, 30);
    const feather = fallWithAir(20, 9.8, 1.6);
    expect(ball.time).toBeGreaterThan(freeFall(20, 9.8).time);
    expect(ball.time).toBeLessThan(freeFall(20, 9.8).time * 1.1);
    expect(feather.time).toBeGreaterThan(10);
    expect(feather.speed).toBeLessThanOrEqual(1.6);
    expect(ball.distance(ball.time)).toBeCloseTo(20, 4);
  });

  it("spring period T = 2π√(m/k)", () => {
    const s = spring(20, 1, 0.2);
    expect(s.period).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 20), 6);
    expect(s.position(0)).toBeCloseTo(0.2, 6);
    expect(s.position(s.period / 2)).toBeCloseTo(-0.2, 6);
    expect(s.energy).toBeCloseTo(0.4, 6);
  });

  it("collisions keep momentum; elastic ones keep energy", () => {
    const e = collision(2, 2, 4, 0, 1);
    expect(e.after1).toBeCloseTo(0, 6);
    expect(e.after2).toBeCloseTo(4, 6);
    expect(e.energyAfter).toBeCloseTo(e.energyBefore, 6);
    const s = collision(2, 6, 4, 0, 0);
    expect(s.after1).toBeCloseTo(s.after2, 6);
    expect(2 * s.after1 + 6 * s.after2).toBeCloseTo(s.momentum, 6);
    expect(s.energyAfter).toBeLessThan(s.energyBefore);
    const light = collision(1, 5, 4, 0, 1);
    expect(light.after1).toBeLessThan(0); // the light cart bounces back
  });

  it("convex lens images", () => {
    const real = lens(10, 30);
    expect(real.image).toBeCloseTo(15, 6);
    expect(real.magnification).toBeCloseTo(-0.5, 6);
    expect(real.real).toBe(true);
    const at2F = lens(10, 20);
    expect(at2F.image).toBeCloseTo(20, 6);
    expect(at2F.magnification).toBeCloseTo(-1, 6);
    const magnifier = lens(10, 5);
    expect(magnifier.real).toBe(false);
    expect(magnifier.image).toBeCloseTo(-10, 6);
    expect(magnifier.magnification).toBeCloseTo(2, 6);
    expect(lens(10, 10).atInfinity).toBe(true);
  });

  it("Snell's law and total internal reflection", () => {
    const r = refraction(1, 1.5, 30);
    expect(Math.sin((r.angle! * Math.PI) / 180)).toBeCloseTo(0.5 / 1.5, 6);
    expect(r.critical).toBeNull();
    const out = refraction(1.5, 1, 30);
    expect(out.critical).toBeCloseTo((Math.asin(1 / 1.5) * 180) / Math.PI, 6);
    expect(out.totalReflection).toBe(false);
    expect(refraction(1.5, 1, 50).totalReflection).toBe(true);
    expect(refraction(1.33, 1.33, 40).angle).toBeCloseTo(40, 6);
  });
});
