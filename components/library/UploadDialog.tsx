"use client";

import { AnimatePresence, motion } from "motion/react";
import { FileText, Sparkles, TriangleAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useBooksStore } from "@/lib/library/books-store";
import { addBooks } from "@/lib/library/upload";
import { normalizeFa, toFaDigits } from "@/lib/persian";
import { cleanTitle, GRADES, guessGrade, guessSubject, SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

const LAST_GRADE_KEY = "dana-last-grade";
const FIRST_DEFAULT_GRADE = 11;

function readLastGrade(): number {
  try {
    const n = Number(localStorage.getItem(LAST_GRADE_KEY));
    return n >= 1 && n <= 12 ? n : FIRST_DEFAULT_GRADE;
  } catch {
    return FIRST_DEFAULT_GRADE;
  }
}

function saveLastGrade(grade: number) {
  try {
    localStorage.setItem(LAST_GRADE_KEY, String(grade));
  } catch {
    // private mode: not important
  }
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${toFaDigits((bytes / 1024 / 1024).toFixed(1))} میگابایت`
    : `${toFaDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

interface Row {
  id: string;
  file: File;
  title: string;
  subject: string;
  subjectGuessed: boolean;
  grade: number | null;
  /** Grade read from the file name — not changed by "grade for all books". */
  gradeFromName: boolean;
}

/** Upload window for one or many PDFs (e.g. all grade 11 books at once). */
export function UploadDialog({ files, onClose }: { files: File[]; onClose: () => void }) {
  const open = files.length > 0;
  const signature = files.map((f) => `${f.name}:${f.size}`).join("|");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={files.length > 1 ? `افزودن ${toFaDigits(files.length)} کتاب به کتابخانه` : "افزودن کتاب به کتابخانه"}
      description="مضمون و صنف از نام فایل حدس زده شده است. لطفاً بررسی کنید و در صورت نیاز تغییر دهید."
      className="max-w-2xl"
    >
      {open && <UploadForm key={signature} files={files} onClose={onClose} />}
    </Dialog>
  );
}

function UploadForm({ files, onClose }: { files: File[]; onClose: () => void }) {
  const [allGrade, setAllGrade] = useState(readLastGrade);
  const [forceAi, setForceAi] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    files.map((file, i) => {
      const subject = guessSubject(file.name);
      const grade = guessGrade(file.name);
      return {
        id: `${i}-${file.name}`,
        file,
        title: cleanTitle(file.name) || file.name,
        subject: subject ?? "other",
        subjectGuessed: Boolean(subject),
        grade: grade ?? readLastGrade(),
        gradeFromName: grade !== null,
      };
    }),
  );
  const books = useBooksStore((s) => s.books);
  const existingTitles = useMemo(() => new Set(books.map((b) => normalizeFa(b.title).trim())), [books]);

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    if (!next.length) onClose();
    else setRows(next);
  };
  const setGradeForAll = (grade: number) => {
    setAllGrade(grade);
    setRows((rs) => rs.map((r) => (r.gradeFromName ? r : { ...r, grade })));
  };

  const valid = rows.length > 0 && rows.every((r) => r.title.trim());

  const submit = () => {
    if (!valid) return;
    saveLastGrade(allGrade);
    addBooks(
      rows.map((r) => ({ file: r.file, title: r.title.trim(), subject: r.subject, grade: r.grade })),
      forceAi,
    );
    toast.success(
      rows.length > 1
        ? `${toFaDigits(rows.length)} کتاب در حال بارگذاری است. بعد از بارگذاری، سرور آن‌ها را می‌خواند؛ لازم نیست صفحه باز بماند.`
        : "کتاب در حال بارگذاری است. بعد از بارگذاری، سرور آن را می‌خواند؛ لازم نیست صفحه باز بماند.",
    );
    onClose();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col"
    >
      <div className="grid gap-5 p-5">
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">{rows.length > 1 ? "صنف همه کتاب‌ها" : "صنف"}</span>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeForAll(g)}
                className={cn(
                  "h-10 rounded-xl border text-sm transition",
                  allGrade === g ? "bg-gradient-brand border-transparent font-bold text-white" : "border-line bg-surface text-ink-2 hover:border-primary/30",
                )}
              >
                {toFaDigits(g)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2.5">
          <span className="text-sm font-semibold">
            کتاب‌ها <span className="font-normal text-muted">({toFaDigits(rows.length)})</span>
          </span>
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const duplicate = existingTitles.has(normalizeFa(row.title).trim());
              return (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: -10 }}
                  className="grid gap-2.5 rounded-2xl border border-line bg-surface-2/60 p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <FileText className="size-4 shrink-0 text-danger" />
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {row.file.name}
                    </span>
                    <span className="shrink-0">{formatSize(row.file.size)}</span>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
                      aria-label="حذف از فهرست"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <input
                    value={row.title}
                    onChange={(e) => update(row.id, { title: e.target.value })}
                    placeholder="نام کتاب، مثلاً: فزیک صنف یازدهم"
                    aria-label="نام کتاب"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none transition focus:border-primary/40 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={row.subject}
                      onChange={(e) => update(row.id, { subject: e.target.value, subjectGuessed: true })}
                      aria-label="مضمون"
                      className={cn(
                        "rounded-xl border bg-surface px-3 py-2.5 text-sm outline-none",
                        row.subjectGuessed ? "border-line" : "border-[#f5c46b]",
                      )}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.grade ?? ""}
                      onChange={(e) =>
                        update(row.id, { grade: e.target.value ? Number(e.target.value) : null, gradeFromName: true })
                      }
                      aria-label="صنف"
                      className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">بدون صنف</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          صنف {toFaDigits(g)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(!row.subjectGuessed || duplicate) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#b45309]">
                      {!row.subjectGuessed && (
                        <span className="flex items-center gap-1">
                          <TriangleAlert className="size-3.5" /> مضمون از نام فایل معلوم نشد؛ لطفاً انتخاب کنید.
                        </span>
                      )}
                      {duplicate && (
                        <span className="flex items-center gap-1">
                          <TriangleAlert className="size-3.5" /> کتابی با همین نام قبلاً اضافه شده است.
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
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
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface/95 p-4 backdrop-blur">
        <button
          type="submit"
          disabled={!valid}
          className="bg-gradient-brand w-full rounded-2xl px-4 py-3 font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition hover:brightness-110 disabled:opacity-50"
        >
          {rows.length > 1 ? `شروع پردازش ${toFaDigits(rows.length)} کتاب` : "شروع پردازش کتاب"}
        </button>
        {rows.length > 1 && (
          <p className="mt-2 text-center text-xs text-muted">کتاب‌ها یکی پس از دیگری خوانده می‌شوند. تا پایان، صفحه کتابخانه را باز نگه دارید.</p>
        )}
      </div>
    </form>
  );
}
