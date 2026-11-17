import type { BodySystem } from "./anatomy";

/**
 * Interactive visuals Homa can put in an answer, each as one JSON object in a
 * fenced block: ```globe, ```molecule, ```sim or ```body. They open full screen.
 */

export type LatLon = { lat: number; lon: number };

export interface GlobeSpec {
  kind: "globe";
  title: string;
  note?: string;
  /** Where the camera looks first. */
  focus: LatLon | null;
  /** 1 = whole Earth … 4 = close (a region). */
  zoom: number;
  /** Countries to colour (English names from world-atlas, aliases and Dari names accepted). */
  highlight: { name: string; label?: string; color?: string }[];
  markers: { lat: number; lon: number; label: string; color?: string }[];
  routes: { points: [number, number][]; label?: string; color?: string }[];
  /** "satellite" (real photo of the Earth, default) or "map" (clean political map). */
  view: "satellite" | "map";
  /** Show river names (rivers are always drawn). */
  rivers: boolean;
}

export interface MoleculeAtom {
  el: string;
  /** Formal charge, e.g. -1 for O⁻ (affects lone pairs). */
  charge?: number;
}

export interface MoleculeSpec {
  kind: "molecule";
  title: string;
  note?: string;
  /** A built-in molecule (see lib/visuals/molecules.ts), e.g. "water". */
  preset?: string;
  formula?: string;
  atoms: MoleculeAtom[];
  /** [atomIndexA, atomIndexB, bondOrder?] — indices are 0-based. */
  bonds: [number, number, number][];
}

export type SimType =
  | "projectile"
  | "pendulum"
  | "incline"
  | "circuit"
  | "wave"
  | "states"
  | "freefall"
  | "spring"
  | "collision"
  | "lens"
  | "refraction"
  | "atom"
  | "reaction"
  | "ph"
  | "gas";

export interface SimSpec {
  kind: "sim";
  type: SimType;
  title: string;
  note?: string;
  /** Starting values for the sliders (units as in lib/visuals/sims.ts). */
  params: Record<string, number>;
  /** For "states": the substance and its melting / boiling points in °C. */
  substance?: { name: string; melt: number; boil: number };
  /** For "reaction": a balanced equation such as "2H2 + O2 -> 2H2O". */
  equation?: string;
}

export interface BodySpec {
  kind: "body";
  title: string;
  note?: string;
  /** Which body system to show (lib/visuals/anatomy.ts); null = the whole body. */
  system: BodySystem | null;
  /** Organ keys to point out with labels. */
  highlight: string[];
}

export type VisualSpec = GlobeSpec | MoleculeSpec | SimSpec | BodySpec;
export type VisualKind = VisualSpec["kind"];

export const VISUAL_LANGS: readonly VisualKind[] = ["globe", "molecule", "sim", "body"];
