import { afterEach, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";
const budget = await import("@/lib/server/budget");

afterEach(() => {
  delete process.env.AI_BUDGET_USD;
});

describe("spending limit", () => {
  it("defaults to $10 and can be changed or turned off", () => {
    expect(budget.budgetUsd()).toBe(10);
    process.env.AI_BUDGET_USD = "25";
    expect(budget.budgetUsd()).toBe(25);
    process.env.AI_BUDGET_USD = "0";
    expect(budget.budgetUsd()).toBeNull();
  });

  it("records spending and refuses new requests once the budget is used", async () => {
    process.env.AI_BUDGET_USD = "1";
    await budget.assertBudget(); // nothing spent yet
    // $0.75: 50K input + 40K output tokens on Sonnet 4.6.
    await budget.recordUsage("chat", "claude-sonnet-4-6", { input_tokens: 50_000, output_tokens: 40_000 });
    expect(await budget.spentUsd()).toBeCloseTo(0.75, 6);
    await budget.assertBudget(); // still under $1
    await budget.recordUsage("book", "claude-sonnet-4-6", { input_tokens: 100_000, output_tokens: 0 });
    await expect(budget.assertBudget()).rejects.toBeInstanceOf(budget.BudgetExceededError);

    const summary = await budget.usageSummary();
    expect(summary.spentUsd).toBeCloseTo(1.05, 4);
    expect(summary.remainingUsd).toBe(0);
    expect(summary.byKind.map((k) => k.kind)).toEqual(["book", "chat"]);
  });

  it("does not block when the limit is off", async () => {
    process.env.AI_BUDGET_USD = "off";
    await expect(budget.assertBudget()).resolves.toBeUndefined();
  });
});
