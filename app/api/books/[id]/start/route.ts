import { after } from "next/server";
import { getBookRow, queueBook } from "@/lib/server/books-repo";
import { apiError } from "@/lib/server/http";
import { kickWorker } from "@/lib/server/worker";

/** Puts a book in the server queue (after upload, or to resume) and wakes the worker. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/start">) {
  const { id } = await ctx.params;
  try {
    const row = await getBookRow(id);
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    if (!row.pdf_url) {
      return Response.json(
        { error: "no_file", message: "فایل PDF این کتاب ذخیره نشده است. فایل را دوباره انتخاب کنید." },
        { status: 409 },
      );
    }
    const book = await queueBook(id);
    const origin = new URL(req.url).origin;
    after(() => kickWorker(origin));
    return Response.json({ book });
  } catch (err) {
    return apiError(err);
  }
}
