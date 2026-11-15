import type { VisualSpec } from "@/lib/visuals/types";

/**
 * One calm colour per school subject (the same family as the library book
 * covers in lib/subjects.ts, a little darker so it reads well on white).
 */
export interface VisualTheme {
  subject: "geography" | "chemistry" | "physics";
  /** Subject name shown on the card and in the header. */
  label: string;
  /** What kind of visual it is, in a word or two. */
  kind: string;
  accent: string;
  accentSoft: string;
  /** The globe sits in dark space; molecules and experiments are light, like a textbook page. */
  dark: boolean;
}

const GEOGRAPHY = { subject: "geography", label: "جغرافیه", accent: "#0d9488", accentSoft: "#ccfbf1" } as const;
const CHEMISTRY = { subject: "chemistry", label: "کیمیا", accent: "#059669", accentSoft: "#d1fae5" } as const;
const PHYSICS = { subject: "physics", label: "فزیک", accent: "#0284c7", accentSoft: "#e0f2fe" } as const;

export function visualTheme(spec: VisualSpec): VisualTheme {
  if (spec.kind === "globe") return { ...GEOGRAPHY, kind: "کره زمین", dark: true };
  if (spec.kind === "molecule") return { ...CHEMISTRY, kind: "مولکول", dark: false };
  if (spec.type === "states") return { ...CHEMISTRY, kind: "آزمایش", dark: false };
  return { ...PHYSICS, kind: "آزمایش", dark: false };
}

/** Light-page ink colours shared by the canvases. */
export const INK = {
  ink: "#1e293b",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  grid: "#eef2f7",
  page: "#ffffff",
  warm: "#d97706",
};
