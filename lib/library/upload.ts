"use client";

import { create } from "zustand";
import { useBooksStore, type Book } from "./books-store";

/**
 * Sends book PDFs to the server. The browser only uploads the file; reading the
 * pages happens on the server (lib/server/worker.ts), so the student can close
 * the website once the upload is finished.
 */

export type UploadState = "waiting" | "uploading" | "error";

export interface Upload {
  id: string;
  title: string;
  state: UploadState;
  /** 0..1 */
  progress: number;
  /** The book on the server, once created (hidden from the shelf until uploaded). */
  bookId?: string;
  message?: string;
  order: number;
}

interface UploadsState {
  uploads: Record<string, Upload>;
  set: (id: string, patch: Partial<Upload>) => void;
  remove: (id: string) => void;
}

let orderSeq = 0;

export const useUploads = create<UploadsState>((set) => ({
  uploads: {},
  set: (id, patch) =>
    set((s) => {
      const prev = s.uploads[id];
      const order = prev?.order ?? Date.now() * 1000 + orderSeq++;
      return { uploads: { ...s.uploads, [id]: { ...(prev as Upload), ...patch, id, order } } };
    }),
  remove: (id) =>
    set((s) => {
      const uploads = { ...s.uploads };
      delete uploads[id];
      return { uploads };
    }),
}));

/** True while a file is still being sent (closing the page would lose it). */
export function hasActiveUploads(): boolean {
  return Object.values(useUploads.getState().uploads).some((u) => u.state !== "error");
}

export interface BulkItem {
  file: File;
  title: string;
  subject: string;
  grade: number | null;
}

type ApiError = Error & { status?: number; code?: string };

async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

/** Local server: PUT the raw file, with progress. */
function putLocal(bookId: string, file: File, onProgress: (p: number) => void): Promise<Book> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/books/${bookId}/file`);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data: { book?: Book; message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.book) resolve(data.book);
      else reject(new Error(data.message || "بارگذاری فایل ناکام شد."));
    };
    xhr.onerror = () => reject(new Error("بارگذاری فایل ناکام شد. انترنت خود را بررسی کنید."));
    xhr.send(file);
  });
}

/** Vercel Blob: the file goes straight from the browser to storage. */
async function putBlob(bookId: string, file: File, onProgress: (p: number) => void): Promise<Book> {
  const { upload, uploadPresigned } = await import("@vercel/blob/client");
  // Keyless Blob stores hand out presigned URLs instead of client tokens.
  const send = useBooksStore.getState().blobMode === "keyless" ? uploadPresigned : upload;
  const blob = await send(`books/${bookId}.pdf`, file, {
    access: "public",
    handleUploadUrl: "/api/books/upload",
    contentType: "application/pdf",
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(percentage / 100),
  });
  const { book } = await api<{ book: Book }>(`/api/books/${bookId}`, { method: "PATCH", json: { pdfUrl: blob.url } });
  return book;
}

async function uploadFile(bookId: string, file: File, onProgress: (p: number) => void): Promise<Book> {
  const storage = useBooksStore.getState().storage;
  return storage === "blob" ? putBlob(bookId, file, onProgress) : putLocal(bookId, file, onProgress);
}

/** Asks the server to (re)start reading a book. */
export async function startBook(bookId: string): Promise<Book> {
  const { book } = await api<{ book: Book }>(`/api/books/${bookId}/start`, { method: "POST" });
  useBooksStore.getState().upsertLocal(book);
  useBooksStore.getState().follow(book.id);
  return book;
}

const queue: { id: string; item: BulkItem; forceAi: boolean }[] = [];
let queueRunning = false;

/**
 * Adds one or many books. Each gets a card right away; files are uploaded one
 * after another, and every finished upload is handed to the server worker.
 */
export function addBooks(items: BulkItem[], forceAi: boolean) {
  for (const item of items) {
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    useUploads.getState().set(id, { title: item.title, state: "waiting", progress: 0 });
    queue.push({ id, item, forceAi });
  }
  void runQueue();
}

/** Removes a book that is still waiting for its upload. */
export function cancelQueued(id: string) {
  const index = queue.findIndex((q) => q.id === id);
  if (index >= 0) queue.splice(index, 1);
  useUploads.getState().remove(id);
}

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (queue.length) {
      const next = queue.shift()!;
      if (!useUploads.getState().uploads[next.id]) continue; // cancelled while waiting
      await uploadOne(next.id, next.item, next.forceAi);
    }
  } finally {
    queueRunning = false;
  }
}

async function uploadOne(id: string, item: BulkItem, forceAi: boolean) {
  const uploads = useUploads.getState();
  uploads.set(id, { state: "uploading", progress: 0 });
  let bookId: string | null = null;
  try {
    const created = await api<{ book: Book }>("/api/books", {
      method: "POST",
      json: { title: item.title, subject: item.subject, grade: item.grade, forceAi },
    });
    bookId = created.book.id;
    uploads.set(id, { bookId });
    await uploadFile(bookId, item.file, (p) => uploads.set(id, { progress: p }));
    await startBook(bookId);
    uploads.remove(id);
  } catch (err) {
    console.error("upload failed", err);
    // Don't leave an empty book behind.
    if (bookId) await fetch(`/api/books/${bookId}`, { method: "DELETE" }).catch(() => {});
    const message =
      err instanceof Error && /[؀-ۿ]/.test(err.message) ? err.message : "بارگذاری فایل ناکام شد. دوباره امتحان کنید.";
    uploads.set(id, { state: "error", message });
  } finally {
    void useBooksStore.getState().refresh();
  }
}

/** Gives an existing book its PDF again (old books, or a lost file) and continues reading it. */
export async function resumeWithFile(book: Book, file: File) {
  const uploads = useUploads.getState();
  const id = `re-${book.id}`;
  uploads.set(id, { title: book.title, state: "uploading", progress: 0, bookId: book.id });
  try {
    await uploadFile(book.id, file, (p) => uploads.set(id, { progress: p }));
    await startBook(book.id);
    uploads.remove(id);
  } catch (err) {
    const message = err instanceof Error && /[؀-ۿ]/.test(err.message) ? err.message : "بارگذاری فایل ناکام شد.";
    uploads.set(id, { state: "error", message });
  }
}
