import { describe, expect, it } from "vitest";
import { normalizeDisplayMath, repairMarkdown } from "@/lib/markdown-repair";

describe("repairMarkdown", () => {
  it("closes dangling bold", () => {
    expect(repairMarkdown("این یک **کلمه")).toBe("این یک **کلمه**");
  });

  it("drops a bold marker with nothing after it", () => {
    expect(repairMarkdown("سلام **")).toBe("سلام ");
  });

  it("leaves complete Markdown alone", () => {
    const md = "## عنوان\n\nیک **مهم** و `کد` و $x^2$.";
    expect(repairMarkdown(md)).toBe(md);
  });

  it("closes an open code fence", () => {
    expect(repairMarkdown("```quiz\n{\"title\": \"آ")).toBe("```quiz\n{\"title\": \"آ\n```");
  });

  it("hides unfinished display math", () => {
    expect(repairMarkdown("معادله:\n\n$$x = \\frac{-b")).toBe("معادله:");
  });

  it("hides unfinished inline math", () => {
    expect(repairMarkdown("فورمول $a^2 + b")).toBe("فورمول");
  });

  it("hides a table until its delimiter row arrives", () => {
    expect(repairMarkdown("متن\n\n| ورودی | خروجی |")).toBe("متن");
    expect(repairMarkdown("متن\n\n| ورودی | خروجی |\n| --- | --- |\n| آب")).toContain("| --- | --- |");
  });

  it("drops a half-written link", () => {
    expect(repairMarkdown("ببینید [این صفحه](https://exa")).toBe("ببینید ");
  });
});

describe("normalizeDisplayMath", () => {
  it("turns a single-line $$ formula into a display block", () => {
    expect(normalizeDisplayMath("متن\n\n$$x^2 + 1$$\n\nادامه")).toBe("متن\n\n$$\nx^2 + 1\n$$\n\nادامه");
  });

  it("leaves inline math inside a sentence alone", () => {
    const md = "فورمول $$a+b$$ در جمله";
    expect(normalizeDisplayMath(md)).toBe(md);
  });
});
