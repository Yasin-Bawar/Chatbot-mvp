import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";
delete process.env.DATABASE_URL;

const repo = await import("@/lib/server/books-repo");
const { runBookTool } = await import("@/lib/server/tools");

let biologyId = "";
let physicsId = "";

beforeAll(async () => {
  const bio = await repo.createBook({ title: "بیولوژی صنف هفتم", subject: "biology", grade: 7, pageCount: 3 });
  const phy = await repo.createBook({ title: "فزیک صنف هشتم", subject: "physics", grade: 8, pageCount: 2 });
  biologyId = bio.id;
  physicsId = phy.id;
  await repo.upsertPages(bio.id, [
    { pageNumber: 1, content: "فهرست مطالب\nفصل اول: حجره\nفصل دوم: فتوسنتز", method: "text" },
    { pageNumber: 2, content: "## فتوسنتز\nنبات‌ها با نور آفتاب، آب و کاربن دای اکساید غذا می‌سازند. کلوروفیل در برگ‌ها نور را جذب می‌کند.", method: "text" },
    { pageNumber: 3, content: "سیستم هاضمه انسان شامل دهن، مری، معده و روده‌ها است.", method: "ai" },
  ]);
  await repo.upsertPages(phy.id, [
    { pageNumber: 1, content: "قانون دوم نیوتن: قوه مساوی است به کتله ضرب تعجیل. $F = ma$", method: "text" },
    { pageNumber: 2, content: "انرژی حرکی و انرژی پوتانسیل", method: "text" },
  ]);
});

describe("library search", () => {
  it("lists books with page counts", async () => {
    const books = await repo.listBooks();
    expect(books.find((b) => b.id === biologyId)?.pagesDone).toBe(3);
  });

  it("ranks the lesson page above the table of contents", async () => {
    const hits = await repo.searchPages("فتوسنتز برگ کلوروفیل");
    expect(hits[0]).toMatchObject({ bookId: biologyId, page: 2 });
  });

  it("matches plural/ZWNJ forms via stemming", async () => {
    const hits = await repo.searchPages("برگها");
    expect(hits.some((h) => h.page === 2 && h.bookId === biologyId)).toBe(true);
  });

  it("respects the book scope", async () => {
    const hits = await repo.searchPages("قانون نیوتن", { bookIds: [biologyId] });
    expect(hits).toHaveLength(0);
    const scoped = await repo.searchPages("قانون نیوتن", { bookIds: [physicsId] });
    expect(scoped[0]?.page).toBe(1);
  });

  it("falls back to prefix matching", async () => {
    const hits = await repo.searchPages("هاضمه");
    expect(hits[0]).toMatchObject({ bookId: biologyId, page: 3 });
  });

  it("search_books tool returns results with sources", async () => {
    const result = await runBookTool("search_books", { query: "سیستم هاضمه" }, []);
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("معده");
    expect(result.sources[0]).toMatchObject({ bookId: biologyId, page: 3 });
  });

  it("read_book_pages tool caps the range and returns full text", async () => {
    const result = await runBookTool("read_book_pages", { book_id: biologyId, start_page: 1, end_page: 50 }, []);
    expect(result.sources.map((s) => s.page)).toEqual([1, 2, 3]);
    expect(result.content).toContain("کلوروفیل");
  });

  it("rejects invalid tool input", async () => {
    const result = await runBookTool("read_book_pages", { book_id: biologyId }, []);
    expect(result.isError).toBe(true);
  });

  it("deletes a book with its pages", async () => {
    await repo.deleteBook(physicsId);
    expect(await repo.getBook(physicsId)).toBeNull();
    expect(await repo.searchPages("نیوتن")).toHaveLength(0);
  });
});
