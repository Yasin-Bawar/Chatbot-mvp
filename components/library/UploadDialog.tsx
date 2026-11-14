"use client";

import { FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { addBook } from "@/lib/pdf/process-book";
import { toFaDigits } from "@/lib/persian";
import { GRADES, SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";

function titleFromFile(name: string) {
  return name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

export function UploadDialog({ file, onClose }: { file: File | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(o) => !o && onClose()}
      title="افزودن کتاب به کتابخانه"
      description="معلومات کتاب را بنویسید تا دانا بهتر بتواند از آن درس بدهد."
    >
      {file && <UploadForm key={file.name + file.size} file={file} onClose={onClose} />}
    </Dialog>
  );
}

function UploadForm({ file, onClose }: { file: File; onClose: () => void }) {
  const [title, setTitle] = useState(titleFromFile(file.name));
  const [subject, setSubject] = useState<string>("riazi");
  const [grade, setGrade] = useState<number | null>(null);
  const [forceAi, setForceAi] = useState(false);

  const size =
    file.size >= 1024 * 1024
      ? `${toFaDigits((file.size / 1024 / 1024).toFixed(1))} میگابایت`
      : `${toFaDigits(Math.max(1, Math.round(file.size / 1024)))} کیلوبایت`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void addBook(file, { title: title.trim(), subject, grade, forceAi });
        onClose();
      }}
      className="grid gap-5 p-5"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
        <FileText className="size-8 shrink-0 text-danger" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" dir="auto">
            {file.name}
          </div>
          <div className="text-xs text-muted">{size}</div>
        </div>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">نام کتاب</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="مثلاً: ریاضی صنف هفتم"
          className="rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none transition focus:border-primary/40 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]"
        />
      </label>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">مضمون</span>
        <div className="flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubject(s.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[13px] transition",
                subject === s.id ? "border-transparent font-semibold text-white shadow-sm" : "border-line bg-surface text-ink-2 hover:border-primary/30",
              )}
              style={subject === s.id ? { background: `linear-gradient(135deg, ${s.from}, ${s.to})` } : undefined}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">صنف</span>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(grade === g ? null : g)}
              className={cn(
                "h-9 rounded-xl border text-sm transition",
                grade === g ? "bg-gradient-brand border-transparent font-bold text-white" : "border-line bg-surface text-ink-2 hover:border-primary/30",
              )}
            >
              {toFaDigits(g)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-gradient-to-l from-[#f5f3ff] to-white p-4">
        <input type="checkbox" checked={forceAi} onChange={(e) => setForceAi(e.target.checked)} className="mt-1 size-4 accent-[#4f46e5]" />
        <span className="grid gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> همه صفحات را هوش مصنوعی بخواند
          </span>
          <span className="text-xs leading-6 text-muted">
            کیفیت بالاتر برای جدول‌ها و فورمول‌ها، اما کندتر و پرمصرف‌تر. در حالت عادی فقط صفحات اسکن‌شده یا خراب با هوش مصنوعی خوانده می‌شوند.
          </span>
        </span>
      </label>

      <button
        type="submit"
        className="bg-gradient-brand rounded-2xl px-4 py-3 font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition hover:brightness-110"
      >
        شروع پردازش کتاب
      </button>
    </form>
  );
}
