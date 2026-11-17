import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.PGLITE_DIR = "memory";
const budget = await import("@/lib/server/budget");
const { getDb } = await import("@/lib/server/db");

beforeEach(async () => {
  await (await getDb()).query("DELETE FROM ai_usage");
});

afterEach(() => {
  delete process.env.AI_BUDGET_USD;
  delete process.env.AI_BOOK_BUDGET_USD;
  vi.restoreAllMocks();
});

describe("book-only spending limit", () => {
  it("pauses books by default and ignores the old shared allowance", async () => {
    process.env.AI_BUDGET_USD = "25";
    expect(budget.bookBudgetUsd()).toBe(0);
    await expect(budget.assertBookBudget()).rejects.toBeInstanceOf(budget.BudgetExceededError);
    process.env.AI_BOOK_BUDGET_USD = "25";
    expect(budget.bookBudgetUsd()).toBe(25);
    await expect(budget.assertBookBudget()).resolves.toBeUndefined();
  });

  it("counts only books toward the cap while preserving all usage", async () => {
    process.env.AI_BOOK_BUDGET_USD = "1";
    await budget.recordUsage("chat", "claude-sonnet-4-6", { input_tokens: 0, output_tokens: 1_000_000 });
    await budget.recordUsage("title", "claude-sonnet-4-6", { input_tokens: 0, output_tokens: 100_000 });
    await budget.recordUsage("book", "claude-sonnet-4-6", { input_tokens: 100_000, output_tokens: 0 });
    await expect(budget.assertBookBudget()).resolves.toBeUndefined();
    expect(await budget.spentUsd("book")).toBeCloseTo(0.3, 6);

    const summary = await budget.usageSummary();
    expect(summary.spentUsd).toBeCloseTo(16.8, 4);
    expect(summary.budgetUsd).toBeNull();
    expect(summary.remainingUsd).toBeNull();
    expect(summary.books).toEqual({ budgetUsd: 1, spentUsd: 0.3, remainingUsd: 0.7 });

    await budget.recordUsage("book", "claude-sonnet-4-6", { input_tokens: 0, output_tokens: 50_000 });
    await expect(budget.assertBookBudget()).rejects.toBeInstanceOf(budget.BudgetExceededError);
    expect((await budget.usageSummary()).books.remainingUsd).toBe(0);
  });

  it.each(["0", "", "off", "-1", "NaN", "Infinity"])("pauses books for invalid/zero cap %s", async (value) => {
    process.env.AI_BOOK_BUDGET_USD = value;
    await expect(budget.assertBookBudget()).rejects.toBeInstanceOf(budget.BudgetExceededError);
  });

  it("blocks book spending when the meter cannot be read", async () => {
    process.env.AI_BOOK_BUDGET_USD = "25";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(await getDb(), "query").mockRejectedValue(new Error("database unavailable"));
    await expect(budget.assertBookBudget()).rejects.toBeInstanceOf(budget.BudgetExceededError);
  });
});
