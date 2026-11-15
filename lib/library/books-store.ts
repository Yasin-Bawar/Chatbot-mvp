"use client";

import { create } from "zustand";
import type { Book, BookPhase } from "@/lib/server/books-repo";

export type { Book, BookPhase };

export type StorageKind = "blob" | "local" | "none";

/** Phases in which the server is (or will soon be) reading the book. */
export function isActivePhase(phase: BookPhase): boolean {
  return phase === "queued" || phase === "extracting" || phase === "ai";
}

interface BooksState {
  books: Book[];
  configured: boolean;
  storage: StorageKind;
  loaded: boolean;
  error: string | null;
  /** Books whose progress card is shown (started or seen working in this visit). */
  followed: string[];
  refresh: () => Promise<void>;
  upsertLocal: (book: Book) => void;
  removeLocal: (id: string) => void;
  follow: (id: string) => void;
  unfollow: (id: string) => void;
}

let inflight: Promise<void> | null = null;

/** Shared client cache of the library (used by the Library page and the chat book picker). */
export const useBooksStore = create<BooksState>((set, get) => ({
  books: [],
  configured: true,
  storage: "local",
  loaded: false,
  error: null,
  followed: [],
  refresh: () => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch("/api/books", { cache: "no-store" });
        const data = (await res.json()) as { configured?: boolean; storage?: StorageKind; books?: Book[]; message?: string };
        if (!res.ok) throw new Error(data.message || "خطا در بارگذاری کتابخانه");
        const books = data.books ?? [];
        // Follow books the server is working on, so their progress is visible.
        const followed = new Set(get().followed);
        for (const b of books) if (isActivePhase(b.phase)) followed.add(b.id);
        set({
          books,
          configured: data.configured !== false,
          storage: data.storage ?? "local",
          loaded: true,
          error: null,
          followed: [...followed].filter((id) => books.some((b) => b.id === id)),
        });
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
  removeLocal: (id) => set((s) => ({ books: s.books.filter((b) => b.id !== id), followed: s.followed.filter((x) => x !== id) })),
  follow: (id) => set((s) => (s.followed.includes(id) ? s : { followed: [...s.followed, id] })),
  unfollow: (id) => set((s) => ({ followed: s.followed.filter((x) => x !== id) })),
}));
