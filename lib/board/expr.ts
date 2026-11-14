/**
 * A tiny, safe math-expression compiler for graphing on the board.
 * Supports + - * / ^, parentheses, implicit multiplication (2x, 3(x+1), x sin x),
 * functions (sin cos tan asin acos atan sqrt abs exp ln log) and constants (pi, e).
 * No eval — unknown input returns null.
 */

export type RealFn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
// Longest names first so "asin" wins over "sin".
const NAMES = [...Object.keys(FUNCS), "pi", "x", "e"].sort((a, b) => b.length - a.length);

type Token =
  | { k: "num"; v: number }
  | { k: "var" }
  | { k: "const"; v: number }
  | { k: "fn"; name: string }
  | { k: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { k: "lp" }
  | { k: "rp" };

function splitWord(word: string): Token[] | null {
  const out: Token[] = [];
  let rest = word;
  while (rest) {
    const name = NAMES.find((n) => rest.startsWith(n));
    if (!name) return null;
    if (name === "x") out.push({ k: "var" });
    else if (name in CONSTS) out.push({ k: "const", v: CONSTS[name] });
    else out.push({ k: "fn", name });
    rest = rest.slice(name.length);
  }
  return out;
}

function tokenize(src: string): Token[] | null {
  const s = src
    .toLowerCase()
    .replace(/\*\*/g, "^")
    .replace(/[×·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/\s+/g, "")
    .replace(/^(y|f\(x\))=/, "");
  if (!s || s.length > 200) return null;

  const raw: Token[] = [];
  const re = /(\d+\.?\d*|\.\d+)|([a-z]+)|([-+*/^])|(\()|(\))/y;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return null;
    i = re.lastIndex;
    if (m[1]) raw.push({ k: "num", v: parseFloat(m[1]) });
    else if (m[2]) {
      const parts = splitWord(m[2]);
      if (!parts) return null;
      raw.push(...parts);
    } else if (m[3]) raw.push({ k: "op", v: m[3] as "+" });
    else if (m[4]) raw.push({ k: "lp" });
    else raw.push({ k: "rp" });
  }

  // Insert implicit multiplication: 2x, 2(x), x(x+1), (x)(x), )x, x sin(x)…
  const tokens: Token[] = [];
  const endsValue = (t: Token | undefined) => t && (t.k === "num" || t.k === "var" || t.k === "const" || t.k === "rp");
  const startsValue = (t: Token) => t.k === "num" || t.k === "var" || t.k === "const" || t.k === "fn" || t.k === "lp";
  for (const t of raw) {
    if (endsValue(tokens[tokens.length - 1]) && startsValue(t)) tokens.push({ k: "op", v: "*" });
    tokens.push(t);
  }
  return tokens;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };

export function compileExpr(src: string): RealFn | null {
  const tokens = tokenize(src);
  if (!tokens?.length) return null;
  let pos = 0;

  const fail = (): never => {
    throw new Error("parse");
  };

  const parse = (minPrec: number): RealFn => {
    let left = prefix();
    for (;;) {
      const t = tokens[pos];
      if (!t || t.k !== "op") break;
      const prec = PREC[t.v];
      if (prec < minPrec) break;
      pos++;
      const right = parse(t.v === "^" ? prec : prec + 1);
      const l = left;
      switch (t.v) {
        case "+":
          left = (x) => l(x) + right(x);
          break;
        case "-":
          left = (x) => l(x) - right(x);
          break;
        case "*":
          left = (x) => l(x) * right(x);
          break;
        case "/":
          left = (x) => l(x) / right(x);
          break;
        case "^":
          left = (x) => Math.pow(l(x), right(x));
          break;
      }
    }
    return left;
  };

  const prefix = (): RealFn => {
    const t = tokens[pos++];
    if (!t) return fail();
    switch (t.k) {
      case "num": {
        const v = t.v;
        return () => v;
      }
      case "const": {
        const v = t.v;
        return () => v;
      }
      case "var":
        return (x) => x;
      case "fn": {
        const f = FUNCS[t.name];
        const arg = tokens[pos]?.k === "lp" ? prefix() : parse(3);
        return (x) => f(arg(x));
      }
      case "lp": {
        const inner = parse(1);
        if (tokens[pos++]?.k !== "rp") return fail();
        return inner;
      }
      case "op":
        if (t.v === "-") {
          const inner = parse(3);
          return (x) => -inner(x);
        }
        if (t.v === "+") return parse(3);
        return fail();
      default:
        return fail();
    }
  };

  try {
    const fn = parse(1);
    if (pos !== tokens.length) return null;
    return fn;
  } catch {
    return null;
  }
}

/** A "nice" tick step (1, 2, 5 × 10^k) for about `target` ticks across `span`. */
export function niceStep(span: number, target = 8): number {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * mag;
}
