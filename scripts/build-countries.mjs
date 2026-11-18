/**
 * Builds the data for the globe's "countries" mode. Run once; the outputs are
 * committed, so the app itself never needs this script.
 *
 *   node scripts/build-countries.mjs
 *
 * - lib/visuals/countries.json: for every country on the map (world-atlas 1:50m),
 *   its ISO code, Persian name (i18n-iso-countries), a label point inside the
 *   country (polylabel) and its size rank.
 * - public/flags/flags.webp: every flag (flag-icons, MIT) in one small sprite,
 *   so the globe downloads one image instead of 200.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import sharp from "sharp";
import polylabel from "polylabel";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const countriesLib = require("i18n-iso-countries");
countriesLib.registerLocale(require("i18n-iso-countries/langs/fa.json"));
countriesLib.registerLocale(require("i18n-iso-countries/langs/en.json"));
const atlas = require("world-atlas/countries-50m.json");

// Sprite cell (4:3, like the flag files). The globe shows flags at 20×15 and the card at 64×48.
export const CELL_W = 64;
export const CELL_H = 48;
const COLS = 16;
const FLAGS = "node_modules/flag-icons/flags/4x3";

// Map shapes with no ISO number in world-atlas.
const BY_NAME = { Kosovo: "xk", "Indian Ocean Ter.": "au", "Siachen Glacier": null, Somaliland: null, "N. Cyprus": null };
// Persian names for shapes that are not a country of their own (or have no ISO name).
const FA_BY_NAME = {
  Somaliland: "سومالی‌لند",
  "N. Cyprus": "قبرس شمالی",
  "Siachen Glacier": "یخچال سیاچن",
  "Indian Ocean Ter.": "جزایر استرالیا در بحر هند",
  "Ashmore and Cartier Is.": "جزایر اشمور و کارتیر",
};

/** Longitudes made continuous across ±180°. */
function unwrap(ring) {
  const out = [];
  let offset = 0;
  let prev = ring[0][0];
  for (const [lon, lat] of ring) {
    if (lon - prev > 180) offset -= 360;
    else if (prev - lon > 180) offset += 360;
    prev = lon;
    out.push([lon + offset, lat]);
  }
  return out;
}

/** Rough area in square degrees, corrected for latitude. */
function ringArea(ring) {
  let a = 0;
  let lat = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    lat += ring[i][1];
  }
  return Math.abs(a / 2) * Math.cos(((lat / ring.length) * Math.PI) / 180);
}

const features = feature(atlas, atlas.objects.countries).features;
const rows = [];
for (const f of features) {
  const name = f.properties.name;
  const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = null;
  let bestArea = -1;
  let total = 0;
  for (const polygon of polygons) {
    const rings = polygon.map(unwrap);
    const area = ringArea(rings[0]);
    total += area;
    if (area > bestArea) {
      bestArea = area;
      best = rings;
    }
  }
  // A point well inside the biggest piece (not the centroid, which can fall outside).
  let [lon, lat] = polylabel(best, 0.05);
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  const a2 = name in BY_NAME ? BY_NAME[name] : (countriesLib.numericToAlpha2(f.id) ?? null);
  const code = a2 ? a2.toLowerCase() : null;
  const fa = FA_BY_NAME[name] ?? (code ? countriesLib.getName(code.toUpperCase(), "fa") : null);
  rows.push({
    name,
    code: code && existsSync(`${FLAGS}/${code}.svg`) ? code : null,
    fa: fa ?? null,
    lat: +lat.toFixed(2),
    lon: +lon.toFixed(2),
    area: total,
  });
}

// Biggest first: rank 0 is the largest country (its label wins when labels overlap).
rows.sort((a, b) => b.area - a.area);
const codes = [...new Set(rows.map((r) => r.code).filter(Boolean))].sort();
const cell = new Map(codes.map((c, i) => [c, i]));
const out = rows.map((r, rank) => ({
  name: r.name,
  code: r.code,
  fa: r.fa,
  lat: r.lat,
  lon: r.lon,
  rank,
  flag: r.code ? cell.get(r.code) : null,
}));
writeFileSync(
  "lib/visuals/countries.json",
  JSON.stringify({ cell: [CELL_W, CELL_H], cols: COLS, rows: Math.ceil(codes.length / COLS), countries: out }) + "\n",
);

// Flag sprite.
const tiles = await Promise.all(
  codes.map(async (code, i) => ({
    input: await sharp(readFileSync(`${FLAGS}/${code}.svg`), { density: 300 })
      .resize(CELL_W, CELL_H, { fit: "fill" })
      .png()
      .toBuffer(),
    left: (i % COLS) * CELL_W,
    top: Math.floor(i / COLS) * CELL_H,
  })),
);
mkdirSync("public/flags", { recursive: true });
await sharp({
  create: {
    width: COLS * CELL_W,
    height: Math.ceil(codes.length / COLS) * CELL_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(tiles)
  .webp({ quality: 86 })
  .toFile("public/flags/flags.webp");

console.log(
  `${out.length} countries, ${codes.length} flags, ${out
    .filter((r) => !r.code)
    .map((r) => r.name)
    .join(", ")} without a flag`,
);
