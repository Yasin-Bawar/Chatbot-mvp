import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORGAN_KEYS, ORGANS, organsOf, resolveOrgan, resolveSystem, SYSTEMS } from "@/lib/visuals/anatomy";
import { parseVisual } from "@/lib/visuals/parse";

const GLB = "public/models/human-body.glb";

/** Reads the JSON chunk of a binary glTF file. */
function glbJson(file: string) {
  const buf = readFileSync(file);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const length = buf.readUInt32LE(12);
  expect(buf.toString("ascii", 16, 20)).toBe("JSON");
  return JSON.parse(buf.toString("utf8", 20, 20 + length));
}

describe("3D human body", () => {
  it("the model has every organ and stays small for slow internet", () => {
    const json = glbJson(GLB);
    const nodes = (json.nodes as { name: string; extras?: { system?: string } }[]).map((n) => n.name);
    expect(new Set(nodes)).toEqual(new Set(ORGAN_KEYS));
    for (const n of json.nodes) expect(n.extras?.system).toBe(ORGANS[n.name].system);
    expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
    expect(statSync(GLB).size).toBeLessThan(5 * 1024 * 1024);
  });

  it("every system has organs, and every organ an explanation and a question", () => {
    for (const s of SYSTEMS) expect(organsOf(s.key).length).toBeGreaterThan(0);
    for (const o of Object.values(ORGANS)) {
      expect(o.about.length).toBeGreaterThan(20);
      expect(o.question.endsWith("؟")).toBe(true);
    }
  });

  it("understands organ and system names in English and Dari", () => {
    expect(resolveOrgan("Stomach")).toEqual(["stomach"]);
    expect(resolveOrgan("kidney")).toEqual(["kidneys"]);
    expect(resolveOrgan("small intestine")).toEqual(["small_intestine"]);
    expect(resolveOrgan("intestines")).toEqual(["small_intestine", "large_intestine"]);
    expect(resolveOrgan("قلب")).toEqual(["heart"]);
    expect(resolveOrgan("ريه")).toEqual(["lungs"]);
    expect(resolveOrgan("جگر")).toEqual(["liver"]);
    expect(resolveOrgan("tail")).toEqual([]);
    expect(resolveSystem("Digestive system")).toBe("digestive");
    expect(resolveSystem("سیستم تنفسی")).toBe("respiratory");
    expect(resolveSystem("دوران خون")).toBe("circulatory");
    expect(resolveSystem("magic")).toBeNull();
  });

  it("parses body blocks", () => {
    expect(parseVisual("anatomy", '{"system":"digestive","highlight":["stomach","Liver","nonsense"]}')).toEqual({
      kind: "anatomy",
      title: "سیستم هاضمه",
      note: undefined,
      system: "digestive",
      highlight: ["stomach", "liver"],
    });
    // The system follows from the first organ when it is not given.
    expect(parseVisual("anatomy", '{"title":"قلب","highlight":"heart"}')).toMatchObject({
      system: "circulatory",
      highlight: ["heart"],
    });
    expect(parseVisual("anatomy", "{}")).toMatchObject({ title: "بدن انسان", system: null, highlight: [] });
    // The older format: one "focus" organ and "all" / "skeletal" systems.
    expect(parseVisual("anatomy", '{"system":"all","focus":"heart"}')).toMatchObject({
      system: "circulatory",
      highlight: ["heart"],
    });
    expect(parseVisual("anatomy", '{"system":"skeletal","focus":"ribcage"}')).toMatchObject({
      system: "skeleton",
      highlight: ["ribs"],
    });
  });
});
