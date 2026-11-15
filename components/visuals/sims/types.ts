/** One short result under an experiment, e.g. «برد ۴۰٫۸ m». */
export interface Readout {
  label: string;
  value: string;
  unit?: string;
  tone?: "accent" | "warn";
}

export interface SimProps {
  p: Record<string, number>;
  playing: boolean;
  /** Changes when the student presses "again". */
  run: number;
  /** The subject colour (physics blue, chemistry green). */
  accent: string;
  substance?: { name: string; melt: number; boil: number };
}
