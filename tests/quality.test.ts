import { describe, expect, it } from "vitest";
import { assessPageText, cleanExtractedText } from "@/lib/pdf/quality";

const GOOD = `فصل دوم: فتوسنتز
نباتات سبز با استفاده از نور آفتاب، آب و کاربن دای اکساید غذای خود را می‌سازند. این عملیه در برگ‌ها انجام می‌شود و اکسیجن به هوا آزاد می‌گردد.
کلوروفیل رنگ سبز برگ است که نور را جذب می‌کند. در این درس با مراحل فتوسنتز آشنا می‌شویم و مثال‌های زیادی را از زندگی روزمره می‌بینیم.`;

describe("assessPageText", () => {
  it("accepts normal Dari text", () => {
    expect(assessPageText(GOOD)).toEqual({ ok: true });
  });

  it("flags scanned pages with almost no text", () => {
    expect(assessPageText("  12  ")).toEqual({ ok: false, issue: "empty" });
  });

  it("flags private-use glyphs (broken font encoding)", () => {
    const garbled = "  ".repeat(20) + GOOD.slice(0, 40);
    expect(assessPageText(garbled).issue).toBe("garbled");
  });

  it("flags Latin-1 mojibake", () => {
    const mojibake = "Ø§Ù„Ø¯Ø±Ø³ Ø§Ù„Ø£ÙˆÙ„ Ù…Ù† Ø§Ù„ÙƒØªØ§Ø¨ ".repeat(6);
    expect(assessPageText(mojibake).issue).toBe("garbled");
  });

  it("flags Latin gibberish on a Dari book page", () => {
    const fake = "lÇ ¤ ¶Æ kdjf qwe rty uiop asdf ghjk zxcv bnm ".repeat(5);
    expect(assessPageText(fake, { expectArabicScript: true }).ok).toBe(false);
    // …but an English book page is fine.
    expect(assessPageText("The present simple tense is used for habits and facts. ".repeat(4), { expectArabicScript: false }).ok).toBe(true);
  });

  it("flags reversed (visual-order) text", () => {
    const reversed = GOOD.split("\n")
      .map((line) => [...line].reverse().join(""))
      .join("\n");
    expect(assessPageText(reversed).issue).toBe("reversed");
  });

  it("flags a real reversed + mis-mapped page extracted from a Chromium-made PDF", () => {
    const real =
      "زتنسوتف :دوم لصف\nنای .دنزاسید را موخ ایذغ دیاسکدای ا نبراک ب، آب واتفر آون ده ازافتسا اب زبس تاتابن\n.ددرگیا آزاد موه هب نجیسکد و اوشیم ماجنا اهگرب در هیلمع\nانشآ زتنسوتف لحارم اب درس ندر ای .دنکیب مذج ر راون هک تسگ ارب زبس گنر لیفروولک\n.میوشیم";
    expect(assessPageText(real).issue).toBe("reversed");
  });

  it("does not flag normal text with many verbs and plurals", () => {
    const verbs = "شاگردان درس‌ها را می‌خوانند و تمرین‌ها را حل می‌کنند. معلمان کتاب‌ها را می‌آورند و سوال‌ها را می‌پرسند. ".repeat(3);
    expect(assessPageText(verbs).ok).toBe(true);
  });

  it("flags letters split apart by spaces", () => {
    const fragmented = [..."کتابدرسیریاضیصنفهفتممکتب".repeat(4)].join(" ");
    expect(assessPageText(fragmented).issue).toBe("fragmented");
  });
});

describe("cleanExtractedText", () => {
  it("collapses whitespace and blank lines", () => {
    expect(cleanExtractedText("الف   ب \n\n\n\nج")).toBe("الف ب\n\nج");
  });
});
