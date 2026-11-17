/**
 * Builds public/models/human-body.glb from BodyParts3D (a real adult male body
 * reconstructed from MRI/CT by DBCLS, Japan; CC BY 4.0). Run once; the output is
 * committed, so the app itself never needs this script.
 *
 *   git clone --filter=blob:none --no-checkout https://github.com/Kevin-Mattheus-Moerman/BodyParts3D bp3d
 *   node scripts/build-body-model.mjs bp3d [--list]   # --list prints the STL paths to check out first
 *
 * Every organ group becomes one mesh named by its key (lib/visuals/anatomy.ts),
 * simplified with meshoptimizer, quantized and meshopt-compressed. Normals are
 * left out (the viewer computes them) to keep the file small.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { prune, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const OUT = "public/models/human-body.glb";

/**
 * [key, system, FMA ids (composites are expanded), triangle budget, colour].
 * The first group that lists a part wins it.
 */
const GROUPS = [
  ["skin", "skin", ["FMA7163"], 46000, "#e0ac8a"],
  ["brain", "nervous", ["FMA50801", "FMA50863"], 36000, "#eab4bd"],
  ["eyes", "nervous", ["FMA12513"], 1600, "#f8fafc"],
  ["heart", "circulatory", ["FMA7088"], 22000, "#c0392b"],
  ["arteries", "circulatory", ["FMA3734", "FMA3736", "FMA3768", "FMA3784", "FMA7161:artery"], 14000, "#dc2626"],
  ["veins", "circulatory", ["FMA10951", "FMA7161"], 10000, "#2563eb"],
  ["spleen", "circulatory", ["FMA7196"], 1600, "#7f1d4f"],
  ["lungs", "respiratory", ["FMA7195"], 16000, "#f0a3ab"],
  ["trachea", "respiratory", ["FMA7394", "FMA7409"], 5000, "#e7d3bd"],
  ["diaphragm", "respiratory", ["FMA13295"], 4000, "#b45348"],
  ["esophagus", "digestive", ["FMA7131"], 1200, "#d88b78"],
  ["stomach", "digestive", ["FMA7148"], 4000, "#e59a83"],
  ["liver", "digestive", ["FMA7197"], 5000, "#8b3626"],
  ["gallbladder", "digestive", ["FMA7202"], 1000, "#4d7c0f"],
  ["pancreas", "digestive", ["FMA7198nsn", "FMA7198"], 2000, "#e8c07a"],
  ["small_intestine", "digestive", ["FMA7200"], 12000, "#eaa58e"],
  ["large_intestine", "digestive", ["FMA7201", "FMA14542"], 9000, "#c4826a"],
  ["kidneys", "urinary", ["FMA7203", "FMA15629", "FMA15630"], 4000, "#8d3346"],
  ["ureters", "urinary", ["FMA15571", "FMA15572"], 800, "#d9b38c"],
  ["bladder", "urinary", ["FMA15900"], 1500, "#e3b58f"],
  ["skull", "skeleton", ["FMA46565", "FMA12823", "FMA55636", "FMA55637", "FMA55638"], 30000, "#eee5d3"],
  ["spine", "skeleton", ["FMA13478", "FMA16202"], 26000, "#eee5d3"],
  ["ribs", "skeleton", ["FMA7480", "FMA23881:costal cartilage"], 22000, "#eee5d3"],
  ["pelvis", "skeleton", ["FMA16586", "FMA16587"], 8000, "#eee5d3"],
  ["arm_bones", "skeleton", ["FMA24139"], 28000, "#eee5d3"],
  ["leg_bones", "skeleton", ["FMA24140"], 20000, "#eee5d3"],
  ["muscles", "muscular", ["FMA9621", "FMA9622", "FMA71291", "FMA71287", "FMA71290", "FMA86917", "FMA71293"], 120000, "#b4533f"],
];

const root = process.argv[2];
if (!root) {
  console.error("usage: node scripts/build-body-model.mjs <BodyParts3D clone> [--list]");
  process.exit(1);
}
const data = path.join(root, "assets/BodyParts3D_data");
const stlPath = (id) => path.join(data, "stl", `${id}.stl`);

function readTable(file) {
  return readFileSync(path.join(data, file), "utf8")
    .split("\n")
    .map((l) => l.replace(/\r$/, "").split("\t"));
}
const names = new Map(readTable("parts_list_e.txt").map((r) => [r[0].replace(/"/g, ""), r[1] ?? ""]));
const composite = new Map();
for (const r of readTable("composite_parts.txt")) {
  if (r.length < 4 || r[0] === "composite id") continue;
  if (!composite.has(r[0])) composite.set(r[0], new Set());
  composite.get(r[0]).add(r[2]);
}
// The STL files in the repository (checked out or not; a blobless clone still has the file list).
const available = new Set(
  execFileSync("git", ["-C", root, "ls-tree", "--name-only", "HEAD", "assets/BodyParts3D_data/stl/"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((f) => path.basename(f, ".stl")),
);

/** "FMA7161:artery" = the parts of FMA7161 whose English name contains "artery". */
function expand(source) {
  const [id, filter] = source.split(":");
  const parts = composite.has(id) ? [...composite.get(id)] : [id];
  return parts.filter((p) => available.has(p) && (!filter || (names.get(p) ?? "").toLowerCase().includes(filter)));
}

const taken = new Set();
const plan = GROUPS.map(([key, system, sources, budget, color]) => {
  const ids = [...new Set(sources.flatMap(expand))].filter((id) => !taken.has(id)).sort();
  ids.forEach((id) => taken.add(id));
  return { key, system, ids, budget, color };
});

if (process.argv.includes("--list")) {
  for (const g of plan) for (const id of g.ids) console.log(`assets/BodyParts3D_data/stl/${id}.stl`);
  process.exit(0);
}

/** Binary STL → welded indexed mesh (positions in mm, BodyParts3D axes). */
function readStl(file) {
  const buf = readFileSync(file);
  const count = buf.readUInt32LE(80);
  const positions = [];
  const indices = new Uint32Array(count * 3);
  const seen = new Map();
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(base + v * 12);
      const y = buf.readFloatLE(base + v * 12 + 4);
      const z = buf.readFloatLE(base + v * 12 + 8);
      const k = `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(z * 100)}`;
      let i = seen.get(k);
      if (i === undefined) {
        i = positions.length / 3;
        seen.set(k, i);
        positions.push(x, y, z);
      }
      indices[t * 3 + v] = i;
    }
  }
  return { positions: new Float32Array(positions), indices, triangles: count };
}

/** Keeps only the vertices an index list uses. */
function compact(positions, indices) {
  const remap = new Map();
  const out = [];
  const idx = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    let j = remap.get(indices[i]);
    if (j === undefined) {
      j = out.length / 3;
      remap.set(indices[i], j);
      out.push(positions[indices[i] * 3], positions[indices[i] * 3 + 1], positions[indices[i] * 3 + 2]);
    }
    idx[i] = j;
  }
  return { positions: new Float32Array(out), indices: idx };
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const groups = [];
for (const g of plan) {
  const files = g.ids.map(stlPath).filter((f) => {
    if (!existsSync(f)) console.warn(`  missing ${f}`);
    return existsSync(f);
  });
  const total = files.reduce((n, f) => n + (statSync(f).size - 84) / 50, 0);
  const ratio = Math.min(1, g.budget / total);
  const pos = [];
  const idx = [];
  let tris = 0;
  for (const f of files) {
    const mesh = readStl(f);
    const target = Math.max(36, Math.floor(mesh.triangles * ratio) * 3);
    let indices = mesh.indices;
    if (target < indices.length) {
      [indices] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, target, 0.25, ["Prune", "Regularize"]);
    }
    if (indices.length === 0) continue;
    const c = compact(mesh.positions, indices);
    const offset = pos.length / 3;
    for (const v of c.positions) pos.push(v);
    for (const i of c.indices) idx.push(i + offset);
    tris += c.indices.length / 3;
  }
  console.log(
    `${g.key.padEnd(16)} ${String(files.length).padStart(4)} files ${String(Math.round(total)).padStart(9)} → ${tris} triangles`,
  );
  groups.push({ ...g, positions: new Float32Array(pos), indices: new Uint32Array(idx) });
}

// Axes: BodyParts3D is in millimetres, Z up, and the body faces -Y.
// glTF: metres, Y up, facing +Z. Feet at y = 0, centred on x and z.
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const g of groups) {
  for (let i = 0; i < g.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], g.positions[i + a]);
      max[a] = Math.max(max[a], g.positions[i + a]);
    }
  }
}
const cx = (min[0] + max[0]) / 2;
const cy = (min[1] + max[1]) / 2;
const FACING = Number(process.env.BODY_FACING ?? -1); // sign of the BodyParts3D axis the face points along
for (const g of groups) {
  const p = g.positions;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] - cx;
    const y = p[i + 1] - cy;
    const z = p[i + 2] - min[2];
    p[i] = (-FACING * x) / 1000;
    p[i + 1] = z / 1000;
    p[i + 2] = (FACING * y) / 1000;
  }
}
console.log(`height ${((max[2] - min[2]) / 1000).toFixed(2)} m`);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("body");
for (const g of groups) {
  const position = doc.createAccessor().setType("VEC3").setArray(g.positions).setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(g.positions.length / 3 > 65535 ? g.indices : new Uint16Array(g.indices))
    .setBuffer(buffer);
  const r = parseInt(g.color.slice(1, 3), 16) / 255;
  const gr = parseInt(g.color.slice(3, 5), 16) / 255;
  const b = parseInt(g.color.slice(5, 7), 16) / 255;
  // glTF colours are linear.
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const material = doc
    .createMaterial(g.key)
    .setBaseColorFactor([lin(r), lin(gr), lin(b), 1])
    .setRoughnessFactor(0.7);
  const prim = doc.createPrimitive().setAttribute("POSITION", position).setIndices(indices).setMaterial(material);
  const mesh = doc.createMesh(g.key).addPrimitive(prim);
  scene.addChild(doc.createNode(g.key).setMesh(mesh).setExtras({ system: g.system }));
}

doc.createExtension(KHRMeshQuantization).setRequired(true);
doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14 }));

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
});
await io.write(OUT, doc);
console.log(`${OUT}: ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
