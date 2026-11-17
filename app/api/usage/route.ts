import { connection } from "next/server";
import { bookBudgetUsd, usageSummary } from "@/lib/server/budget";
import { isDbConfigured } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

/** All estimated usage, with a separate cap for paid book reading only. */
export async function GET() {
  await connection();
  if (!isDbConfigured()) {
    return Response.json({
      configured: false, budgetUsd: null, spentUsd: null, remainingUsd: null, byKind: [],
      books: { budgetUsd: bookBudgetUsd(), spentUsd: null, remainingUsd: null },
    });
  }
  try {
    return Response.json({ configured: true, ...(await usageSummary()) });
  } catch (err) {
    return apiError(err);
  }
}
