import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SourceRef } from "@/lib/stream-protocol";
import { toFaDigits } from "@/lib/persian";
import { getBook, getPages, searchPages } from "./books-repo";

type BetaTool = Anthropic.Beta.BetaTool;

export const BOOK_TOOLS: BetaTool[] = [
  {
    name: "search_books",
    description:
      "Search the uploaded Afghan school textbooks by keywords. Returns the best matching pages with book title, page number and a text snippet. Search in Dari/Pashto/English with the key words of the topic (e.g. «فتوسنتز», «قانون دوم نیوتن», «معادله درجه دوم»).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for, in the language of the book." },
        book_id: { type: "string", description: "Optional: limit the search to one book id from the catalog." },
      },
      required: ["query"],
    },
    eager_input_streaming: true,
  },
  {
    name: "read_book_pages",
    description:
      "Read the full text of consecutive pages of one book (at most 5 pages per call). Use it to read a whole lesson after search_books found the right place.",
    input_schema: {
      type: "object",
      properties: {
        book_id: { type: "string", description: "Book id from the catalog or from search results." },
        start_page: { type: "integer", description: "First page number to read." },
        end_page: { type: "integer", description: "Last page number to read (at most start_page + 4)." },
      },
      required: ["book_id", "start_page", "end_page"],
    },
    eager_input_streaming: true,
  },
];

const SearchInput = z.object({ query: z.string().min(1), book_id: z.string().optional() });
const ReadInput = z.object({
  book_id: z.string().min(1),
  start_page: z.coerce.number().int().min(1),
  end_page: z.coerce.number().int().min(1),
});

export interface ToolRunResult {
  content: string;
  isError?: boolean;
  sources: SourceRef[];
}

/** Short Dari label for the status chip shown while a tool runs. */
export function toolLabel(name: string, input: unknown): string {
  const data = (input ?? {}) as Record<string, unknown>;
  if (name === "search_books") {
    const q = typeof data.query === "string" ? data.query : "";
    return q ? `جستجو در کتاب‌ها: «${q}»` : "جستجو در کتاب‌ها…";
  }
  if (name === "read_book_pages") {
    const s = Number(data.start_page);
    const e = Number(data.end_page);
    return Number.isFinite(s) && Number.isFinite(e)
      ? `خواندن صفحه ${toFaDigits(s)} تا ${toFaDigits(e)}`
      : "خواندن صفحات کتاب…";
  }
  return "جستجو در انترنت…";
}

export async function runBookTool(
  name: string,
  input: unknown,
  scopeBookIds: string[],
): Promise<ToolRunResult> {
  try {
    if (name === "search_books") {
      const parsed = SearchInput.safeParse(input);
      if (!parsed.success) return { content: "Invalid input: query is required.", isError: true, sources: [] };
      let bookIds = scopeBookIds;
      if (parsed.data.book_id) {
        bookIds = scopeBookIds.length && !scopeBookIds.includes(parsed.data.book_id) ? scopeBookIds : [parsed.data.book_id];
      }
      const hits = await searchPages(parsed.data.query, { bookIds, limit: 6 });
      if (!hits.length) {
        return { content: "No matching pages found. Try other keywords (synonyms, singular form) or answer from general knowledge.", sources: [] };
      }
      const text = hits
        .map(
          (h) =>
            `<result book_id="${h.bookId}" book="${h.title}" page="${h.page}">\n${h.snippet}\n</result>`,
        )
        .join("\n\n");
      return {
        content: text,
        sources: hits.map((h) => ({ bookId: h.bookId, title: h.title, page: h.page })),
      };
    }

    if (name === "read_book_pages") {
      const parsed = ReadInput.safeParse(input);
      if (!parsed.success) return { content: "Invalid input: book_id, start_page and end_page are required.", isError: true, sources: [] };
      const { book_id, start_page } = parsed.data;
      if (scopeBookIds.length && !scopeBookIds.includes(book_id)) {
        return { content: "This book is outside the books the student selected.", isError: true, sources: [] };
      }
      const end = Math.min(Math.max(parsed.data.end_page, start_page), start_page + 4);
      const book = await getBook(book_id);
      if (!book) return { content: `Book ${book_id} not found.`, isError: true, sources: [] };
      const pages = await getPages(book_id, start_page, end);
      if (!pages.length) return { content: `No text stored for pages ${start_page}-${end}.`, sources: [] };
      const text = pages
        .map((p) => `<page book="${book.title}" number="${p.pageNumber}">\n${p.content}\n</page>`)
        .join("\n\n");
      return {
        content: text,
        sources: pages.map((p) => ({ bookId: book.id, title: book.title, page: p.pageNumber })),
      };
    }

    return { content: `Unknown tool ${name}`, isError: true, sources: [] };
  } catch (err) {
    console.error("tool error", name, err);
    return { content: "The library is not available right now.", isError: true, sources: [] };
  }
}
