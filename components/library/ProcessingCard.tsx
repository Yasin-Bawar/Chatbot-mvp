"use client";

import { motion } from "motion/react";
import { Check, CircleX, Clock3, CloudUpload, LoaderCircle, Server, Sparkles, X } from "lucide-react";
import { useBooksStore, type Book } from "@/lib/library/books-store";
import { cancelQueued, useUploads, type Upload } from "@/lib/library/upload";
import { toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

function Step({ state, label, detail }: { state: "todo" | "active" | "done"; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border transition",
          state === "done" && "border-transparent bg-success text-white",
          state === "active" && "border-primary/30 bg-primary-soft text-primary",
          state === "todo" && "border-line text-muted",
        )}
      >
        {state === "done" ? (
          <Check className="size-4" />
        ) : state === "active" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <span
        className={cn("text-sm", state === "active" ? "shimmer font-semibold" : state === "done" ? "text-ink" : "text-muted")}
      >
        {label}
      </span>
      {detail && <span className="ms-auto whitespace-nowrap text-xs tabular-nums text-muted">{detail}</span>}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#eceaff]">
      <motion.div
        className="bg-gradient-brand h-full rounded-full"
        initial={false}
        animate={{ width: `${Math.max(3, Math.min(100, value * 100))}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
      />
    </div>
  );
}

const cardMotion = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
} as const;

/** Progress of a book that the server is reading (keeps going with the page closed). */
export function ServerBookCard({ book }: { book: Book }) {
  const unfollow = useBooksStore((s) => s.unfollow);
  const { phase } = book;
  const finished = phase === "done" || phase === "error";
  const failed = phase === "error";
  const extractDone = phase === "ai" || phase === "done";
  const total = Math.max(1, book.pageCount);
  const progress =
    phase === "queued"
      ? 0.04
      : phase === "extracting"
        ? 0.04 + (book.scanned / total) * (book.aiTotal ? 0.46 : 0.96)
        : phase === "ai"
          ? 0.5 + (book.aiDone / Math.max(1, book.aiTotal)) * 0.5
          : 1;

  return (
    <motion.div {...cardMotion} className="card rounded-3xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-2xl text-white",
            failed ? "bg-danger" : phase === "done" ? "bg-success" : "bg-gradient-brand",
          )}
        >
          {failed ? (
            <CircleX className="size-5" />
          ) : phase === "done" ? (
            <Check className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{book.title}</div>
          <div className="text-xs text-muted">
            {phase === "done"
              ? "آماده است! همای سعادت (۲) حالا از این کتاب درس می‌دهد. ✨"
              : failed
                ? "پردازش ناکام شد"
                : phase === "queued"
                  ? "در صف سرور — به‌زودی شروع می‌شود"
                  : "در حال خواندن کتاب…"}
          </div>
        </div>
        {finished && (
          <button
            type="button"
            onClick={() => unfollow(book.id)}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
            aria-label="بستن"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <Bar value={progress} />

      <div className="mt-4 grid gap-2.5">
        <Step state="done" label="بارگذاری فایل PDF" />
        <Step
          state={phase === "extracting" ? "active" : extractDone ? "done" : "todo"}
          label="استخراج متن صفحات"
          detail={
            book.pageCount ? `${toFaDigits(Math.min(book.scanned, book.pageCount))} / ${toFaDigits(book.pageCount)}` : undefined
          }
        />
        {(book.aiTotal > 0 || phase === "ai") && (
          <Step
            state={phase === "ai" ? "active" : phase === "done" ? "done" : "todo"}
            label="خواندن صفحات اسکن‌شده با هوش مصنوعی"
            detail={`${toFaDigits(book.aiDone)} / ${toFaDigits(book.aiTotal)}`}
          />
        )}
        <Step state={phase === "done" ? "done" : "todo"} label="ذخیره در حافظه همای سعادت (۲)" />
      </div>

      {!finished && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-2.5 text-[13px] leading-6 text-success">
          <Server className="size-4 shrink-0" />
          پردازش در سرور ادامه دارد؛ می‌توانید این صفحه را ببندید ✓
        </p>
      )}
      {finished && book.error && (
        <p
          className={cn(
            "mt-4 rounded-2xl px-4 py-2.5 text-sm leading-7",
            failed ? "bg-danger-soft text-[#9f1d22]" : "bg-[#fff7e6] text-[#92400e]",
          )}
        >
          {book.error}
        </p>
      )}
    </motion.div>
  );
}

/** A file that is still being sent from this browser (or waiting for its turn). */
export function UploadCard({ upload }: { upload: Upload }) {
  const remove = useUploads((s) => s.remove);

  if (upload.state === "waiting") {
    return (
      <motion.div {...cardMotion} className="card flex items-center gap-3 rounded-3xl p-4 opacity-80">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Clock3 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{upload.title}</div>
          <div className="text-xs text-muted">در صف بارگذاری — منتظر نوبت</div>
        </div>
        <button
          type="button"
          onClick={() => cancelQueued(upload.id)}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-danger-soft hover:text-danger"
          aria-label="حذف از صف"
          title="حذف از صف"
        >
          <X className="size-4" />
        </button>
      </motion.div>
    );
  }

  const failed = upload.state === "error";
  return (
    <motion.div {...cardMotion} className="card rounded-3xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn("grid size-10 place-items-center rounded-2xl text-white", failed ? "bg-danger" : "bg-gradient-brand")}
        >
          {failed ? <CircleX className="size-5" /> : <CloudUpload className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{upload.title}</div>
          <div className="text-xs text-muted">
            {failed ? "بارگذاری ناکام شد" : `در حال بارگذاری… ${toFaDigits(Math.round(upload.progress * 100))}٪`}
          </div>
        </div>
        {failed && (
          <button
            type="button"
            onClick={() => remove(upload.id)}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
            aria-label="بستن"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Bar value={failed ? 0 : upload.progress} />
      {failed ? (
        upload.message && (
          <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-2.5 text-sm leading-7 text-[#9f1d22]">{upload.message}</p>
        )
      ) : (
        <p className="mt-4 rounded-2xl bg-[#fff7e6] px-4 py-2.5 text-[13px] leading-6 text-[#92400e]">
          تا پایان بارگذاری این صفحه را باز نگه دارید. بعد از آن، خواندن کتاب در سرور ادامه پیدا می‌کند.
        </p>
      )}
    </motion.div>
  );
}
