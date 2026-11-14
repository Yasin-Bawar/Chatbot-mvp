import { connection } from "next/server";
import { z } from "zod";
import { createBook, listBooks } from "@/lib/server/books-repo";
import { isDbConfigured } from "@/lib/server/db";
import { apiError, blobEnabled } from "@/lib/server/http";

export async function GET() {
  await connection();
  if (!isDbConfigured()) {
    return Response.json({ configured: false, blob: blobEnabled(), books: [] });
  }
  try {
    return Response.json({ configured: true, blob: blobEnabled(), books: await listBooks() });
  } catch (err) {
    return apiError(err);
  }
}

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().max(40).default("other"),
  grade: z.number().int().min(1).max(12).nullable().default(null),
  pageCount: z.number().int().min(1).max(5000),
});

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    return Response.json({ book: await createBook(parsed.data) });
  } catch (err) {
    return apiError(err);
  }
}
