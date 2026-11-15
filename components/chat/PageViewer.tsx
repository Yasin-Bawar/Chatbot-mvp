"use client";

import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useBooksStore } from "@/lib/library/books-store";
import { toFaDigits } from "@/lib/persian";
import { Markdown } from "@/components/markdown/Markdown";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

export interface PageTarget {
  bookId: string;
  title: string;
  page: number;
}

/** Shows the stored text of one book page, with prev/next navigation. */
export function PageViewer({
  target,
  onClose,
  canReread = false,
}: {
  target: PageTarget | null;
  onClose: () => void;
  /** Shows a "read this page again with AI" button (books with a stored PDF). */
  canReread?: boolean;
}) {
  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={target ? `📖 ${target.title}` : ""}
      className="max-w-2xl"
    >
      {target && <PageBody key={`${target.bookId}`} target={target} canReread={canReread} />}
    </Dialog>
  );
}

function PageBody({ target, canReread }: { target: PageTarget; canReread: boolean }) {
  const [page, setPage] = useState(target.page);
  const [state, setState] = useState<{ page: number; text: string | null; error?: boolean } | null>(null);
  const [rereading, setRereading] = useState<number | null>(null);
  const book = useBooksStore((s) => s.books.find((b) => b.id === target.bookId));
  const loading = state?.page !== page;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/books/${target.bookId}/pages?from=${page}&to=${page}`)
      .then((r) => r.json())
      .then((data: { pages?: { content: string }[] }) => {
        if (!cancelled) setState({ page, text: data.pages?.[0]?.content ?? null });
      })
      .catch(() => !cancelled && setState({ page, text: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [target.bookId, page]);

  const reread = async () => {
    const n = page;
    setRereading(n);
    try {
      const res = await fetch(`/api/books/${target.bookId}/reread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: n }),
      });
      const data = (await res.json().catch(() => ({}))) as { page?: { content: string }; message?: string };
      if (!res.ok || !data.page) throw new Error(data.message || "خوانده نشد.");
      setState({ page: n, text: data.page.content });
      toast.success(`صفحه ${toFaDigits(n)} دوباره خوانده شد.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خوانده نشد.");
    } finally {
      setRereading(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2.5">
        <button
          type="button"
          onClick={() => setPage((p) => p - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          <ChevronRight className="size-4" /> قبلی
        </button>
        <span className="text-sm font-semibold">صفحه {toFaDigits(page)}</span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={Boolean(book && page >= book.pageCount)}
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          بعدی <ChevronLeft className="size-4" />
        </button>
      </div>
      <div className="min-h-48 px-5 py-4">
        {loading ? (
          <div className="grid h-40 place-items-center text-muted">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : state?.text ? (
          <Markdown text={state.text} className="text-[15px]" />
        ) : (
          <p className="py-10 text-center text-sm text-muted">{state?.error ? "بارگذاری نشد." : "متنی برای این صفحه ذخیره نشده است."}</p>
        )}
      </div>
      {canReread && (
        <button
          type="button"
          onClick={reread}
          disabled={rereading !== null}
          className="mx-5 mb-3 flex items-center justify-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-primary/30 hover:text-primary disabled:opacity-60"
        >
          {rereading === page ? (
            <>
              <LoaderCircle className="size-4 animate-spin" /> <span className="shimmer">در حال خواندن صفحه…</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> خواندن دوباره این صفحه با هوش مصنوعی
            </>
          )}
        </button>
      )}
      {book?.pdfUrl && (
        <a
          href={`${book.pdfUrl}#page=${page}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-5 mb-5 flex items-center justify-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft"
        >
          <ExternalLink className="size-4" /> دیدن صفحه اصلی کتاب (PDF)
        </a>
      )}
    </div>
  );
}
