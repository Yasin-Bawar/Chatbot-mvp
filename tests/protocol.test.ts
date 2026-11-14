import { describe, expect, it } from "vitest";
import { parseOcrOutput } from "@/lib/prompts/ocr";
import { createNdjsonParser, encodeEvent } from "@/lib/stream-protocol";
import { buildChatPayload } from "@/lib/chat/payload";
import type { ChatMessage, Settings } from "@/lib/chat/types";

describe("NDJSON parser", () => {
  it("reassembles events split across chunks", () => {
    const parser = createNdjsonParser();
    const wire = encodeEvent({ t: "text", d: "سلام" }) + encodeEvent({ t: "done", stop: "end_turn" });
    const a = parser.push(wire.slice(0, 7));
    const b = parser.push(wire.slice(7, 30));
    const c = parser.push(wire.slice(30));
    expect([...a, ...b, ...c, ...parser.flush()]).toEqual([
      { t: "text", d: "سلام" },
      { t: "done", stop: "end_turn" },
    ]);
  });
});

describe("parseOcrOutput", () => {
  it("parses page blocks", () => {
    const out = parseOcrOutput('<page number="3">\n# درس\nمتن\n</page>\n<page number="4">صفحه ۴</page>', [3, 4]);
    expect(out.get(3)).toBe("# درس\nمتن");
    expect(out.get(4)).toBe("صفحه ۴");
  });

  it("falls back to the whole text for a single page", () => {
    expect(parseOcrOutput("فقط متن", [9]).get(9)).toBe("فقط متن");
  });
});

describe("buildChatPayload", () => {
  const settings: Settings = {
    model: "claude-opus-5-5",
    reasoning: true,
    quiz: false,
    webSearch: false,
    bookIds: ["b1"],
    studentName: "مریم",
    askedName: true,
  };

  it("keeps new attachments and replaces old ones over budget with a note", () => {
    const big = "A".repeat(2_000_000);
    const history: ChatMessage[] = [
      { id: "1", role: "user", text: "عکس اول", createdAt: 1, attachments: [{ kind: "image", name: "a.jpg", mediaType: "image/jpeg", data: big }] },
      { id: "2", role: "assistant", text: "جواب", createdAt: 2 },
      { id: "3", role: "user", text: "عکس دوم", createdAt: 3, attachments: [{ kind: "image", name: "b.jpg", mediaType: "image/jpeg", data: big }] },
    ];
    const body = buildChatPayload(history, settings);
    expect(body.messages[2].attachments).toHaveLength(1);
    expect(body.messages[0].attachments).toBeUndefined();
    expect(body.messages[0].text).toContain("a.jpg");
    expect(body.options).toMatchObject({ reasoning: true, bookIds: ["b1"] });
    expect(body.studentName).toBe("مریم");
  });
});
