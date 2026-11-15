import { parseLooseJson } from "@/lib/json-repair";
import { normalizeElement } from "./molecules";
import { SIM_TITLES } from "./physics";
import type { GlobeSpec, MoleculeSpec, SimSpec, SimType, VisualKind, VisualSpec } from "./types";

/**
 * Parses the JSON inside a ```globe / ```molecule / ```sim block into a safe,
 * complete spec (defaults filled in, bad values dropped). Returns null when the
 * block cannot be used.
 */

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const color = (v: unknown): string | undefined =>
  typeof v === "string" && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(v.trim()) ? v.trim() : undefined;

function latLon(v: unknown): { lat: number; lon: number } | null {
  if (Array.isArray(v) && v.length >= 2) {
    const lat = num(v[0]);
    const lon = num(v[1]);
    return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 360 ? { lat, lon } : null;
  }
  if (isObj(v)) {
    const lat = num(v.lat ?? v.latitude);
    const lon = num(v.lon ?? v.lng ?? v.longitude);
    return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 360 ? { lat, lon } : null;
  }
  return null;
}

function parseGlobe(o: Raw): GlobeSpec {
  const highlight = arr(o.highlight ?? o.countries)
    .map((h): GlobeSpec["highlight"][number] | null => (typeof h === "string" ? { name: h } : isObj(h) ? { name: str(h.name, 80) ?? "", label: str(h.label, 60), color: color(h.color) } : null))
    .filter((h): h is GlobeSpec["highlight"][number] => Boolean(h?.name))
    .slice(0, 30);
  const markers = arr(o.markers ?? o.places)
    .map((m): GlobeSpec["markers"][number] | null => {
      if (!isObj(m)) return null;
      const p = latLon(m);
      const label = str(m.label ?? m.name, 60);
      return p && label ? { ...p, label, color: color(m.color) } : null;
    })
    .filter((m): m is GlobeSpec["markers"][number] => Boolean(m))
    .slice(0, 40);
  const routes = arr(o.routes)
    .map((r): GlobeSpec["routes"][number] | null => {
      const raw = isObj(r) ? r.points : r;
      const points = arr(raw)
        .map(latLon)
        .filter((p): p is { lat: number; lon: number } => Boolean(p))
        .map((p) => [p.lat, p.lon] as [number, number]);
      return points.length >= 2 ? { points: points.slice(0, 50), label: isObj(r) ? str(r.label, 60) : undefined, color: isObj(r) ? color(r.color) : undefined } : null;
    })
    .filter((r): r is GlobeSpec["routes"][number] => Boolean(r))
    .slice(0, 10);
  const zoom = num(o.zoom);
  return {
    kind: "globe",
    title: str(o.title) ?? "کره زمین",
    note: str(o.note, 600),
    focus: latLon(o.focus ?? o.center),
    zoom: zoom === null ? (markers.length || highlight.length ? 2 : 1) : Math.min(4, Math.max(1, zoom)),
    highlight,
    markers,
    routes,
  };
}

function parseMolecule(o: Raw): MoleculeSpec | null {
  const atoms = arr(o.atoms)
    .map((a) => {
      if (typeof a === "string") return { el: normalizeElement(a) };
      if (isObj(a) && typeof (a.el ?? a.element) === "string") {
        const charge = num(a.charge);
        return { el: normalizeElement(String(a.el ?? a.element)), ...(charge ? { charge } : {}) };
      }
      return null;
    })
    .filter((a): a is MoleculeSpec["atoms"][number] => Boolean(a))
    .slice(0, 80);
  const bonds = arr(o.bonds)
    .map((b) => {
      const list = Array.isArray(b) ? b : isObj(b) ? [b.a ?? b.from, b.b ?? b.to, b.order] : [];
      const i = num(list[0]);
      const j = num(list[1]);
      const order = num(list[2]) ?? 1;
      return i !== null && j !== null ? ([i, j, Math.min(3, Math.max(1, Math.round(order)))] as [number, number, number]) : null;
    })
    .filter((b): b is [number, number, number] => Boolean(b));
  const preset = str(o.preset ?? o.molecule ?? o.name, 60);
  if (!preset && !atoms.length) return null;
  return {
    kind: "molecule",
    title: str(o.title) ?? "",
    note: str(o.note, 600),
    preset,
    formula: str(o.formula, 40),
    atoms,
    bonds,
  };
}

const SIM_TYPES = new Set<SimType>(["projectile", "pendulum", "incline", "circuit", "wave", "states"]);
const SIM_ALIASES: Record<string, SimType> = {
  projectile_motion: "projectile",
  throw: "projectile",
  pendulum_motion: "pendulum",
  inclined_plane: "incline",
  ramp: "incline",
  friction: "incline",
  ohm: "circuit",
  ohms_law: "circuit",
  electric_circuit: "circuit",
  waves: "wave",
  states_of_matter: "states",
  matter: "states",
  phases: "states",
};

function parseSim(o: Raw): SimSpec | null {
  const rawType = (str(o.type ?? o.sim, 40) ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const type = SIM_TYPES.has(rawType as SimType) ? (rawType as SimType) : SIM_ALIASES[rawType];
  if (!type) return null;
  const params: Record<string, number> = {};
  const source = isObj(o.params) ? o.params : o;
  for (const [k, v] of Object.entries(source)) {
    const n = num(v);
    if (n !== null) params[k] = n;
  }
  let substance: SimSpec["substance"];
  if (type === "states") {
    const s = isObj(o.substance) ? o.substance : null;
    const melt = num(s?.melt ?? s?.melting ?? o.melt);
    const boil = num(s?.boil ?? s?.boiling ?? o.boil);
    substance =
      melt !== null && boil !== null && boil > melt
        ? { name: str(s?.name ?? o.substanceName, 40) ?? "ماده", melt, boil }
        : { name: "آب", melt: 0, boil: 100 };
  }
  return { kind: "sim", type, title: str(o.title) ?? SIM_TITLES[type], note: str(o.note, 600), params, substance };
}

export function parseVisual(kind: VisualKind, source: string): VisualSpec | null {
  const o = parseLooseJson<unknown>(source);
  if (!isObj(o)) return null;
  if (kind === "globe") return parseGlobe(o);
  if (kind === "molecule") return parseMolecule(o);
  return parseSim(o);
}
