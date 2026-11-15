import { nanoid } from "nanoid";
import { normalizeFa, queryTerms, tokenizeFa } from "@/lib/persian";
import { getDb } from "./db";
import { isLocalRef } from "./storage";

export type BookStatus = "processing" | "ready" | "error";

/** Where a book is in the background pipeline. */
export type BookPhase = "uploading" | "queued" | "extracting" | "ai" | "done" | "error";

export const ACTIVE_PHASES: BookPhase[] = ["queued", "extracting", "ai"];

export interface Book {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  pageCount: number;
  pagesDone: number;
  status: BookStatus;
  /** Link to open the original PDF (Blob URL, or our own file route for local files). */
  pdfUrl: string | null;
  hasFile: boolean;
  phase: BookPhase;
  scanned: number;
  aiTotal: number;
  aiDone: number;
  failedPages: number;
  error: string | null;
  createdAt: string;
}

export interface PageRow {
  pageNumber: number;
  content: string;
  method: "text" | "ai";
}

export interface SearchHit {
  bookId: string;
  title: string;
  subject: string;
  grade: number | null;
  page: number;
  snippet: string;
  score: number;
}

export interface BookRow {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  page_count: number;
  pages_done?: number | string;
  status: BookStatus;
  pdf_url: string | null;
  phase: BookPhase;
  force_ai: boolean;
  scanned: number;
  ai_total: number;
  ai_done: number;
  pending_ai: number[] | null;
  failed_ai: number[] | null;
  lease_until: string | Date | null;
  error: string | null;
  created_at: string | Date;
}

function toBook(row: BookRow): Book {
  const ref = row.pdf_url;
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade === null ? null : Number(row.grade),
    pageCount: Number(row.page_count),
    pagesDone: Number(row.pages_done ?? 0),
    status: row.status,
    pdfUrl: ref ? (isLocalRef(ref) ? `/api/books/${row.id}/file` : ref) : null,
    hasFile: Boolean(ref),
    phase: row.phase ?? "done",
    scanned: Number(row.scanned ?? 0),
    aiTotal: Number(row.ai_total ?? 0),
    aiDone: Number(row.ai_done ?? 0),
    failedPages: row.failed_ai?.length ?? 0,
    error: row.error ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Raw row (with the storage reference and worker state) for server-side use. */
export async function getBookRow(id: string): Promise<BookRow | null> {
  const db = await getDb();
  const rows = await db.query<BookRow>(`SELECT * FROM books WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

const BOOK_SELECT = `
  SELECT b.*, (SELECT count(*) FROM pages p WHERE p.book_id = b.id) AS pages_done
  FROM books b`;

export async function listBooks(): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.query<BookRow>(`${BOOK_SELECT} ORDER BY b.created_at DESC`);
  return rows.map(toBook);
}

export async function getBook(id: string): Promise<Book | null> {
  const db = await getDb();
  const rows = await db.query<BookRow>(`${BOOK_SELECT} WHERE b.id = $1`, [id]);
  return rows[0] ? toBook(rows[0]) : null;
}

export async function createBook(input: {
  title: string;
  subject: string;
  grade: number | null;
  pageCount?: number;
  forceAi?: boolean;
}): Promise<Book> {
  const db = await getDb();
  const id = nanoid(10);
  await db.query(
    `INSERT INTO books (id, title, subject, grade, page_count, force_ai, phase, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'uploading', 'processing')`,
    [id, input.title, input.subject, input.grade, input.pageCount ?? 0, Boolean(input.forceAi)],
  );
  return (await getBook(id))!;
}

/** Puts a book (back) in the worker queue. Failed AI pages are retried. */
export async function queueBook(id: string): Promise<Book | null> {
  const db = await getDb();
  await db.query(
    `UPDATE books
     SET phase = CASE WHEN phase IN ('extracting', 'ai') THEN phase ELSE 'queued' END,
         status = 'processing',
         error = NULL,
         pending_ai = ARRAY(SELECT DISTINCT x FROM unnest(pending_ai || failed_ai) AS x ORDER BY x),
         failed_ai = '{}',
         lease_until = NULL,
         updated_at = now()
     WHERE id = $1`,
    [id],
  );
  return getBook(id);
}

/** Updates the worker state columns of a book. */
export async function updateProgress(
  id: string,
  patch: Partial<{
    phase: BookPhase;
    status: BookStatus;
    pageCount: number;
    scanned: number;
    aiTotal: number;
    aiDone: number;
    pendingAi: number[];
    failedAi: number[];
    error: string | null;
    leaseSeconds: number | null;
  }>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  if (patch.phase !== undefined) add("phase", patch.phase);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.pageCount !== undefined) add("page_count", patch.pageCount);
  if (patch.scanned !== undefined) add("scanned", patch.scanned);
  if (patch.aiTotal !== undefined) add("ai_total", patch.aiTotal);
  if (patch.aiDone !== undefined) add("ai_done", patch.aiDone);
  if (patch.pendingAi !== undefined) add("pending_ai", patch.pendingAi, "::int[]");
  if (patch.failedAi !== undefined) add("failed_ai", patch.failedAi, "::int[]");
  if (patch.error !== undefined) add("error", patch.error);
  if (patch.leaseSeconds !== undefined) {
    if (patch.leaseSeconds === null) sets.push("lease_until = NULL");
    else {
      params.push(patch.leaseSeconds);
      sets.push(`lease_until = now() + $${params.length} * interval '1 second'`);
    }
  }
  params.push(id);
  await db.query(`UPDATE books SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

/**
 * Takes the next book that needs work and leases it to this worker, so two
 * workers never read the same book. At most `maxActive` books are leased.
 */
export async function claimNextBook(leaseSeconds: number, maxActive: number): Promise<BookRow | null> {
  const db = await getDb();
  const rows = await db.query<BookRow>(
    `UPDATE books SET lease_until = now() + $1 * interval '1 second', updated_at = now()
     WHERE id = (
       SELECT id FROM books
       WHERE phase IN ('queued', 'extracting', 'ai')
         AND (lease_until IS NULL OR lease_until < now())
         AND (SELECT count(*) FROM books b2 WHERE b2.lease_until > now()) < $2
       ORDER BY created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [leaseSeconds, maxActive],
  );
  return rows[0] ?? null;
}

/**
 * True when a book is waiting for the worker (queued, or its lease ran out) and
 * a worker slot is free, i.e. starting a worker run now would do something.
 */
export async function hasWaitingWork(maxActive: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query<{ waiting: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM books
       WHERE phase IN ('queued', 'extracting', 'ai') AND (lease_until IS NULL OR lease_until < now())
     ) AND (SELECT count(*) FROM books WHERE lease_until > now()) < $1 AS waiting`,
    [maxActive],
  );
  return Boolean(rows[0]?.waiting);
}

export async function updateBook(
  id: string,
  patch: Partial<{ title: string; subject: string; grade: number | null; status: BookStatus; pdfRef: string | null }>,
): Promise<Book | null> {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (patch.title !== undefined) add("title", patch.title);
  if (patch.subject !== undefined) add("subject", patch.subject);
  if (patch.grade !== undefined) add("grade", patch.grade);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.pdfRef !== undefined) add("pdf_url", patch.pdfRef);
  if (sets.length) {
    params.push(id);
    await db.query(`UPDATE books SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
  }
  return getBook(id);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM pages WHERE book_id = $1`, [id]);
  await db.query(`DELETE FROM books WHERE id = $1`, [id]);
}

/** Inserts or replaces pages. Search terms are computed here, in TypeScript. */
export async function upsertPages(bookId: string, pages: PageRow[]): Promise<void> {
  if (!pages.length) return;
  const db = await getDb();
  const numbers = pages.map((p) => p.pageNumber);
  const contents = pages.map((p) => p.content);
  const terms = pages.map((p) => tokenizeFa(p.content).slice(0, 4000).join(" "));
  const methods = pages.map((p) => p.method);
  await db.query(
    `INSERT INTO pages (book_id, page_number, content, terms, method)
     SELECT $1, x.n, x.c, CASE WHEN x.t = '' THEN '{}'::text[] ELSE string_to_array(x.t, ' ') END, x.m
     FROM unnest($2::int[], $3::text[], $4::text[], $5::text[]) AS x(n, c, t, m)
     ON CONFLICT (book_id, page_number)
     DO UPDATE SET content = EXCLUDED.content, terms = EXCLUDED.terms, method = EXCLUDED.method`,
    [bookId, numbers, contents, terms, methods],
  );
}

export async function getPages(bookId: string, from: number, to: number): Promise<PageRow[]> {
  const db = await getDb();
  const rows = await db.query<{ page_number: number; content: string; method: "text" | "ai" }>(
    `SELECT page_number, content, method FROM pages
     WHERE book_id = $1 AND page_number BETWEEN $2 AND $3
     ORDER BY page_number`,
    [bookId, from, to],
  );
  return rows.map((r) => ({ pageNumber: Number(r.page_number), content: r.content, method: r.method }));
}

export async function getPageNumbers(bookId: string): Promise<number[]> {
  const db = await getDb();
  const rows = await db.query<{ page_number: number }>(
    `SELECT page_number FROM pages WHERE book_id = $1 ORDER BY page_number`,
    [bookId],
  );
  return rows.map((r) => Number(r.page_number));
}

interface CandidateRow {
  book_id: string;
  page_number: number;
  content: string;
  terms: string[];
  title: string;
  subject: string;
  grade: number | null;
}

/**
 * Keyword search over all pages (or the given books).
 * Candidates come from the GIN-indexed `terms` array; ranking is BM25-style in TS.
 */
export async function searchPages(
  query: string,
  opts: { bookIds?: string[]; limit?: number } = {},
): Promise<SearchHit[]> {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const db = await getDb();
  const limit = opts.limit ?? 6;
  const scope = opts.bookIds?.length ? opts.bookIds : null;

  const select = `SELECT p.book_id, p.page_number, p.content, p.terms, b.title, b.subject, b.grade
    FROM pages p JOIN books b ON b.id = p.book_id`;
  const scopeSql = scope ? ` AND p.book_id = ANY($2::text[])` : "";
  const params: unknown[] = scope ? [terms, scope] : [terms];

  let rows = await db.query<CandidateRow>(
    `${select} WHERE p.terms && $1::text[]${scopeSql} LIMIT 400`,
    params,
  );

  if (!rows.length) {
    // Fallback: prefix match on the longest terms (handles compound words / suffixes).
    const prefixes = terms.slice(0, 3).map((t) => `${t}%`);
    rows = await db.query<CandidateRow>(
      `${select} WHERE EXISTS (SELECT 1 FROM unnest(p.terms) t WHERE t LIKE ANY($1::text[]))${scopeSql} LIMIT 200`,
      scope ? [prefixes, scope] : [prefixes],
    );
  }
  if (!rows.length) return [];

  return rankCandidates(terms, rows).slice(0, limit);
}

/** BM25-style ranking with a bonus for covering more of the query terms. */
export function rankCandidates(terms: string[], rows: CandidateRow[]): SearchHit[] {
  const k1 = 1.4;
  const b = 0.75;
  const n = rows.length;
  const avgLen = rows.reduce((sum, r) => sum + (r.terms?.length ?? 0), 0) / Math.max(1, n) || 1;

  const df = new Map<string, number>();
  for (const term of terms) {
    let count = 0;
    for (const row of rows) {
      if (row.terms?.some((t) => t === term || t.startsWith(term))) count++;
    }
    df.set(term, count);
  }

  const hits: SearchHit[] = rows.map((row) => {
    const len = row.terms?.length ?? 0;
    let score = 0;
    let covered = 0;
    for (const term of terms) {
      const tf = row.terms?.reduce((c, t) => (t === term ? c + 1 : t.startsWith(term) ? c + 0.6 : c), 0) ?? 0;
      if (tf === 0) continue;
      covered++;
      const d = df.get(term) ?? 0;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      score += (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * len) / avgLen));
    }
    score *= 1 + covered / terms.length;
    return {
      bookId: row.book_id,
      title: row.title,
      subject: row.subject,
      grade: row.grade === null ? null : Number(row.grade),
      page: Number(row.page_number),
      snippet: makeSnippet(row.content, terms),
      score,
    };
  });

  return hits.sort((x, y) => y.score - x.score);
}

/** Picks the window of lines with the most query-term hits (~1200 chars). */
export function makeSnippet(content: string, terms: string[], maxChars = 1200): string {
  if (content.length <= maxChars) return content;
  const lines = content.split(/\n+/);
  const scores = lines.map((line) => {
    const normalized = normalizeFa(line);
    return terms.reduce((s, t) => (normalized.includes(t) ? s + 1 : s), 0);
  });
  let best = 0;
  for (let i = 1; i < lines.length; i++) if (scores[i] > scores[best]) best = i;

  let start = best;
  let end = best;
  let size = lines[best].length;
  while (size < maxChars && (start > 0 || end < lines.length - 1)) {
    if (end < lines.length - 1) {
      end++;
      size += lines[end].length + 1;
    }
    if (size < maxChars && start > 0) {
      start--;
      size += lines[start].length + 1;
    }
  }
  const text = lines.slice(start, end + 1).join("\n").slice(0, maxChars + 200);
  return `${start > 0 ? "…\n" : ""}${text}${end < lines.length - 1 ? "\n…" : ""}`;
}
