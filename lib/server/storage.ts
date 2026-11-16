import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded book PDFs live, so the server can keep reading them after the
 * browser is closed:
 * - Vercel Blob (required on Vercel): the browser uploads directly, we store its URL.
 * - Local disk (running on a computer): ./.data/uploads/<bookId>.pdf, stored as "local:<bookId>".
 */
const LOCAL_PREFIX = "local:";

export type StorageKind = "blob" | "local" | "none";

/**
 * The Vercel Blob read-write token. Usually BLOB_READ_WRITE_TOKEN, but the
 * Vercel "Connect" dialog can add a custom prefix (e.g. MYAPP_BLOB_READ_WRITE_TOKEN),
 * so any *READ_WRITE_TOKEN variable holding a Blob token is accepted.
 */
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (direct) return direct;
  for (const [name, value] of Object.entries(process.env)) {
    const v = value?.trim();
    if (name.endsWith("READ_WRITE_TOKEN") && v?.startsWith("vercel_blob_rw_")) return v;
  }
  return undefined;
}

/**
 * Why Blob is not usable, for the setup notice: no Blob variables at all, or
 * only a store id (keyless OIDC sign-in), which can't issue the browser-upload
 * tokens this app uses - it needs the store's read-write token.
 */
export function blobSetupProblem(): "missing" | "store_id_only" | null {
  if (blobToken()) return null;
  const hasStoreId = Object.keys(process.env).some((name) => name.endsWith("BLOB_STORE_ID") && process.env[name]?.trim());
  return hasStoreId ? "store_id_only" : "missing";
}

export function storageKind(): StorageKind {
  if (blobToken()) return "blob";
  if (process.env.VERCEL !== "1") return "local";
  return "none";
}

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads");
}

function localPath(bookId: string): string {
  if (!/^[\w-]+$/.test(bookId)) throw new Error("bad book id");
  return path.join(uploadDir(), `${bookId}.pdf`);
}

export function isLocalRef(ref: string | null | undefined): boolean {
  return Boolean(ref?.startsWith(LOCAL_PREFIX));
}

/** Saves an uploaded PDF on local disk and returns its storage reference. */
export async function saveLocalPdf(bookId: string, data: Uint8Array): Promise<string> {
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(localPath(bookId), data);
  return `${LOCAL_PREFIX}${bookId}`;
}

/** Reads a stored PDF (local file or Blob URL). */
export async function loadPdf(ref: string): Promise<Uint8Array> {
  if (isLocalRef(ref)) {
    return new Uint8Array(await readFile(localPath(ref.slice(LOCAL_PREFIX.length))));
  }
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function deletePdf(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try {
    if (isLocalRef(ref)) {
      await rm(localPath(ref.slice(LOCAL_PREFIX.length)), { force: true });
    } else if (blobToken()) {
      const { del } = await import("@vercel/blob");
      await del(ref, { token: blobToken() });
    }
  } catch (err) {
    console.error("could not delete stored PDF", err);
  }
}
