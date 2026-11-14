"use client";

import { create } from "zustand";
import type { Book } from "@/lib/server/books-repo";

export type { Book };

interface BooksState {
  books: Book[];
  configured: boolean;
  blob: boolean;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsertLocal: (book: Book) => void;
  removeLocal: (id: string) => void;
}

let inflight: Promise<void> | null = null;

/** Shared client cache of the library (used by the Library page and the chat book picker). */
export const useBooksStore = create<BooksState>((set) => ({
  books: [],
  configured: true,
  blob: false,
  loaded: false,
  error: null,
  refresh: () => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch("/api/books", { cache: "no-store" });
        const data = (await res.json()) as { configured?: boolean; blob?: boolean; books?: Book[]; message?: string };
        if (!res.ok) throw new Error(data.message || "خطا در بارگذاری کتابخانه");
        set({ books: data.books ?? [], configured: data.configured !== false, blob: Boolean(data.blob), loaded: true, error: null });
      } catch (err) {
        set({ loaded: true, error: err instanceof Error ? err.message : "خطا" });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
  upsertLocal: (book) =>
    set((s) => {
      const exists = s.books.some((b) => b.id === book.id);
      return { books: exists ? s.books.map((b) => (b.id === book.id ? book : b)) : [book, ...s.books] };
    }),
  removeLocal: (id) => set((s) => ({ books: s.books.filter((b) => b.id !== id) })),
}));
