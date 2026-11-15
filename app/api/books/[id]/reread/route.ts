import { z } from "zod";
import { friendlyError } from "@/lib/server/anthropic";
import { getBookRow, upsertPages } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";
import { NoApiKeyError, readPagesWithClaude } from "@/lib/server/ocr";
import { openForSlicing, slicePages } from "@/lib/server/pdf";
import { loadPdf } from "@/lib/server/storage";

export const maxDuration = 120;

const BodySchema = z.object({ page: z.number().int().min(1) });

/** Reads one page of a stored book again with Claude (when its text looks wrong). */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/reread">) {
  const { id } = await ctx.params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const { page } = parsed.data;

  let pdfBase64: string;
  try {
    const row = await getBookRow(id);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    if (!row.pdf_url) {
      return Response.json({ error: "no_file", message: "فایل PDF این کتاب ذخیره نشده است." }, { status: 409 });
    }
    const source = await openForSlicing(await loadPdf(row.pdf_url));
    if (page > source.getPageCount()) return Response.json({ error: "invalid_input" }, { status: 400 });
    pdfBase64 = await slicePages(source, [page]);
  } catch (err) {
    return apiError(err);
  }

  try {
    const texts = await readPagesWithClaude(pdfBase64, [page]);
    const content = texts.get(page)?.trim();
    if (!content) return Response.json({ error: "empty", message: "متنی از این صفحه خوانده نشد." }, { status: 502 });
    await upsertPages(id, [{ pageNumber: page, content, method: "ai" }]);
    return Response.json({ page: { pageNumber: page, content } });
  } catch (err) {
    if (err instanceof NoApiKeyError) {
      return Response.json({ error: "no_api_key", message: err.message }, { status: 503 });
    }
    console.error("reread failed", err);
    return Response.json({ error: "ocr_failed", message: friendlyError(err) }, { status: 502 });
  }
}
