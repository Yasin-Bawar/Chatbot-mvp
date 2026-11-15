/**
 * Estimated cost of one Claude API response, from its `usage` numbers.
 * Prices are US dollars per million tokens (Anthropic API list prices,
 * November 2026). Cache writes cost 1.25x the input price, cache reads 0.1x.
 * Pure functions - tested in tests/pricing.test.ts.
 */

interface Price {
  input: number;
  output: number;
  /** Some models charge more when the prompt is longer than this many tokens. */
  longAbove?: number;
  longInput?: number;
  longOutput?: number;
}

const PRICES: Record<string, Price> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longAbove: 100_000, longInput: 0.5, longOutput: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Unknown model: count it as an expensive one, so the budget is never under-counted. */
const UNKNOWN: Price = { input: 5, output: 25 };

/** Web search is billed per search ($10 per 1,000). */
export const WEB_SEARCH_USD = 0.01;

/** The parts of a response's `usage` that are billed. */
export interface BilledUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function isPricedModel(model: string): boolean {
  return model in PRICES;
}

export function costUsd(model: string, usage: BilledUsage): number {
  const price = PRICES[model] ?? UNKNOWN;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const prompt = usage.input_tokens + cacheWrite + cacheRead;
  const long = price.longAbove !== undefined && prompt > price.longAbove;
  const input = long ? (price.longInput ?? price.input) : price.input;
  const output = long ? (price.longOutput ?? price.output) : price.output;
  const tokens = usage.input_tokens * input + cacheWrite * input * 1.25 + cacheRead * input * 0.1 + usage.output_tokens * output;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  return tokens / 1_000_000 + searches * WEB_SEARCH_USD;
}
