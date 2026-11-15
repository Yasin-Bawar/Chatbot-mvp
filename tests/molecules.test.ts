import { describe, expect, it } from "vitest";
import { bondAngle, buildMolecule, findPreset, formulaOf, layoutMolecule, PRESETS, type Vec3 } from "@/lib/visuals/molecules";

const positions = (key: string) => buildMolecule({ preset: key })!.atoms.map((a) => a.pos);

function maxPlaneOffset(points: Vec3[]): number {
  const [p0, p1, p2] = points;
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]);
  return Math.max(...points.map((p) => Math.abs(((p[0] - p0[0]) * n[0] + (p[1] - p0[1]) * n[1] + (p[2] - p0[2]) * n[2]) / l)));
}

describe("molecule shapes (VSEPR layout)", () => {
  it("water is bent (~104.5°)", () => {
    expect(bondAngle(positions("water"), 1, 0, 2)).toBeGreaterThan(100);
    expect(bondAngle(positions("water"), 1, 0, 2)).toBeLessThan(110);
  });

  it("methane is tetrahedral (109.5°)", () => {
    const p = positions("methane");
    for (const [a, b] of [[1, 2], [1, 3], [2, 4], [3, 4]]) expect(bondAngle(p, a, 0, b)).toBeCloseTo(109.5, 0);
  });

  it("ammonia is pyramidal (~107°), not flat", () => {
    const p = positions("ammonia");
    const angle = bondAngle(p, 1, 0, 2);
    expect(angle).toBeGreaterThan(102);
    expect(angle).toBeLessThan(112);
    expect(maxPlaneOffset([p[1], p[2], p[3], p[0]])).toBeGreaterThan(0.2);
  });

  it("carbon dioxide and ethyne are linear", () => {
    expect(bondAngle(positions("carbon-dioxide"), 1, 0, 2)).toBeCloseTo(180, 0);
    const e = positions("ethyne");
    expect(bondAngle(e, 2, 0, 1)).toBeGreaterThan(178);
    expect(bondAngle(e, 0, 1, 3)).toBeGreaterThan(178);
  });

  it("ethene and benzene are flat with 120° angles", () => {
    expect(maxPlaneOffset(positions("ethene"))).toBeLessThan(0.05);
    const b = positions("benzene");
    expect(maxPlaneOffset(b)).toBeLessThan(0.05);
    for (let i = 0; i < 6; i++) expect(bondAngle(b, (i + 5) % 6, i, (i + 1) % 6)).toBeCloseTo(120, 0);
  });

  it("bond lengths follow the bond order", () => {
    const n2 = positions("nitrogen");
    const h2 = positions("hydrogen");
    const d = (p: Vec3[]) => Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1], p[0][2] - p[1][2]);
    expect(d(n2)).toBeLessThan(1.2);
    expect(d(h2)).toBeLessThan(d(n2));
  });

  it("every preset is valid", () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      for (const [i, j, order] of preset.bonds) {
        expect(i, key).toBeLessThan(preset.atoms.length);
        expect(j, key).toBeLessThan(preset.atoms.length);
        expect(order).toBeGreaterThanOrEqual(1);
      }
      const built = buildMolecule({ preset: key })!;
      expect(built.atoms.every((a) => a.pos.every(Number.isFinite)), key).toBe(true);
    }
  });

  it("finds presets by English, formula and Dari names", () => {
    expect(findPreset("H2O")?.key).toBe("water");
    expect(findPreset("آب")?.key).toBe("water");
    expect(findPreset("Carbon Dioxide")?.key).toBe("carbon-dioxide");
    expect(findPreset("CH₄")?.key).toBe("methane");
    expect(findPreset("نمک طعام")?.key).toBe("sodium-chloride");
    expect(findPreset("unobtainium")).toBeNull();
  });

  it("lays out custom molecules and writes their formula", () => {
    const atoms = [{ el: "S" }, { el: "O" }, { el: "O" }, { el: "O" }, { el: "O" }, { el: "H" }, { el: "H" }];
    const bonds: [number, number, number][] = [[0, 1, 2], [0, 2, 2], [0, 3, 1], [0, 4, 1], [3, 5, 1], [4, 6, 1]];
    const p = layoutMolecule(atoms, bonds);
    expect(bondAngle(p, 1, 0, 2)).toBeGreaterThan(100); // tetrahedral-ish sulfur
    expect(formulaOf(atoms)).toBe("H_2O_4S");
    expect(formulaOf([{ el: "C" }, { el: "H" }, { el: "H" }, { el: "O" }])).toBe("CH_2O");
  });
});
