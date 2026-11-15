"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { create } from "zustand";
import { useBooksStore, type Book } from "@/lib/library/books-store";
import { assessPageText, cleanExtractedText } from "./quality";
import { getPageText, loadPdf, renderPageJpeg } from "./extract";

export type JobPhase = "queued" | "reading" | "extracting" | "ai" | "done" | "error";

export interface Job {
  bookId: string;
  title: string;
  phase: JobPhase;
  total: number;
  scanned: number; // pages checked by local extraction
  textPages: number; // pages saved from the text layer
  aiTotal: number;
  aiDone: number;
  aiFailed: number;
  message?: string;
  /** Creation order, so cards keep their place when a temp job becomes a real book. */
  order: number;
}

interface JobsState {
  jobs: Record<string, Job>;
  set: (bookId: string, patch: Partial<Job>) => void;
  remove: (bookId: string) => void;
}

let orderSeq = 0;

export const useJobs = create<JobsState>((set) => ({
  jobs: {},
  set: (bookId, patch) =>
    set((s) => {
      const prev = s.jobs[bookId];
      const order = patch.order ?? prev?.order ?? Date.now() * 1000 + orderSeq++;
      return { jobs: { ...s.jobs, [bookId]: { ...(prev as Job), ...patch, order, bookId } } };
    }),
  remove: (bookId) =>
    set((s) => {
      const jobs = { ...s.jobs };
      delete jobs[bookId];
      return { jobs };
    }),
}));

export function hasActiveJobs(): boolean {
  return Object.values(useJobs.getState().jobs).some((j) => j.phase !== "done" && j.phase !== "error");
}

const TEXT_BATCH = 20;
const AI_PAGES_PER_REQUEST = 2;
const AI_CONCURRENCY = 3;

interface PageRow {
  pageNumber: number;
  content: string;
  method: "text" | "ai";
}

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

async function savePages(bookId: string, pages: PageRow[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      await postJson(`/api/books/${bookId}/pages`, { pages });
      return;
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

function expectsArabicScript(subject: string) {
  return subject !== "english" && subject !== "computer";
}

const tempJobId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface BulkItem {
  file: File;
  title: string;
  subject: string;
  grade: number | null;
}

const queue: { jobId: string; item: BulkItem; forceAi: boolean }[] = [];
let queueRunning = false;

/**
 * Adds one or many books. Each gets a "queued" card right away; the books are
 * then processed one after another (gentler on the browser and on the API).
 */
export function addBooks(items: BulkItem[], forceAi: boolean) {
  for (const item of items) {
    const jobId = tempJobId();
    useJobs.getState().set(jobId, {
      title: item.title,
      phase: "queued",
      total: 0,
      scanned: 0,
      textPages: 0,
      aiTotal: 0,
      aiDone: 0,
      aiFailed: 0,
    });
    queue.push({ jobId, item, forceAi });
  }
  void runQueue();
}

/** Removes a book that is still waiting in the queue. */
export function cancelQueued(jobId: string) {
  const index = queue.findIndex((q) => q.jobId === jobId);
  if (index >= 0) queue.splice(index, 1);
  useJobs.getState().remove(jobId);
}

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (queue.length) {
      const next = queue.shift()!;
      if (!useJobs.getState().jobs[next.jobId]) continue; // cancelled while waiting
      try {
        await addBook(next.item.file, { ...next.item, forceAi: next.forceAi }, next.jobId);
      } catch (err) {
        console.error("book failed", err);
      }
    }
  } finally {
    queueRunning = false;
  }
}

/** Adds a new book: creates it, uploads the original (if Blob is set up), extracts all pages. */
export async function addBook(
  file: File,
  meta: { title: string; subject: string; grade: number | null; forceAi: boolean },
  jobId?: string,
): Promise<void> {
  const tempId = jobId ?? tempJobId();
  const jobs = useJobs.getState();
  jobs.set(tempId, { title: meta.title, phase: "reading", total: 0, scanned: 0, textPages: 0, aiTotal: 0, aiDone: 0, aiFailed: 0 });

  let pdf: PDFDocumentProxy;
  let book: Book;
  try {
    pdf = await loadPdf(await file.arrayBuffer());
    const created = await postJson<{ book: Book }>("/api/books", {
      title: meta.title,
      subject: meta.subject,
      grade: meta.grade,
      pageCount: pdf.numPages,
    });
    book = created.book;
  } catch (err) {
    jobs.set(tempId, { phase: "error", message: err instanceof Error && /[؀-ۿ]/.test(err.message) ? err.message : "فایل PDF خوانده نشد. مطمئن شوید فایل خراب نیست." });
    return;
  }
  // The card keeps its place: carry the order over from the temporary job.
  const order = useJobs.getState().jobs[tempId]?.order;
  jobs.remove(tempId);
  jobs.set(book.id, { title: book.title, phase: "reading", total: book.pageCount, scanned: 0, textPages: 0, aiTotal: 0, aiDone: 0, aiFailed: 0, order });
  useBooksStore.getState().upsertLocal(book);

  if (useBooksStore.getState().blob) void uploadOriginal(file, book.id);

  await processPages(book, pdf, { forceAi: meta.forceAi, existing: new Set() });
}

/** Continues a half-processed book (from Blob, or from a re-selected file). */
export async function resumeBook(book: Book, file?: File, opts: { forceAi?: boolean; pages?: number[] } = {}) {
  const jobs = useJobs.getState();
  jobs.set(book.id, { title: book.title, phase: "reading", total: book.pageCount, scanned: 0, textPages: 0, aiTotal: 0, aiDone: 0, aiFailed: 0 });
  try {
    let data: ArrayBuffer;
    if (file) data = await file.arrayBuffer();
    else if (book.pdfUrl) data = await (await fetch(book.pdfUrl)).arrayBuffer();
    else throw new Error("برای ادامه، فایل PDF را دوباره انتخاب کنید.");
    const pdf = await loadPdf(data);

    let existing = new Set<number>();
    if (opts.pages) {
      const wanted = new Set(opts.pages);
      existing = new Set(Array.from({ length: pdf.numPages }, (_, i) => i + 1).filter((n) => !wanted.has(n)));
    } else {
      const res = await fetch(`/api/books/${book.id}/pages?numbers=1`);
      const { numbers } = (await res.json()) as { numbers: number[] };
      existing = new Set(numbers);
    }
    await postJson(`/api/books/${book.id}`, { status: "processing" }, "PATCH");
    await processPages(book, pdf, { forceAi: Boolean(opts.forceAi), existing });
  } catch (err) {
    jobs.set(book.id, { phase: "error", message: err instanceof Error ? err.message : "ادامه ممکن نشد." });
  }
}

async function uploadOriginal(file: File, bookId: string) {
  try {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(`books/${bookId}.pdf`, file, {
      access: "public",
      handleUploadUrl: "/api/books/upload",
      contentType: "application/pdf",
      multipart: file.size > 20 * 1024 * 1024,
    });
    const { book } = await postJson<{ book: Book }>(`/api/books/${bookId}`, { pdfUrl: blob.url }, "PATCH");
    useBooksStore.getState().upsertLocal(book);
  } catch (err) {
    console.warn("Original PDF was not uploaded (optional):", err);
  }
}

async function processPages(book: Book, pdf: PDFDocumentProxy, opts: { forceAi: boolean; existing: Set<number> }) {
  const jobs = useJobs.getState();
  const total = pdf.numPages;
  const todo = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !opts.existing.has(n));
  jobs.set(book.id, {
    title: book.title,
    phase: "extracting",
    total: todo.length,
    scanned: 0,
    textPages: 0,
    aiTotal: 0,
    aiDone: 0,
    aiFailed: 0,
  });

  const expectArabicScript = expectsArabicScript(book.subject);
  const aiQueue: number[] = [];
  let batch: PageRow[] = [];
  let textPages = 0;

  try {
    // Phase 1: fast, free text-layer extraction with quality checks.
    for (let i = 0; i < todo.length; i++) {
      const n = todo[i];
      if (opts.forceAi) {
        aiQueue.push(n);
      } else {
        const raw = await getPageText(pdf, n).catch(() => "");
        const quality = assessPageText(raw, { expectArabicScript });
        if (quality.ok) {
          batch.push({ pageNumber: n, content: cleanExtractedText(raw), method: "text" });
          textPages++;
        } else {
          aiQueue.push(n);
        }
      }
      if (batch.length >= TEXT_BATCH) {
        await savePages(book.id, batch);
        batch = [];
      }
      if (i % 3 === 0 || i === todo.length - 1) {
        jobs.set(book.id, { scanned: i + 1, textPages, aiTotal: aiQueue.length });
      }
    }
    if (batch.length) await savePages(book.id, batch);
    jobs.set(book.id, { scanned: todo.length, textPages, aiTotal: aiQueue.length });

    // Phase 2: pages that need Claude's eyes (scanned / garbled / reversed).
    let aiDone = 0;
    let aiFailed = 0;
    let stopReason: string | null = null;
    if (aiQueue.length) {
      jobs.set(book.id, { phase: "ai" });
      const chunks: number[][] = [];
      for (let i = 0; i < aiQueue.length; i += AI_PAGES_PER_REQUEST) chunks.push(aiQueue.slice(i, i + AI_PAGES_PER_REQUEST));

      let next = 0;
      const worker = async () => {
        while (next < chunks.length && !stopReason) {
          const chunk = chunks[next++];
          try {
            const images = [];
            for (const n of chunk) images.push({ pageNumber: n, image: await renderPageJpeg(pdf, n) });
            await ocrWithRetry(book.id, images);
            aiDone += chunk.length;
          } catch (err) {
            const e = err as Error & { code?: string };
            if (e.code === "no_api_key" || e.code === "db_not_configured") stopReason = e.message;
            aiFailed += chunk.length;
          }
          jobs.set(book.id, { aiDone, aiFailed });
        }
      };
      await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, chunks.length) }, worker));
    }

    const saved = textPages + aiDone;
    const message =
      stopReason ??
      (aiFailed ? `${aiFailed} صفحه خوانده نشد. بعداً «ادامه پردازش» را بزنید.` : undefined);
    await postJson(`/api/books/${book.id}`, { status: saved > 0 || opts.existing.size > 0 ? "ready" : "error" }, "PATCH");
    jobs.set(book.id, { phase: "done", message });
  } catch (err) {
    jobs.set(book.id, { phase: "error", message: err instanceof Error ? err.message : "پردازش متوقف شد." });
    await postJson(`/api/books/${book.id}`, { status: "error" }, "PATCH").catch(() => {});
  } finally {
    void pdf.loadingTask.destroy();
    await useBooksStore.getState().refresh();
  }
}

async function ocrWithRetry(bookId: string, pages: { pageNumber: number; image: string }[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await postJson(`/api/books/${bookId}/ocr`, { pages });
    } catch (err) {
      const e = err as Error & { status?: number };
      if (attempt >= 2 || e.status === 400 || e.status === 404 || e.status === 503) throw err;
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
    }
  }
}
