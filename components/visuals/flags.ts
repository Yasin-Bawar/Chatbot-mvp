import data from "@/lib/visuals/countries.json";
import { DARI_COUNTRY } from "@/lib/visuals/geo";
import { normalizeFa } from "@/lib/persian";

/**
 * Countries on the globe (lib/visuals/countries.json, built by
 * scripts/build-countries.mjs) and their flags, cut from one sprite image
 * (public/flags/flags.webp).
 */

export interface CountryInfo {
  /** Name in the map data (world-atlas). */
  name: string;
  /** ISO 3166-1 alpha-2, lower case; null for a few disputed areas. */
  code: string | null;
  fa: string | null;
  /** A point well inside the country, for its label. */
  lat: number;
  lon: number;
  /** 0 = the largest country. */
  rank: number;
  /** Cell in the flag sprite. */
  flag: number | null;
}

export const COUNTRIES = data.countries as CountryInfo[];
export const COUNTRY_BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c]));
const [CELL_W, CELL_H] = data.cell;
const COLS = data.cols;
const ROWS = data.rows;
const SPRITE = "/flags/flags.webp";

/** The Dari name shown for a country (our school spelling first). */
export function faName(name: string): string {
  return DARI_COUNTRY[name] ?? COUNTRY_BY_NAME.get(name)?.fa ?? name;
}

/** CSS for one flag from the sprite, drawn `width` pixels wide (4:3). */
export function flagStyle(cell: number, width: number): Record<string, string> {
  const k = width / CELL_W;
  const col = cell % COLS;
  const row = Math.floor(cell / COLS);
  return {
    width: `${width}px`,
    height: `${(CELL_H * k).toFixed(2)}px`,
    backgroundImage: `url(${SPRITE})`,
    backgroundSize: `${(COLS * CELL_W * k).toFixed(2)}px ${(ROWS * CELL_H * k).toFixed(2)}px`,
    backgroundPosition: `-${(col * CELL_W * k).toFixed(2)}px -${(row * CELL_H * k).toFixed(2)}px`,
  };
}

/** Countries whose Dari or English name matches what the student typed (best first). */
export function searchCountries(query: string, limit = 6): CountryInfo[] {
  const q = normalizeFa(query.trim()).toLowerCase();
  if (!q) return [];
  const scored: { c: CountryInfo; score: number }[] = [];
  for (const c of COUNTRIES) {
    const names = [normalizeFa(faName(c.name)), normalizeFa(c.fa ?? ""), c.name.toLowerCase()];
    const starts = names.some((n) => n.startsWith(q));
    const has = starts || names.some((n) => n.includes(q));
    if (has) scored.push({ c, score: (starts ? 0 : 1000) + c.rank });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.c);
}
