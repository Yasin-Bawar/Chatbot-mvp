"use client";

import { AnimatePresence, motion } from "motion/react";
import { CloudUpload, Database, FileStack, HardDrive, Library, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { isActivePhase, useBooksStore, type Book } from "@/lib/library/books-store";
import { hasActiveUploads, useUploads } from "@/lib/library/upload";
import { normalizeFa, toFaDigits } from "@/lib/persian";
import { GRADES, SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { PageViewer, type PageTarget } from "@/components/chat/PageViewer";
import { toast } from "@/components/ui/Toast";
import { BookCard } from "./BookCard";
import { ServerBookCard, UploadCard } from "./ProcessingCard";
import { UploadDialog } from "./UploadDialog";

const MAX_FILES = 30;

export function LibraryScreen() {
  const { books, configured, storage, storageProblem, loaded, error, refresh, followed } = useBooksStore();
  const uploads = useUploads((s) => s.uploads);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [preview, setPreview] = useState<PageTarget | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While the server reads books (or files are uploading), refresh the progress every few seconds.
  const working = books.some((b) => isActivePhase(b.phase)) || Object.keys(uploads).length > 0;
  useEffect(() => {
    if (!working) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [working, refresh]);

  // Warn before leaving only while a file is still uploading (reading continues on the server).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /** Accepts one or many PDFs (non-PDF files are skipped, at most MAX_FILES at once). */
  const pickFiles = (list: FileList | File[] | null | undefined) => {
    const all = Array.from(list ?? []);
    if (!all.length) return;
    const pdfs = all.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const skipped = all.filter((f) => !pdfs.includes(f));
    if (skipped.length) {
      toast.error(`فقط فایل PDF قبول می‌شود. این فایل‌ها کنار گذاشته شدند: ${skipped.map((f) => f.name).join("، ")}`);
    }
    if (pdfs.length > MAX_FILES) {
      toast.info(`در هر بار حداکثر ${toFaDigits(MAX_FILES)} کتاب. ${toFaDigits(MAX_FILES)} کتاب اول انتخاب شد.`);
    }
    if (pdfs.length) setFiles(pdfs.slice(0, MAX_FILES));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFiles(e.dataTransfer.files);
  };

  const filtered = useMemo(() => {
    const q = normalizeFa(query.trim());
    const uploadingIds = new Set(Object.values(uploads).map((u) => u.bookId));
    return books.filter(
      (b) =>
        !uploadingIds.has(b.id) &&
        (!q || normalizeFa(b.title).includes(q)) &&
        (!subject || b.subject === subject) &&
        (!grade || b.grade === grade),
    );
  }, [books, uploads, query, subject, grade]);

  const presentSubjects = SUBJECTS.filter((s) => books.some((b) => b.subject === s.id));
  const totalPages = books.reduce((n, b) => n + b.pagesDone, 0);
  const uploadList = Object.values(uploads).sort((a, b) => a.order - b.order);
  const serverList = books
    .filter((b) => followed.includes(b.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const progressCount = uploadList.length + serverList.length;
  const doneCount = serverList.filter((b) => b.phase === "done").length;
  const current = serverList.find((b) => b.phase === "extracting" || b.phase === "ai");
  const previewBook = preview ? books.find((b) => b.id === preview.bookId) : undefined;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <h1 className="flex items-center gap-3 text-[26px] font-black">
              <span className="bg-gradient-brand grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]">
                <Library className="size-6" />
              </span>
              کتابخانه
            </h1>
            <p className="mt-2 max-w-xl text-[14.5px] leading-7 text-ink-2">
              کتاب‌های درسی مکتب را اضافه کنید. هما متن کامل همه صفحات را می‌خواند، به حافظه می‌سپارد و از روی همین کتاب‌ها درس می‌دهد.
            </p>
          </div>
          {books.length > 0 && (
            <div className="flex gap-2">
              <Stat icon={<Library className="size-4" />} value={toFaDigits(books.length)} label="کتاب" />
              <Stat icon={<FileStack className="size-4" />} value={toFaDigits(totalPages)} label="صفحه در حافظه" />
            </div>
          )}
        </motion.div>

        {!configured ? (
          <div className="card flex items-start gap-4 rounded-3xl p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff4e0] text-[#b45309]">
              <Database className="size-5" />
            </span>
            <div className="text-sm leading-7 text-ink-2">
              <div className="mb-1 text-base font-bold text-ink">پایگاه داده تنظیم نشده است</div>
              برای ذخیره کتاب‌ها روی Vercel، در تنظیمات پروژه یک دیتابیس <b>Neon Postgres</b> اضافه کنید تا متغیر <code dir="ltr">DATABASE_URL</code> ساخته شود. سپس دوباره deploy کنید.
            </div>
          </div>
        ) : storage === "none" ? (
          <div className="card flex items-start gap-4 rounded-3xl p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff4e0] text-[#b45309]">
              <HardDrive className="size-5" />
            </span>
            <div className="text-sm leading-7 text-ink-2">
              <div className="mb-1 text-base font-bold text-ink">فضای ذخیره فایل تنظیم نشده است</div>
              {storageProblem === "store_id_only" ? (
                <>
                  Blob store وصل شده است، ولی این برنامه برای بارگذاری فایل به کلید <code dir="ltr">BLOB_READ_WRITE_TOKEN</code> نیاز دارد. در
                  Vercel صفحه همان Blob store را باز کنید، مقدار <code dir="ltr">BLOB_READ_WRITE_TOKEN</code> را کاپی کنید و در{" "}
                  <b>Settings → Environment Variables</b> پروژه اضافه کنید، سپس دوباره deploy کنید.
                </>
              ) : (
                <>
                  برای اینکه کتاب‌ها حتی با بسته بودن سایت خوانده شوند، فایل PDF باید روی سرور بماند. در Vercel از بخش <b>Storage</b> یک{" "}
                  <b>Blob store</b> بسازید و به این پروژه وصل کنید (متغیر <code dir="ltr">BLOB_READ_WRITE_TOKEN</code>)، سپس دوباره deploy
                  کنید.
                </>
              )}
              {books.length > 0 && <BookGridNote count={books.length} />}
            </div>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
                dragging ? "border-primary bg-primary-soft" : "border-[#d5d3f5] bg-surface/70 hover:border-primary/50 hover:bg-surface",
              )}
            >
              <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(40%_60%_at_20%_100%,rgba(165,180,252,0.25),transparent),radial-gradient(40%_60%_at_80%_0%,rgba(240,171,252,0.2),transparent)]" />
              <motion.span
                animate={dragging ? { scale: 1.12, rotate: -6 } : { scale: 1, rotate: 0 }}
                className="bg-gradient-brand relative grid size-16 place-items-center rounded-3xl text-white shadow-[0_12px_28px_rgba(79,70,229,0.35)] transition group-hover:-translate-y-1"
              >
                <CloudUpload className="size-8" />
              </motion.span>
              <div className="relative">
                <div className="text-[17px] font-bold">یک یا چند فایل PDF کتاب را اینجا رها کنید</div>
                <div className="mt-1 text-sm text-muted">یا کلیک کنید و همه کتاب‌های یک صنف را با هم انتخاب کنید</div>
              </div>
              <div className="relative mt-1 flex flex-wrap justify-center gap-1.5">
                {["ریاضی", "فزیک", "کیمیا", "بیولوژی", "دری", "تاریخ", "…"].map((s) => (
                  <span key={s} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2">
                    {s}
                  </span>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                hidden
                onChange={(e) => {
                  pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </motion.div>

            {progressCount > 1 && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <span className="font-semibold">
                  {toFaDigits(doneCount)} از {toFaDigits(progressCount)} کتاب آماده شد
                </span>
                {current && <span className="text-muted">· در حال خواندن: {current.title}</span>}
              </div>
            )}

            <AnimatePresence>
              {progressCount > 0 && (
                <motion.div layout className="mt-3 grid items-start gap-3 md:grid-cols-2">
                  {serverList.map((book) => (
                    <ServerBookCard key={book.id} book={book} />
                  ))}
                  {uploadList.map((upload) => (
                    <UploadCard key={upload.id} upload={upload} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {books.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <label className="flex min-w-48 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-sm)] sm:flex-none">
                  <Search className="size-4 text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جستجوی کتاب…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
                <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
                  <FilterChip active={!subject} onClick={() => setSubject(null)}>
                    همه
                  </FilterChip>
                  {presentSubjects.map((s) => (
                    <FilterChip key={s.id} active={subject === s.id} onClick={() => setSubject(subject === s.id ? null : s.id)}>
                      {s.name}
                    </FilterChip>
                  ))}
                </div>
                <select
                  value={grade ?? ""}
                  onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-sm)] outline-none"
                >
                  <option value="">همه صنف‌ها</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      صنف {toFaDigits(g)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {filtered.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onPreview={(b: Book) => setPreview({ bookId: b.id, title: b.title, page: 1 })}
                  />
                ))}
              </AnimatePresence>
            </div>

            {loaded && books.length === 0 && progressCount === 0 && (
              <p className="mt-10 text-center text-sm leading-7 text-muted">
                هنوز کتابی اضافه نشده است. اولین کتاب درسی را بالا بیاورید! 📚
              </p>
            )}
            {error && <p className="mt-6 text-center text-sm text-danger">{error}</p>}
          </>
        )}
      </div>

      <PageViewer target={preview} onClose={() => setPreview(null)} canReread={Boolean(previewBook?.hasFile)} />
      <UploadDialog files={files} onClose={() => setFiles([])} />
    </div>
  );
}

function BookGridNote({ count }: { count: number }) {
  return (
    <div className="mt-2 text-muted">
      {toFaDigits(count)} کتابی که قبلاً اضافه شده‌اند، همچنان در گفتگو استفاده می‌شوند.
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
      <span className="text-primary">{icon}</span>
      <span className="text-lg font-black">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-xl border px-3 py-1.5 text-[13px] transition",
        active ? "border-primary/30 bg-primary-soft font-semibold text-primary" : "border-line bg-surface text-ink-2 hover:border-primary/30",
      )}
    >
      {children}
    </button>
  );
}
