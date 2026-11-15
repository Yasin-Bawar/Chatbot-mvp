import { describe, expect, it } from "vitest";
import { cleanTitle, guessGrade, guessSubject } from "@/lib/subjects";

describe("guessSubject", () => {
  it.each([
    ["فزیک صنف یازدهم.pdf", "physics"],
    ["riazi-11.pdf", "riazi"],
    ["G11-dr-Calture.pdf", "civics"],
    ["کتاب تعلیم و تربیه اسلامی (حنفی) صنف یازدهم.pdf", "islamic"],
    ["english_grade_11.pdf", "english"],
    ["کیمیا_صنف_۱۱.pdf", "chemistry"],
    ["Biology-Grade11.pdf", "biology"],
    ["پښتو ټولګی ۱۱.pdf", "pashto"],
    ["دری - صنف یازدهم - کتاب درسی مکتب.pdf", "dari"],
    ["تفسیر شریف صنف یازدهم.pdf", "islamic"],
  ])("%s → %s", (name, subject) => {
    expect(guessSubject(name)).toBe(subject);
  });

  it("returns null for unknown names", () => {
    expect(guessSubject("scan_0042.pdf")).toBeNull();
  });
});

describe("guessGrade", () => {
  it.each([
    ["فزیک صنف یازدهم.pdf", 11],
    ["riazi-11.pdf", 11],
    ["G11-dr-Calture.pdf", 11],
    ["english_grade_11.pdf", 11],
    ["کیمیا_صنف_۱۱.pdf", 11],
    ["ریاضی صنف دوازدهم.pdf", 12],
    ["ریاضی صنف دهم.pdf", 10],
    ["Biology-Grade11.pdf", 11],
    ["Class 7 Science.pdf", 7],
  ])("%s → %s", (name, grade) => {
    expect(guessGrade(name)).toBe(grade);
  });

  it("returns null when there is no grade", () => {
    expect(guessGrade("physics-book.pdf")).toBeNull();
    expect(guessGrade("book 2023.pdf")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("drops extension, separators and site noise", () => {
    expect(cleanTitle("english_grade_11.pdf")).toBe("english grade 11");
    expect(cleanTitle("دانلود کتاب/ پی دی اف دری - صنف یازدهم.pdf")).toBe("کتاب/ دری - صنف یازدهم");
    expect(cleanTitle("فزیک صنف یازدهم.pdf")).toBe("فزیک صنف یازدهم");
  });
});
