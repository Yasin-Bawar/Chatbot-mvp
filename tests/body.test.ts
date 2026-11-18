import { readFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
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
    // Every organ, plus the shorts the model wears.
    expect(new Set(nodes)).toEqual(new Set([...ORGAN_KEYS, "clothes"]));
    for (const n of json.nodes) expect(n.extras?.system).toBe(ORGANS[n.name]?.system ?? "skin");
    expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
    expect(statSync(GLB).size).toBeLessThan(5 * 1024 * 1024);
  });

  it("is fit for school: no bare skin between the waist and the thighs, the shorts cover it", async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const doc = await io.read(GLB);
    /** World positions of a node's mesh (positions are quantized with a node transform). */
    const points = (name: string) => {
      const node = doc
        .getRoot()
        .listNodes()
        .find((n) => n.getName() === name)!;
      const m = node.getWorldMatrix();
      const pos = node.getMesh()!.listPrimitives()[0].getAttribute("POSITION")!;
      const out: [number, number, number][] = [];
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        out.push([
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        ]);
      }
      return out;
    };
    // Metres, feet at y = 0. The shorts cover about 0.62-0.94 m; the skin under them is gone,
    // except a little overlap under the hems; nothing near the middle above 0.66 m (the genitals
    // started at about 0.69 m before they were removed).
    const inBand = ([x, y]: [number, number, number]) => Math.abs(x) < 0.15 && y > 0.7 && y < 0.9;
    const nearMiddle = ([x, y]: [number, number, number]) => Math.abs(x) < 0.05 && y > 0.66 && y < 0.92;
    const skin = points("skin");
    expect(skin.filter(inBand)).toHaveLength(0);
    expect(skin.filter(nearMiddle)).toHaveLength(0);
    const shorts = points("clothes");
    expect(shorts.filter(inBand).length).toBeGreaterThan(500);
    // The shorts reach from the upper thighs to below the navel.
    expect(Math.min(...shorts.map((p) => p[1]))).toBeLessThan(0.63);
    expect(Math.max(...shorts.map((p) => p[1]))).toBeGreaterThan(0.93);
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
