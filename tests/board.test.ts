import { describe, expect, it } from "vitest";
import { compileExpr, niceStep } from "@/lib/board/expr";
import { parseBoard } from "@/lib/board/parse";
import { escapeLatexBackslashes, parseLooseJson } from "@/lib/json-repair";

describe("escapeLatexBackslashes", () => {
  it("doubles single backslashes before LaTeX commands", () => {
    expect(parseLooseJson<{ math: string }>('{"math": "\\frac{a}{b} \\times \\neq \\beta"}')?.math).toBe(
      "\\frac{a}{b} \\times \\neq \\beta",
    );
  });

  it("keeps already-escaped JSON intact", () => {
    expect(parseLooseJson<{ math: string }>('{"math": "\\\\frac{1}{2} \\\\, \\"q\\""}')?.math).toBe('\\frac{1}{2} \\, "q"');
  });

  it("keeps unicode escapes", () => {
    expect(escapeLatexBackslashes('"\\u0627"')).toBe('"\\u0627"');
  });
});

describe("parseBoard", () => {
  const raw = [
    '{"title": "حل معادله"}',
    '{"step": "قدم ۱: تجزیه"}',
    '{"math": "x^2 - 5x + 6 = 0", "note": "معادله داده شده"}',
    '{"graph": {"fns": ["x^2-5x+6"], "x": [-1, 6], "points": [[2, 0, "x=2"], [3, 0]]}}',
    '{"draw": {"items": [{"t": "line", "from": [0,0], "to": [3,4], "label": "5"}, {"t": "bogus"}]}}',
    '{"answer": "x = 2 \\;\\text{یا}\\; x = 3"}',
  ].join("\n");

  it("parses JSON-lines steps", () => {
    const board = parseBoard(raw);
    expect(board.title).toBe("حل معادله");
    expect(board.steps.map((s) => s.kind)).toEqual(["heading", "math", "graph", "draw", "answer"]);
    const graph = board.steps[2];
    expect(graph.kind === "graph" && graph.graph.points).toEqual([[2, 0, "x=2"], [3, 0]]);
    const draw = board.steps[3];
    expect(draw.kind === "draw" && draw.items).toHaveLength(1);
    const answer = board.steps[4];
    expect(answer.kind === "answer" && answer.tex).toContain("\\text{یا}");
  });

  it("ignores the unfinished last line while streaming", () => {
    const partial = raw.split("\n").slice(0, 3).join("\n") + '\n{"math": "x = ';
    expect(parseBoard(partial, true).steps).toHaveLength(2);
  });

  it("accepts a single {title, steps} object", () => {
    const board = parseBoard('{\n "title": "t",\n "steps": [{"math": "a=b"}, {"answer": "b"}]\n}');
    expect(board.steps.map((s) => s.kind)).toEqual(["math", "answer"]);
  });
});

describe("compileExpr", () => {
  const at = (src: string, x: number) => compileExpr(src)?.(x);

  it("evaluates polynomials with implicit multiplication", () => {
    expect(at("x^2-5x+6", 2)).toBe(0);
    expect(at("2(x+1)", 3)).toBe(8);
    expect(at("y = 3x - 1", 2)).toBe(5);
    expect(at("-x^2", 3)).toBe(-9);
    expect(at("2^3^2", 0)).toBe(512);
  });

  it("supports functions and constants", () => {
    expect(at("sin(pi/2)", 0)).toBeCloseTo(1);
    expect(at("sqrt x", 9)).toBe(3);
    expect(at("2sinx", Math.PI / 2)).toBeCloseTo(2);
    expect(at("abs(x) + ln(e)", -4)).toBeCloseTo(5);
    expect(at("x·x ÷ 2", 4)).toBe(8);
  });

  it("rejects unsafe or invalid input", () => {
    expect(compileExpr("alert(1)")).toBeNull();
    expect(compileExpr("x +")).toBeNull();
    expect(compileExpr("(x")).toBeNull();
    expect(compileExpr("")).toBeNull();
  });

  it("picks nice tick steps", () => {
    expect(niceStep(10)).toBe(1);
    expect(niceStep(100)).toBe(10);
    expect(niceStep(7, 8)).toBe(1);
    expect(niceStep(40)).toBe(5);
  });
});
