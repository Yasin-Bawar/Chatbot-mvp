import { describe, expect, it } from "vitest";
import { normalizeFa, queryTerms, stemFa, toFaDigits, toLatinDigits, tokenizeFa } from "@/lib/persian";

describe("normalizeFa", () => {
  it("unifies Arabic letter variants and removes ZWNJ/diacritics", () => {
    expect(normalizeFa("كتاب‌هاي")).toBe("کتابهای");
    expect(normalizeFa("مُعَلِّم")).toBe("معلم");
    expect(normalizeFa("آب")).toBe("اب");
  });

  it("folds Arabic presentation forms (common in PDFs)", () => {
    // ﻛﺘﺎﺏ written with presentation-form glyphs
    expect(normalizeFa("ﻛﺘﺎﺏ")).toBe("کتاب");
  });

  it("converts Persian/Arabic digits", () => {
    expect(toLatinDigits("صفحه ۴۵ و ٣")).toBe("صفحه 45 و 3");
    expect(toFaDigits("Page 12")).toBe("Page ۱۲");
  });
});

describe("tokenizeFa", () => {
  it("drops stopwords and stems plural suffixes", () => {
    const tokens = tokenizeFa("فتوسنتز در برگ‌های نبات‌ها انجام می‌شود");
    expect(tokens).toContain("فتوسنتز");
    expect(tokens).toContain("برگ");
    expect(tokens).toContain("نبات");
    expect(tokens).not.toContain("در");
  });

  it("keeps short words unstemmed", () => {
    expect(stemFa("ماها")).toBe("ماها");
    expect(stemFa("کتابها")).toBe("کتاب");
  });

  it("builds unique query terms, longest first", () => {
    expect(queryTerms("قانون دوم نیوتن قانون")).toEqual(["قانون", "نیوتن", "دوم"]);
  });
});
