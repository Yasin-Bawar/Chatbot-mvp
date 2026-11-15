import { connection } from "next/server";
import { getBookRow, updateBook } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";
import { deletePdf, isLocalRef, loadPdf, saveLocalPdf, storageKind } from "@/lib/server/storage";

export const maxDuration = 120;

const MAX_BYTES = 300 * 1024 * 1024;

/**
 * Local upload (when the app runs on a computer without Vercel Blob):
 * the browser PUTs the raw PDF here and it is kept in ./.data/uploads.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/books/[id]/file">) {
  const { id } = await ctx.params;
  if (storageKind() !== "local") {
    return Response.json({ error: "local_storage_disabled" }, { status: 400 });
  }
  const size = Number(req.headers.get("content-length") || 0);
  if (size > MAX_BYTES) return Response.json({ error: "too_large", message: "فایل خیلی بزرگ است." }, { status: 413 });
  try {
    const row = await getBookRow(id);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    const data = new Uint8Array(await req.arrayBuffer());
    if (data.length < 5 || new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-") {
      return Response.json({ error: "not_pdf", message: "این فایل PDF نیست." }, { status: 400 });
    }
    const ref = await saveLocalPdf(id, data);
    if (row.pdf_url && row.pdf_url !== ref) await deletePdf(row.pdf_url);
    const book = await updateBook(id, { pdfRef: ref });
    return Response.json({ book });
  } catch (err) {
    return apiError(err);
  }
}

/** Serves a locally stored original PDF. */
export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]/file">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const row = await getBookRow(id);
    if (!row?.pdf_url) return Response.json({ error: "not_found" }, { status: 404 });
    if (!isLocalRef(row.pdf_url)) return Response.redirect(row.pdf_url, 302);
    const data = await loadPdf(row.pdf_url);
    return new Response(data as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${id}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
