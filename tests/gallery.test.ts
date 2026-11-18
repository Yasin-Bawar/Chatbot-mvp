import { describe, expect, it } from "vitest";
import data from "@/lib/visuals/countries.json";
import { GALLERY, GALLERY_SUBJECTS } from "@/lib/visuals/gallery";
import { pointInPolygons } from "@/lib/visuals/geo";
import { parseVisual } from "@/lib/visuals/parse";
import { faName, flagStyle, searchCountries } from "@/components/visuals/flags";

describe("«نمایش‌ها» page", () => {
  it("every item opens as a complete visual", () => {
    const ids = new Set<string>();
    for (const item of GALLERY) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      const spec = parseVisual(item.kind, JSON.stringify(item.data));
      expect(spec, item.id).not.toBeNull();
      expect(spec!.kind).toBe(item.kind);
    }
    // All experiments, molecules, body systems and globes are there.
    expect(GALLERY.filter((i) => i.kind === "sim")).toHaveLength(15);
    expect(GALLERY.filter((i) => i.kind === "anatomy")).toHaveLength(9);
    expect(GALLERY.filter((i) => i.kind === "molecule").length).toBeGreaterThanOrEqual(13);
    for (const s of GALLERY_SUBJECTS) expect(GALLERY.some((i) => i.subject === s.id)).toBe(true);
  });

  it("the countries globe starts in countries mode", () => {
    const item = GALLERY.find((i) => i.id === "globe-countries")!;
    expect(parseVisual("globe", JSON.stringify(item.data))).toMatchObject({ countries: true });
    expect(parseVisual("globe", '{"title":"x","mode":"countries"}')).toMatchObject({ countries: true });
    expect(parseVisual("globe", '{"title":"x"}')).toMatchObject({ countries: false });
  });
});

describe("countries and flags", () => {
  const countries = data.countries;

  it("every country on the map has a Dari name, and almost all a flag", () => {
    expect(countries.length).toBeGreaterThan(230);
    for (const c of countries) expect(faName(c.name).length).toBeGreaterThan(1);
    expect(countries.filter((c) => c.flag === null).length).toBeLessThanOrEqual(4);
    expect(faName("Afghanistan")).toBe("افغانستان");
    expect(faName("United States of America")).toBe("امریکا");
  });

  it("flag cells are unique and inside the sprite", () => {
    const cells = countries.map((c) => c.flag).filter((f): f is number => f !== null);
    expect(Math.max(...cells)).toBeLessThan(data.cols * data.rows);
    const style = flagStyle(2, 32);
    expect(style.width).toBe("32px");
    expect(style.height).toBe("24.00px");
    expect(style.backgroundPosition).toBe("-64.00px -0.00px");
  });

  it("label points sit inside their country", async () => {
    const { feature } = await import("topojson-client");
    const atlas = (await import("world-atlas/countries-50m.json")).default as never;
    const features = feature(atlas, (atlas as { objects: { countries: never } }).objects.countries) as unknown as {
      features: { properties: { name: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[];
    };
    let inside = 0;
    for (const c of countries) {
      const f = features.features.find((x) => x.properties.name === c.name)!;
      const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      if (pointInPolygons(c.lon, c.lat, polygons)) inside++;
    }
    expect(inside / countries.length).toBeGreaterThan(0.97);
  });

  it("finds countries by Dari or English name", () => {
    expect(searchCountries("افغان")[0].name).toBe("Afghanistan");
    expect(searchCountries("japan")[0].name).toBe("Japan");
    expect(searchCountries("جاپان")[0].name).toBe("Japan");
    expect(searchCountries("")).toEqual([]);
  });
});
