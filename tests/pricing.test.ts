import { describe, expect, it } from "vitest";
import { costUsd, isPricedModel, WEB_SEARCH_USD } from "@/lib/server/pricing";

describe("cost estimate", () => {
  it("prices Sonnet 4.6 at $3 in / $15 out per million tokens", () => {
    expect(costUsd("claude-sonnet-4-6", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(3, 9);
    expect(costUsd("claude-sonnet-4-6", { input_tokens: 0, output_tokens: 1_000_000 })).toBeCloseTo(15, 9);
  });

  it("counts cache writes at 1.25x and cache reads at 0.1x", () => {
    const cost = costUsd("claude-sonnet-4-6", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3 * 1.25 + 3 * 0.1, 9);
  });

  it("uses Haiku 5.5's higher rate for prompts over 100K tokens", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 100_000, output_tokens: 10_000 })).toBeCloseTo(0.01 + 0.005, 9);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 200_000, output_tokens: 10_000 })).toBeCloseTo(0.1 + 0.025, 9);
  });

  it("adds web searches and never under-counts unknown models", () => {
    const withSearch = costUsd("claude-sonnet-4-6", {
      input_tokens: 0,
      output_tokens: 0,
      server_tool_use: { web_search_requests: 3 },
    });
    expect(withSearch).toBeCloseTo(3 * WEB_SEARCH_USD, 9);
    expect(isPricedModel("claude-sonnet-4-6")).toBe(true);
    expect(isPricedModel("some-new-model")).toBe(false);
    expect(costUsd("some-new-model", { input_tokens: 1_000_000, output_tokens: 0 })).toBeGreaterThanOrEqual(3);
  });

  it("a typical chat answer costs about a cent on Sonnet 4.6", () => {
    // ~3K tokens of prompt, 600 tokens of answer and thinking.
    const cost = costUsd("claude-sonnet-4-6", { input_tokens: 3000, output_tokens: 600 });
    expect(cost).toBeGreaterThan(0.01);
    expect(cost).toBeLessThan(0.02);
  });
});
