import { connection } from "next/server";
import { z } from "zod";
import { deleteBook, getBook, getBookRow, updateBook } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";
import { deletePdf } from "@/lib/server/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const book = await getBook(id);
    if (!book) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ book });
  } catch (err) {
    return apiError(err);
  }
}

/** Only files uploaded to Vercel Blob may be attached by URL. */
function isBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subject: z.string().max(40).optional(),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  pdfUrl: z.string().url().refine(isBlobUrl).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { pdfUrl, ...rest } = parsed.data;
  try {
    let previous: string | null = null;
    if (pdfUrl) previous = (await getBookRow(id))?.pdf_url ?? null;
    const book = await updateBook(id, { ...rest, ...(pdfUrl ? { pdfRef: pdfUrl } : {}) });
    if (!book) return Response.json({ error: "not_found" }, { status: 404 });
    if (previous && previous !== pdfUrl) await deletePdf(previous);
    return Response.json({ book });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  try {
    const row = await getBookRow(id);
    if (!row) return Response.json({ ok: true });
    await deleteBook(id);
    await deletePdf(row.pdf_url);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
