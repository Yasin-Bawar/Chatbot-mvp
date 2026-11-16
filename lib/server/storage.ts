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
 * Vercel Blob can be connected in two ways, and both are supported:
 * - "token": a read-write token (BLOB_READ_WRITE_TOKEN).
 * - "keyless": newer stores give only a store id and a webhook public key
 *   (BLOB_STORE_ID, BLOB_WEBHOOK_PUBLIC_KEY); the server then signs in with the
 *   Vercel OIDC token that every Vercel function receives automatically.
 * The Vercel "Connect" dialog can put a custom prefix in front of these names
 * (e.g. MYAPP_BLOB_STORE_ID), so prefixed names are accepted too.
 */
export type BlobMode = "token" | "keyless";

/** First non-empty variable whose name ends with `suffix` (exact name preferred). */
function blobEnv(exact: string, suffix: string, valueCheck: (v: string) => boolean = () => true): string | undefined {
  const direct = process.env[exact]?.trim();
  if (direct && valueCheck(direct)) return direct;
  for (const [name, value] of Object.entries(process.env)) {
    const v = value?.trim();
    if (v && name.includes("BLOB") && name.endsWith(suffix) && valueCheck(v)) return v;
  }
  return undefined;
}

export function blobToken(): string | undefined {
  return blobEnv("BLOB_READ_WRITE_TOKEN", "READ_WRITE_TOKEN", (v) => v.startsWith("vercel_blob_rw_"));
}

export function blobStoreId(): string | undefined {
  return blobEnv("BLOB_STORE_ID", "STORE_ID");
}

export function blobWebhookPublicKey(): string | undefined {
  return blobEnv("BLOB_WEBHOOK_PUBLIC_KEY", "WEBHOOK_PUBLIC_KEY");
}

export function blobMode(): BlobMode | null {
  if (blobToken()) return "token";
  if (blobStoreId() && blobWebhookPublicKey()) return "keyless";
  return null;
}

/** On Vercel without a usable Blob store (shown in the Library's setup notice). */
export function blobSetupProblem(): "missing" | null {
  return blobMode() ? null : "missing";
}

export function storageKind(): StorageKind {
  if (blobMode()) return "blob";
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
    } else if (blobMode()) {
      const { del } = await import("@vercel/blob");
      await del(ref, blobMode() === "token" ? { token: blobToken() } : { storeId: blobStoreId() });
    }
  } catch (err) {
    console.error("could not delete stored PDF", err);
  }
}
