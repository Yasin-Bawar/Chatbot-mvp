import { assessPageText, cleanExtractedText } from "@/lib/pdf/quality";
import {
  claimNextBook,
  getPageNumbers,
  hasWaitingWork,
  updateProgress,
  upsertPages,
  type BookRow,
  type PageRow,
} from "./books-repo";
import { NoApiKeyError, readPagesWithClaude } from "./ocr";
import { openForSlicing, openPdf, pageText, slicePages } from "./pdf";
import { loadPdf } from "./storage";

/**
 * Background book reader. It runs on the server (see app/api/worker/route.ts),
 * so books keep being processed after the student closes the website.
 *
 * Each run works for a limited time, saves its progress in the books table and
 * then hands over to a fresh run. A lease (lease_until) makes sure two runs
 * never read the same book at the same time.
 */

export const LEASE_SECONDS = 300;
export const MAX_ACTIVE_BOOKS = 2;
const TEXT_BATCH = 20;
const AI_PAGES_PER_REQUEST = 2;
const AI_CONCURRENCY = 2;

export interface WorkerResult {
  /** Books this run touched. */
  books: { id: string; outcome: BookOutcome }[];
  /** True when more work is waiting (the caller should start another run). */
  more: boolean;
}

export type BookOutcome = "done" | "paused" | "error";

/**
 * Processes queued books until the time budget is used up.
 * `budgetMs` is the time in which new work may be started; work already
 * started (one Claude request) can run a little longer.
 */
export async function runWorker(opts: { budgetMs?: number } = {}): Promise<WorkerResult> {
  const deadline = Date.now() + (opts.budgetMs ?? 200_000);
  const books: WorkerResult["books"] = [];

  while (Date.now() < deadline) {
    const row = await claimNextBook(LEASE_SECONDS, MAX_ACTIVE_BOOKS);
    if (!row) break;
    let outcome: BookOutcome;
    try {
      outcome = await processBook(row, deadline);
    } catch (err) {
      console.error(`[worker] book ${row.id} failed`, err);
      await updateProgress(row.id, {
        phase: "error",
        status: "error",
        error: "پردازش این کتاب متوقف شد. «ادامه پردازش» را بزنید.",
        leaseSeconds: null,
      }).catch(() => {});
      outcome = "error";
    }
    books.push({ id: row.id, outcome });
    if (outcome === "paused") break; // out of time
  }

  return { books, more: await hasWaitingWork(MAX_ACTIVE_BOOKS) };
}

function expectsArabicScript(subject: string) {
  return subject !== "english" && subject !== "computer";
}

/** Reads one book as far as the deadline allows. */
export async function processBook(row: BookRow, deadline: number): Promise<BookOutcome> {
  const id = row.id;
  if (!row.pdf_url) {
    await updateProgress(id, {
      phase: "error",
      status: "error",
      error: "فایل PDF این کتاب ذخیره نشده است. فایل را دوباره انتخاب کنید.",
      leaseSeconds: null,
    });
    return "error";
  }

  let data: Uint8Array;
  try {
    data = await loadPdf(row.pdf_url);
  } catch (err) {
    console.error(`[worker] could not load PDF of ${id}`, err);
    await updateProgress(id, {
      phase: "error",
      status: "error",
      error: "فایل PDF پیدا نشد. فایل را دوباره انتخاب کنید.",
      leaseSeconds: null,
    });
    return "error";
  }

  const existing = new Set(await getPageNumbers(id));
  const pending = new Set<number>(row.pending_ai ?? []);
  const failed = new Set<number>(row.failed_ai ?? []);
  let scanned = Number(row.scanned ?? 0);
  let pageCount = Number(row.page_count ?? 0);
  let aiDone = Number(row.ai_done ?? 0);

  // ---- Phase 1: text layer (fast and free) ----
  if (row.phase === "queued" || row.phase === "extracting") {
    let pdf: Awaited<ReturnType<typeof openPdf>>;
    try {
      pdf = await openPdf(data);
    } catch (err) {
      console.error(`[worker] unreadable PDF ${id}`, err);
      await updateProgress(id, {
        phase: "error",
        status: "error",
        error: "فایل PDF خوانده نشد. مطمئن شوید فایل خراب نیست.",
        leaseSeconds: null,
      });
      return "error";
    }
    try {
      pageCount = pdf.numPages;
      await updateProgress(id, { phase: "extracting", pageCount, leaseSeconds: LEASE_SECONDS });

      const expectArabic = expectsArabicScript(row.subject);
      let batch: PageRow[] = [];
      const flush = async () => {
        if (batch.length) await upsertPages(id, batch);
        batch = [];
        await updateProgress(id, {
          scanned,
          pendingAi: [...pending].sort((a, b) => a - b),
          aiTotal: aiDone + pending.size,
          leaseSeconds: LEASE_SECONDS,
        });
      };

      const startScanned = scanned;
      while (scanned < pageCount) {
        // Every run reads at least one page, so the chain always moves forward.
        if (scanned > startScanned && Date.now() > deadline) {
          await flush();
          await updateProgress(id, { leaseSeconds: null });
          return "paused";
        }
        const n = scanned + 1;
        if (!existing.has(n) && !pending.has(n)) {
          if (row.force_ai) {
            pending.add(n);
          } else {
            const raw = await pageText(pdf, n).catch(() => "");
            if (assessPageText(raw, { expectArabicScript: expectArabic }).ok) {
              batch.push({ pageNumber: n, content: cleanExtractedText(raw), method: "text" });
              existing.add(n);
            } else {
              pending.add(n);
            }
          }
        }
        scanned = n;
        if (batch.length >= TEXT_BATCH || scanned % 25 === 0) await flush();
      }
      await flush();
    } finally {
      void pdf.loadingTask.destroy();
    }
  }

  // ---- Phase 2: pages Claude has to read (scanned, garbled or reversed text) ----
  // Pages that were saved meanwhile (e.g. re-read by hand) are skipped.
  for (const n of pending) if (existing.has(n) && !row.force_ai) pending.delete(n);
  const aiTotal = aiDone + pending.size;
  await updateProgress(id, {
    phase: pending.size ? "ai" : "extracting",
    pendingAi: [...pending].sort((a, b) => a - b),
    aiTotal,
    leaseSeconds: LEASE_SECONDS,
  });

  let stopMessage: string | null = null;
  if (pending.size) {
    const source = await openForSlicing(data);
    const todo = [...pending].sort((a, b) => a - b);
    const chunks: number[][] = [];
    for (let i = 0; i < todo.length; i += AI_PAGES_PER_REQUEST) chunks.push(todo.slice(i, i + AI_PAGES_PER_REQUEST));

    // Progress writes are chained so the newest state always lands last.
    let saving: Promise<void> = Promise.resolve();
    const save = () => {
      saving = saving
        .then(() =>
          updateProgress(id, {
            aiDone,
            pendingAi: [...pending].sort((a, b) => a - b),
            failedAi: [...failed].sort((a, b) => a - b),
            leaseSeconds: LEASE_SECONDS,
          }),
        )
        .catch((err) => console.error("[worker] progress save failed", err));
      return saving;
    };

    let next = 0;
    let outOfTime = false;
    const lane = async () => {
      while (next < chunks.length && !stopMessage) {
        if (next > 0 && Date.now() > deadline) {
          outOfTime = true;
          return;
        }
        const chunk = chunks[next++];
        try {
          const texts = await readPagesWithClaude(await slicePages(source, chunk), chunk);
          const rows: PageRow[] = chunk
            .filter((n) => texts.get(n)?.trim())
            .map((n) => ({ pageNumber: n, content: texts.get(n)!, method: "ai" as const }));
          await upsertPages(id, rows);
          for (const n of chunk) {
            pending.delete(n);
            if (rows.some((r) => r.pageNumber === n)) {
              aiDone++;
              failed.delete(n);
            } else {
              failed.add(n);
            }
          }
        } catch (err) {
          if (err instanceof NoApiKeyError) {
            stopMessage = err.message;
            return;
          }
          console.error(`[worker] AI read failed for ${id} pages ${chunk.join(",")}`, err);
          for (const n of chunk) {
            pending.delete(n);
            failed.add(n);
          }
        }
        await save();
      }
    };
    await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, chunks.length) }, lane));
    await saving;

    if (outOfTime && !stopMessage && pending.size) {
      await updateProgress(id, { leaseSeconds: null });
      return "paused";
    }
    if (stopMessage) {
      for (const n of pending) failed.add(n);
      pending.clear();
    }
  }

  // ---- Finished ----
  const saved = (await getPageNumbers(id)).length;
  const message = stopMessage ?? (failed.size ? `${failed.size} صفحه خوانده نشد. بعداً «ادامه پردازش» را بزنید.` : null);
  await updateProgress(id, {
    phase: saved > 0 ? "done" : "error",
    status: saved > 0 ? "ready" : "error",
    pageCount,
    scanned: pageCount,
    aiDone,
    pendingAi: [],
    failedAi: [...failed].sort((a, b) => a - b),
    error: saved > 0 ? message : (message ?? "هیچ صفحه‌ای از این کتاب خوانده نشد."),
    leaseSeconds: null,
  });
  return saved > 0 ? "done" : "error";
}

/**
 * Starts a worker run in a new serverless invocation (fire and forget).
 * Used after an upload, and by a run that ran out of time with work left.
 */
export async function kickWorker(origin: string): Promise<void> {
  const headers: Record<string, string> = {};
  // Preview deployments with Vercel protection need this to call themselves.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  try {
    await fetch(`${origin}/api/worker`, { method: "POST", headers, cache: "no-store" });
  } catch (err) {
    console.error("[worker] could not start a worker run", err);
  }
}
