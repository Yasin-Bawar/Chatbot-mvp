export interface Readout {
  label: string;
  value: string;
  unit?: string;
  /** Formula shown under the value (LaTeX). */
  tex?: string;
  tone?: "good" | "warn";
}

export interface SimProps {
  p: Record<string, number>;
  playing: boolean;
  /** Changes when the student presses "again". */
  run: number;
  substance?: { name: string; melt: number; boil: number };
}
