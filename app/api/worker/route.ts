import { after, connection } from "next/server";
import { isDbConfigured } from "@/lib/server/db";
import { kickWorker, runWorker } from "@/lib/server/worker";

/**
 * Background book reader. Answers at once and keeps working after the response
 * (Next.js `after`, which runs for the route's maxDuration). When a run ends
 * with work left, it starts the next run itself, so a whole book is read even
 * when nobody has the website open. A daily cron (vercel.json) is a safety net.
 */
export const maxDuration = 300;

function start(req: Request) {
  if (!isDbConfigured()) return Response.json({ error: "db_not_configured" }, { status: 503 });
  const origin = new URL(req.url).origin;
  after(async () => {
    try {
      const result = await runWorker({ budgetMs: Number(process.env.WORKER_BUDGET_MS) || 200_000 });
      if (result.books.length) {
        console.log(`[worker] run finished: ${result.books.map((b) => `${b.id}=${b.outcome}`).join(", ")}`);
      }
      if (result.more && result.books.length) await kickWorker(origin);
    } catch (err) {
      console.error("[worker] run failed", err);
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}

export async function POST(req: Request) {
  return start(req);
}

/** Used by the Vercel cron job. */
export async function GET(req: Request) {
  await connection();
  return start(req);
}
