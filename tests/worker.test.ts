import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Throwaway database and upload folder; Claude is mocked.
process.env.PGLITE_DIR = "memory";
process.env.MOCK_AI = "1";
process.env.AI_BOOK_READING = "1";
process.env.AI_BOOK_BUDGET_USD = "25";
let uploadDir = "";

const repo = await import("@/lib/server/books-repo");
const storage = await import("@/lib/server/storage");
const worker = await import("@/lib/server/worker");

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "dana-uploads-"));
  process.env.UPLOAD_DIR = uploadDir;
});

afterAll(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

/** A small English book: text pages, plus blank pages that need "AI" reading. */
async function makePdf(pages: ("text" | "blank")[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pages.forEach((kind, i) => {
    const page = doc.addPage([400, 500]);
    if (kind === "text") {
      const lines = [
        `Lesson ${i + 1}: Forces and motion`,
        "A force is a push or a pull that can change the motion of an object.",
        "Newton's second law says that force equals mass times acceleration.",
      ];
      lines.forEach((line, j) => page.drawText(line, { x: 20, y: 460 - j * 20, size: 9, font }));
    }
  });
  return doc.save();
}

async function addBook(kinds: ("text" | "blank")[], opts: { forceAi?: boolean } = {}) {
  const book = await repo.createBook({ title: "Physics", subject: "english", grade: 11, forceAi: opts.forceAi });
  const ref = await storage.saveLocalPdf(book.id, await makePdf(kinds));
  await repo.updateBook(book.id, { pdfRef: ref });
  await repo.queueBook(book.id);
  return book.id;
}

async function drain() {
  for (let i = 0; i < 10; i++) {
    const result = await worker.runWorker({ budgetMs: 60_000 });
    if (!result.more) return;
  }
}

describe("background book worker", () => {
  it("reads text pages directly and sends blank/scanned pages to the AI reader", async () => {
    const id = await addBook(["text", "blank", "text", "text", "blank"]);
    await drain();

    const book = (await repo.getBook(id))!;
    expect(book.phase).toBe("done");
    expect(book.status).toBe("ready");
    expect(book.pageCount).toBe(5);
    expect(book.pagesDone).toBe(5);
    expect(book.aiTotal).toBe(2);
    expect(book.aiDone).toBe(2);

    const pages = await repo.getPages(id, 1, 5);
    expect(pages.map((p) => p.method)).toEqual(["text", "ai", "text", "text", "ai"]);
    expect(pages[0].content).toContain("Forces and motion");
  });

  it("stops at the deadline, saves progress and finishes in a later run", async () => {
    const id = await addBook(["text", "text", "text", "blank", "text"]);
    const row = (await repo.claimNextBook(worker.LEASE_SECONDS, 5))!;
    expect(row.id).toBe(id);

    // Deadline already passed: one page is read (always some progress), then the book is handed back.
    expect(await worker.processBook(row, Date.now() - 1)).toBe("paused");
    let book = (await repo.getBook(id))!;
    expect(book.phase).toBe("extracting");
    expect(book.pagesDone).toBe(1);
    expect(book.scanned).toBe(1);
    expect(await repo.hasWaitingWork(2)).toBe(true);

    await drain();
    book = (await repo.getBook(id))!;
    expect(book.phase).toBe("done");
    expect(book.pagesDone).toBe(5);
  });

  it("never gives the same book to two workers", async () => {
    const id = await addBook(["text", "text"]);
    const first = await repo.claimNextBook(worker.LEASE_SECONDS, 5);
    expect(first?.id).toBe(id);
    // While the lease is held, another worker gets nothing.
    expect(await repo.claimNextBook(worker.LEASE_SECONDS, 5)).toBeNull();
    await repo.updateProgress(id, { leaseSeconds: null });
    expect((await repo.claimNextBook(worker.LEASE_SECONDS, 5))?.id).toBe(id);
    await repo.updateProgress(id, { leaseSeconds: null });
    await drain();
    expect((await repo.getBook(id))!.phase).toBe("done");
  });

  it("reads every page with AI when asked to", async () => {
    const id = await addBook(["text", "text", "text"], { forceAi: true });
    await drain();
    const pages = await repo.getPages(id, 1, 3);
    expect(pages.every((p) => p.method === "ai")).toBe(true);
  });

  it("with AI reading off, saves only the free text and skips scanned pages", async () => {
    process.env.AI_BOOK_READING = "0";
    try {
      const id = await addBook(["text", "blank", "text"], { forceAi: true });
      await drain();
      const book = (await repo.getBook(id))!;
      expect(book.phase).toBe("done");
      expect(book.status).toBe("ready");
      expect(book.pagesDone).toBe(2);
      expect(book.failedPages).toBe(1);
      expect(book.error).toContain("خاموش");
      const pages = await repo.getPages(id, 1, 3);
      expect(pages.every((p) => p.method === "text")).toBe(true);
    } finally {
      process.env.AI_BOOK_READING = "1";
    }
  });

  it("reports a missing file instead of retrying forever", async () => {
    const book = await repo.createBook({ title: "No file", subject: "english", grade: 11 });
    await repo.updateBook(book.id, { pdfRef: "local:missing" });
    await repo.queueBook(book.id);
    await drain();
    const after = (await repo.getBook(book.id))!;
    expect(after.phase).toBe("error");
    expect(after.error).toBeTruthy();
    expect(await repo.hasWaitingWork(2)).toBe(false);
  });

  it("a zero book cap blocks queued AI reading even with AI_BOOK_READING=1", async () => {
    process.env.AI_BOOK_BUDGET_USD = "0";
    try {
      const id = await addBook(["text", "blank"], { forceAi: true });
      await drain();
      const book = (await repo.getBook(id))!;
      expect(book.aiDone).toBe(0);
      expect(book.pagesDone).toBe(1);
      expect(book.failedPages).toBe(1);
      expect(await repo.hasWaitingWork(2)).toBe(false);
    } finally {
      process.env.AI_BOOK_BUDGET_USD = "25";
    }
  });
});
