import { describe, expect, it } from "vitest";
import { countryLabel, greatCircle, latLonToVector, resolveCountry } from "@/lib/visuals/geo";
import { parseVisual } from "@/lib/visuals/parse";

describe("visual specs", () => {
  it("parses a globe with highlights, markers and routes", () => {
    const spec = parseVisual(
      "globe",
      `{"title":"افغانستان و همسایه‌ها","focus":{"lat":34,"lon":66},"zoom":3,
        "highlight":["Afghanistan",{"name":"Iran","label":"ایران","color":"#f59e0b"}],
        "markers":[{"lat":34.53,"lon":69.17,"label":"کابل"},{"lat":"oops","lon":1,"label":"x"}],
        "routes":[{"points":[[34.5,69.2],[39.6,66.9]],"label":"راه ابریشم"}],
        "note":"افغانستان کشوری محاط به خشکه است."}`,
    );
    expect(spec?.kind).toBe("globe");
    if (spec?.kind !== "globe") return;
    expect(spec.focus).toEqual({ lat: 34, lon: 66 });
    expect(spec.zoom).toBe(3);
    expect(spec.highlight).toEqual([{ name: "Afghanistan" }, { name: "Iran", label: "ایران", color: "#f59e0b" }]);
    expect(spec.markers).toHaveLength(1);
    expect(spec.routes[0].points).toHaveLength(2);
  });

  it("parses molecules (preset or custom)", () => {
    const water = parseVisual("molecule", `{"preset":"water","title":"آب"}`);
    expect(water).toMatchObject({ kind: "molecule", preset: "water" });
    const custom = parseVisual("molecule", `{"atoms":["c","O","O"],"bonds":[[0,1,2],[0,2,2]]}`);
    expect(custom).toMatchObject({ kind: "molecule", atoms: [{ el: "C" }, { el: "O" }, { el: "O" }] });
    expect(parseVisual("molecule", `{"title":"nothing"}`)).toBeNull();
  });

  it("parses simulations with aliases and defaults", () => {
    expect(parseVisual("sim", `{"type":"projectile","params":{"v0":25,"angle":60}}`)).toMatchObject({
      type: "projectile",
      params: { v0: 25, angle: 60 },
      title: "حرکت پرتابی",
    });
    expect(parseVisual("sim", `{"type":"inclined plane","angle":25}`)).toMatchObject({ type: "incline", params: { angle: 25 } });
    expect(parseVisual("sim", `{"type":"states"}`)).toMatchObject({ substance: { name: "آب", melt: 0, boil: 100 } });
    expect(parseVisual("sim", `{"type":"states","substance":{"name":"الکول","melt":-114,"boil":78}}`)).toMatchObject({
      substance: { name: "الکول", melt: -114, boil: 78 },
    });
    expect(parseVisual("sim", `{"type":"rocket"}`)).toBeNull();
    expect(parseVisual("sim", `not json`)).toBeNull();
  });

  it("repairs LaTeX backslashes in notes", () => {
    const spec = parseVisual("sim", `{"type":"pendulum","note":"دوره: $T = 2\\pi\\sqrt{L/g}$"}`);
    expect(spec?.note).toContain("\\pi");
  });
});

describe("globe geography helpers", () => {
  const names = ["Afghanistan", "Iran", "United States of America", "United Kingdom", "Côte d'Ivoire"];
  it("resolves English aliases and Dari names", () => {
    expect(resolveCountry("afghanistan", names)).toBe("Afghanistan");
    expect(resolveCountry("USA", names)).toBe("United States of America");
    expect(resolveCountry("Persia", names)).toBe("Iran");
    expect(resolveCountry("افغانستان", names)).toBe("Afghanistan");
    expect(resolveCountry("Ivory Coast", names)).toBe("Côte d'Ivoire");
    expect(resolveCountry("Atlantis", names)).toBeNull();
  });

  it("labels countries in Dari", () => {
    expect(countryLabel("Afghanistan")).toBe("افغانستان");
    expect(countryLabel("Iran", "پارس")).toBe("پارس");
    expect(countryLabel("Narnia")).toBe("Narnia");
  });

  it("maps lat/lon to the unit sphere and draws great circles", () => {
    const [x, y, z] = latLonToVector(0, 0);
    expect([x, y, z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, 1]);
    expect(latLonToVector(90, 0)[1]).toBeCloseTo(1, 9);
    const arc = greatCircle([34.5, 69.2], [39.6, 66.9], 10);
    expect(arc).toHaveLength(11);
    for (const p of arc) expect(Math.hypot(...p)).toBeCloseTo(1, 9);
  });
});
