import { connection } from "next/server";
import { budgetUsd, usageSummary } from "@/lib/server/budget";
import { isDbConfigured } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

/** How much of the AI budget has been used (estimated from token usage). */
export async function GET() {
  await connection();
  if (!isDbConfigured()) {
    return Response.json({ configured: false, budgetUsd: budgetUsd(), spentUsd: null, remainingUsd: null, byKind: [] });
  }
  try {
    return Response.json({ configured: true, ...(await usageSummary()) });
  } catch (err) {
    return apiError(err);
  }
}
