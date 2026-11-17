import { getDb, isDbConfigured } from "./db";
import { costUsd, type BilledUsage } from "./pricing";

/**
 * Track all Claude usage, but limit only AI book reading. Chat and titles have
 * no app-level cap. AI_BOOK_BUDGET_USD is a cumulative book-only allowance;
 * its default of 0 pauses paid book reading, including existing deployments.
 * The old shared AI_BUDGET_USD setting is intentionally ignored.
 *
 * This is a safety net inside the app. Also set a spend limit in the Anthropic
 * Console, which the API itself enforces.
 */

export type UsageKind = "chat" | "title" | "book";

export class BudgetExceededError extends Error {
  constructor() {
    super("خواندن کتاب با هوش مصنوعی متوقف است؛ بودجه کتاب‌ها تمام شده یا تعیین نشده است. گفتگو همچنان فعال است.");
    this.name = "BudgetExceededError";
  }
}

/** Zero (also missing/invalid configuration) pauses paid book reading. */
export function bookBudgetUsd(): number {
  const value = Number(process.env.AI_BOOK_BUDGET_USD?.trim());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function spentUsd(kind?: UsageKind): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ spent: number | string | null }>(
    `SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM ai_usage${kind ? " WHERE kind = $1" : ""}`,
    kind ? [kind] : [],
  );
  return Number(rows[0]?.spent ?? 0);
}

/** Call before every paid book request; never allow unmetered book reading. */
export async function assertBookBudget(): Promise<void> {
  const budget = bookBudgetUsd();
  if (budget === 0 || !isDbConfigured()) throw new BudgetExceededError();
  let spent: number;
  try {
    spent = await spentUsd("book");
  } catch (err) {
    // If spending cannot be checked, pause books. Chat has no budget check.
    console.error("[budget] could not read spending", err);
    throw new BudgetExceededError();
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
  const budget = bookBudgetUsd();
  const bookSpent = byKind.find((r) => r.kind === "book")?.costUsd ?? 0;
  return {
    budgetUsd: null,
    spentUsd: round(spent),
    remainingUsd: null,
    books: {
      budgetUsd: budget,
      spentUsd: bookSpent,
      remainingUsd: round(Math.max(0, budget - bookSpent)),
    },
    byKind,
  };
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;
