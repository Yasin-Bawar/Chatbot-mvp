import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Minimal database adapter.
 * - Production (Vercel): Neon Postgres over HTTP when DATABASE_URL is set.
 * - Local development: an embedded Postgres (PGlite) stored in ./.data/pglite,
 *   so the app runs with zero setup.
 */
export interface Db {
  kind: "neon" | "pglite";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'other',
    grade INTEGER,
    page_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing',
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pages (
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    terms TEXT[] NOT NULL DEFAULT '{}',
    method TEXT NOT NULL DEFAULT 'text',
    PRIMARY KEY (book_id, page_number)
  )`,
  `CREATE INDEX IF NOT EXISTS pages_terms_gin ON pages USING GIN (terms)`,
  // Background processing state (books read by the server worker).
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'done'`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS force_ai BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS scanned INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS ai_total INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS ai_done INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS pending_ai INTEGER[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS failed_ai INTEGER[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS error TEXT`,
  `ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
];

/**
 * Connection string from the Vercel Neon integration. The variable name depends on
 * the "Custom Prefix" chosen when connecting the database (DATABASE → DATABASE_URL,
 * default STORAGE → STORAGE_URL), so accept the common names.
 */
function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    undefined
  );
}

/**
 * The library needs a database. On Vercel the filesystem is temporary, so the
 * embedded fallback is only allowed outside Vercel.
 */
export function isDbConfigured(): boolean {
  return Boolean(databaseUrl()) || process.env.VERCEL !== "1";
}

async function createDb(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return {
      kind: "neon",
      async query<T>(text: string, params: unknown[] = []) {
        return (await sql.query(text, params)) as T[];
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  // PGLITE_DIR=memory gives a throwaway in-memory database (used by tests).
  const configured = process.env.PGLITE_DIR;
  let pg: InstanceType<typeof PGlite>;
  if (configured === "memory") {
    pg = new PGlite();
  } else {
    const dir = configured || path.join(process.cwd(), ".data", "pglite");
    mkdirSync(dir, { recursive: true });
    pg = new PGlite(dir);
  }
  await pg.waitReady;
  return {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

// Keep one instance across hot reloads in development.
const globalForDb = globalThis as unknown as { __danaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!isDbConfigured()) {
    return Promise.reject(new DbNotConfiguredError());
  }
  if (!globalForDb.__danaDb) {
    globalForDb.__danaDb = createDb()
      .then(async (db) => {
        for (const statement of SCHEMA) await db.query(statement);
        return db;
      })
      .catch((err) => {
        globalForDb.__danaDb = undefined;
        throw err;
      });
  }
  return globalForDb.__danaDb;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DbNotConfiguredError";
  }
}
