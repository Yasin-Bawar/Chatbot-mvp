import { getDb, isDbConfigured } from "./db";
import { costUsd, type BilledUsage } from "./pricing";

/**
 * A spending limit for all Claude API use (chat, chat titles, reading books).
 * Every response's cost is estimated from its token usage and stored in the
 * `ai_usage` table; once the total reaches the budget, new requests are refused
 * with a friendly message. Set AI_BUDGET_USD (default 10; "0" turns it off).
 *
 * This is a safety net inside the app. Also set a spend limit in the Anthropic
 * Console, which the API itself enforces.
 */

export type UsageKind = "chat" | "title" | "book";

export class BudgetExceededError extends Error {
  constructor() {
    super("بودجه هوش مصنوعی این برنامه تمام شده است. لطفاً به مسئول برنامه اطلاع دهید.");
    this.name = "BudgetExceededError";
  }
}

/** The budget in US dollars, or null when there is no limit. */
export function budgetUsd(): number | null {
  const raw = process.env.AI_BUDGET_USD?.trim();
  if (raw === undefined || raw === "") return 10;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function spentUsd(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ spent: number | string | null }>(`SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM ai_usage`);
  return Number(rows[0]?.spent ?? 0);
}

/** Throws BudgetExceededError when the budget is used up. Call before each API request. */
export async function assertBudget(): Promise<void> {
  const budget = budgetUsd();
  if (budget === null || !isDbConfigured()) return;
  let spent: number;
  try {
    spent = await spentUsd();
  } catch (err) {
    // The database is down: don't block teaching because of the meter itself.
    console.error("[budget] could not read spending", err);
    return;
  }
  if (spent >= budget) throw new BudgetExceededError();
}

/** Stores the estimated cost of one response. Never throws. */
export async function recordUsage(kind: UsageKind, model: string, usage: BilledUsage | null | undefined): Promise<void> {
  if (!usage || !isDbConfigured()) return;
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO ai_usage (kind, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, web_searches, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        kind,
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.cache_creation_input_tokens ?? 0,
        usage.cache_read_input_tokens ?? 0,
        usage.server_tool_use?.web_search_requests ?? 0,
        costUsd(model, usage),
      ],
    );
  } catch (err) {
    console.error("[budget] could not record usage", err);
  }
}

/** Spending so far, for the /api/usage page. */
export async function usageSummary() {
  const db = await getDb();
  const rows = await db.query<{ kind: string; requests: number | string; cost: number | string }>(
    `SELECT kind, COUNT(*) AS requests, COALESCE(SUM(cost_usd), 0) AS cost FROM ai_usage GROUP BY kind ORDER BY kind`,
  );
  const byKind = rows.map((r) => ({ kind: r.kind, requests: Number(r.requests), costUsd: round(Number(r.cost)) }));
  const spent = byKind.reduce((sum, r) => sum + r.costUsd, 0);
  const budget = budgetUsd();
  return {
    budgetUsd: budget,
    spentUsd: round(spent),
    remainingUsd: budget === null ? null : round(Math.max(0, budget - spent)),
    byKind,
  };
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;
