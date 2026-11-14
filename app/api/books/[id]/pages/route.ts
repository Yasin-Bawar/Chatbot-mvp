import { connection } from "next/server";
import { z } from "zod";
import { getBook, getPageNumbers, getPages, upsertPages } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";

/**
 * GET ?from=1&to=5  → page texts
 * GET ?numbers=1     → list of page numbers already stored (for resume)
 */
export async function GET(req: Request, ctx: RouteContext<"/api/books/[id]/pages">) {
  await connection();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("numbers")) {
      return Response.json({ numbers: await getPageNumbers(id) });
    }
    const from = Math.max(1, Number(url.searchParams.get("from") ?? 1));
    const to = Math.min(from + 19, Number(url.searchParams.get("to") ?? from));
    return Response.json({ pages: await getPages(id, from, to) });
  } catch (err) {
    return apiError(err);
  }
}

const PostSchema = z.object({
  pages: z
    .array(
      z.object({
        pageNumber: z.number().int().min(1),
        content: z.string().max(60000),
        method: z.enum(["text", "ai"]).default("text"),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/pages">) {
  const { id } = await ctx.params;
  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    const book = await getBook(id);
    if (!book) return Response.json({ error: "not_found" }, { status: 404 });
    await upsertPages(id, parsed.data.pages);
    const updated = await getBook(id);
    return Response.json({ pagesDone: updated?.pagesDone ?? 0 });
  } catch (err) {
    return apiError(err);
  }
}
