import { toFaDigits } from "@/lib/persian";

/** A number for students: Persian digits, Persian decimal mark, sensible precision. */
export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const fixed = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(digits);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  const out = toFaDigits(trimmed === "-0" ? "0" : trimmed).replace(".", "٫");
  // Keep the minus sign in front of the number inside right-to-left text.
  return out.startsWith("-") ? `\u2066−${out.slice(1)}\u2069` : out;
}
