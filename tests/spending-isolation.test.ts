import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.PGLITE_DIR = "memory";

const api = vi.hoisted(() => ({ stream: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/server/anthropic", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/anthropic")>(),
  getAnthropic: () => ({ beta: { messages: { stream: api.stream } }, messages: { create: api.create } }),
  hasApiKey: () => true,
  isMockMode: () => false,
}));

const { getDb } = await import("@/lib/server/db");
const { recordUsage, BudgetExceededError } = await import("@/lib/server/budget");
const { readPagesWithClaude } = await import("@/lib/server/ocr");
const chat = await import("@/app/api/chat/route");
const title = await import("@/app/api/title/route");
const reread = await import("@/app/api/books/[id]/reread/route");

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.AI_BUDGET_USD = "10";
  process.env.AI_BOOK_READING = "1";
  delete process.env.AI_BOOK_BUDGET_USD;
  await (await getDb()).query("DELETE FROM ai_usage");
  // Reproduce an exhausted old shared budget, using only book spending.
  await recordUsage("book", "claude-sonnet-4-6", { input_tokens: 10_000_000, output_tokens: 0 });
});

afterEach(() => {
  delete process.env.AI_BUDGET_USD;
  delete process.env.AI_BOOK_READING;
});

describe("chat stays available while paid book reading is paused", () => {
  it("streams a chat response despite historical book spending above the old cap", async () => {
    api.stream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } };
      },
      finalMessage: async () => ({
        content: [{ type: "text", text: "Hello" }], stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    const response = await chat.POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "Hello" }], options: { model: "claude-sonnet-4-6" } }),
    }));
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(events).toContainEqual({ t: "text", d: "Hello" });
    expect(events).toContainEqual({ t: "done", stop: "end_turn" });
    expect(events.some((event) => event.t === "error")).toBe(false);
    expect(api.stream).toHaveBeenCalledOnce();
  });

  it("still generates chat titles", async () => {
    api.create.mockResolvedValue({
      content: [{ type: "text", text: "Learning about plants" }], stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const response = await title.POST(new Request("http://localhost/api/title", {
      method: "POST", body: JSON.stringify({ user: "Explain photosynthesis" }),
    }));
    expect(await response.json()).toEqual({ title: "Learning about plants" });
    expect(api.create).toHaveBeenCalledOnce();
  });

  it("rejects direct book reads and manual rereads before calling Claude", async () => {
    await expect(readPagesWithClaude("unused", [1])).rejects.toBeInstanceOf(BudgetExceededError);
    const response = await reread.POST(new Request("http://localhost/api/books/book/reread", {
      method: "POST", body: JSON.stringify({ page: 1 }),
    }), { params: Promise.resolve({ id: "book" }) });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("ai_reading_off");
    expect(api.stream).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });
});
