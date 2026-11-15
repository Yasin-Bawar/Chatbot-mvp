import { describe, expect, it } from "vitest";
import {
  circuit,
  incline,
  initialParams,
  pendulumPeriod,
  pendulumStep,
  phaseAt,
  projectile,
  temperatureRange,
  wave,
} from "@/lib/visuals/physics";

describe("physics formulas", () => {
  it("projectile from the ground", () => {
    const p = projectile(20, 45, 0, 10);
    expect(p.range).toBeCloseTo(40, 5); // v²·sin(2θ)/g
    expect(p.maxHeight).toBeCloseTo(10, 5); // v²·sin²θ/(2g)
    expect(p.flightTime).toBeCloseTo(2 * Math.SQRT2, 5);
    expect(p.at(p.flightTime).y).toBeCloseTo(0, 5);
  });

  it("projectile from a height flies longer", () => {
    const ground = projectile(10, 30, 0, 9.8);
    const cliff = projectile(10, 30, 20, 9.8);
    expect(cliff.flightTime).toBeGreaterThan(ground.flightTime);
    expect(cliff.at(cliff.flightTime).y).toBeCloseTo(0, 5);
    expect(cliff.at(0).y).toBe(20);
  });

  it("pendulum period T = 2π√(L/g), and RK4 matches it for small swings", () => {
    expect(pendulumPeriod(1, 9.8)).toBeCloseTo(2.007, 3);
    let theta = 0.05;
    let omega = 0;
    let t = 0;
    const dt = 0.001;
    // Time to swing to the other side and back to start ≈ one period.
    let crossings = 0;
    let prev = theta;
    while (crossings < 2) {
      [theta, omega] = pendulumStep(theta, omega, 1, 9.8, dt);
      t += dt;
      if (Math.sign(theta) !== Math.sign(prev)) crossings++;
      prev = theta;
    }
    expect(t).toBeCloseTo(pendulumPeriod(1, 9.8) * 0.75, 1);
  });

  it("incline: slides only when tanθ > μ", () => {
    const smooth = incline(5, 30, 0, 9.8);
    expect(smooth.acceleration).toBeCloseTo(4.9, 5);
    const rough = incline(5, 30, 0.2, 9.8);
    expect(rough.acceleration).toBeCloseTo(9.8 * (0.5 - 0.2 * Math.cos(Math.PI / 6)), 5);
    const sticky = incline(5, 20, 0.5, 9.8);
    expect(sticky.moves).toBe(false);
    expect(sticky.acceleration).toBe(0);
    expect(sticky.friction).toBeCloseTo(sticky.parallel, 9);
  });

  it("Ohm's law and power", () => {
    expect(circuit(12, 4)).toEqual({ current: 3, power: 36 });
  });

  it("wave speed v = fλ", () => {
    const w = wave(1, 2, 3);
    expect(w.speed).toBe(6);
    expect(w.period).toBe(0.5);
    expect(w.y(0, 0)).toBeCloseTo(0, 9);
    expect(w.y(0.75, 0)).toBeCloseTo(1, 9);
  });

  it("phase of water", () => {
    expect(phaseAt(-10, 0, 100)).toBe("solid");
    expect(phaseAt(25, 0, 100)).toBe("liquid");
    expect(phaseAt(120, 0, 100)).toBe("gas");
    const r = temperatureRange(0, 100);
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeGreaterThan(100);
  });

  it("slider values are clamped, unknown keys ignored", () => {
    expect(initialParams("projectile", { v0: 500, angle: 30, bogus: 1 })).toEqual({ v0: 50, angle: 30, h0: 0, g: 9.8 });
  });
});
