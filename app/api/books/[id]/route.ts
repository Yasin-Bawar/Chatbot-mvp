import { connection } from "next/server";
import { z } from "zod";
import { deleteBook, getBook, updateBook } from "@/lib/server/books-repo";
import { apiError, blobEnabled } from "@/lib/server/http";

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

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subject: z.string().max(40).optional(),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  status: z.enum(["processing", "ready", "error"]).optional(),
  pdfUrl: z.string().url().nullable().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    const book = await updateBook(id, parsed.data);
    if (!book) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ book });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  try {
    const book = await getBook(id);
    if (!book) return Response.json({ ok: true });
    await deleteBook(id);
    if (book.pdfUrl && blobEnabled()) {
      const { del } = await import("@vercel/blob");
      await del(book.pdfUrl).catch((e) => console.error("blob delete failed", e));
    }
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
