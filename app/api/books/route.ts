import { after, connection } from "next/server";
import { z } from "zod";
import { createBook, hasWaitingWork, listBooks } from "@/lib/server/books-repo";
import { isDbConfigured } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { storageKind } from "@/lib/server/storage";
import { kickWorker, MAX_ACTIVE_BOOKS } from "@/lib/server/worker";

// Opening the library also revives a stalled job (e.g. a run that was cut off).
let lastKick = 0;

export async function GET(req: Request) {
  await connection();
  const storage = storageKind();
  if (!isDbConfigured()) {
    return Response.json({ configured: false, storage, blob: storage === "blob", books: [] });
  }
  try {
    const books = await listBooks();
    if (Date.now() - lastKick > 15_000 && (await hasWaitingWork(MAX_ACTIVE_BOOKS))) {
      lastKick = Date.now();
      const origin = new URL(req.url).origin;
      after(() => kickWorker(origin));
    }
    return Response.json({ configured: true, storage, blob: storage === "blob", books });
  } catch (err) {
    return apiError(err);
  }
}

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().max(40).default("other"),
  grade: z.number().int().min(1).max(12).nullable().default(null),
  forceAi: z.boolean().default(false),
});

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  if (storageKind() === "none") {
    return Response.json(
      {
        error: "storage_not_configured",
        message: "برای ذخیره فایل کتاب‌ها، Vercel Blob را به پروژه وصل کنید (BLOB_READ_WRITE_TOKEN).",
      },
      { status: 503 },
    );
  }
  try {
    return Response.json({ book: await createBook(parsed.data) });
  } catch (err) {
    return apiError(err);
  }
}
