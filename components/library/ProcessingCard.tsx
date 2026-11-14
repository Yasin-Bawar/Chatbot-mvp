"use client";

import { motion } from "motion/react";
import { Check, CircleX, LoaderCircle, Sparkles, X } from "lucide-react";
import type { Job } from "@/lib/pdf/process-book";
import { useJobs } from "@/lib/pdf/process-book";
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
        {state === "done" ? <Check className="size-4" /> : state === "active" ? <LoaderCircle className="size-4 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={cn("text-sm", state === "active" ? "shimmer font-semibold" : state === "done" ? "text-ink" : "text-muted")}>{label}</span>
      {detail && <span className="ms-auto text-xs tabular-nums text-muted">{detail}</span>}
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

export function ProcessingCard({ job }: { job: Job }) {
  const remove = useJobs((s) => s.remove);
  const extractDone = job.phase === "ai" || job.phase === "done";
  const progress =
    job.phase === "reading"
      ? 0.03
      : job.phase === "extracting"
        ? (job.scanned / Math.max(1, job.total)) * (job.aiTotal ? 0.5 : 1)
        : job.phase === "ai"
          ? 0.5 + ((job.aiDone + job.aiFailed) / Math.max(1, job.aiTotal)) * 0.5
          : 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="card rounded-3xl p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-2xl text-white",
            job.phase === "error" ? "bg-danger" : job.phase === "done" ? "bg-success" : "bg-gradient-brand",
          )}
        >
          {job.phase === "error" ? <CircleX className="size-5" /> : job.phase === "done" ? <Check className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{job.title}</div>
          <div className="text-xs text-muted">
            {job.phase === "done" ? "آماده است! دانا حالا از این کتاب درس می‌دهد. ✨" : job.phase === "error" ? "پردازش ناکام شد" : "تا پایان پردازش این صفحه را نبندید."}
          </div>
        </div>
        {(job.phase === "done" || job.phase === "error") && (
          <button type="button" onClick={() => remove(job.bookId)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="بستن">
            <X className="size-4" />
          </button>
        )}
      </div>

      <Bar value={progress} />

      <div className="mt-4 grid gap-2.5">
        <Step state={job.phase === "reading" ? "active" : "done"} label="خواندن فایل PDF" />
        <Step
          state={job.phase === "extracting" ? "active" : extractDone ? "done" : "todo"}
          label="استخراج متن صفحات"
          detail={job.total ? `${toFaDigits(job.scanned)} / ${toFaDigits(job.total)}` : undefined}
        />
        {(job.aiTotal > 0 || job.phase === "ai") && (
          <Step
            state={job.phase === "ai" ? "active" : job.phase === "done" ? "done" : "todo"}
            label="خواندن صفحات اسکن‌شده با هوش مصنوعی"
            detail={`${toFaDigits(job.aiDone)} / ${toFaDigits(job.aiTotal)}`}
          />
        )}
        <Step state={job.phase === "done" ? "done" : "todo"} label="ذخیره در حافظه دانا" />
      </div>

      {job.message && (
        <p className={cn("mt-4 rounded-2xl px-4 py-2.5 text-sm leading-7", job.phase === "error" ? "bg-danger-soft text-[#9f1d22]" : "bg-[#fff7e6] text-[#92400e]")}>
          {job.message}
        </p>
      )}
    </motion.div>
  );
}
