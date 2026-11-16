"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import { BookOpen, Ellipsis, Eye, MessageSquare, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useChatStore } from "@/lib/chat/store";
import { isActivePhase, useBooksStore, type Book } from "@/lib/library/books-store";
import { resumeWithFile, startBook } from "@/lib/library/upload";
import { toFaDigits } from "@/lib/persian";
import { subjectById } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";

export function BookCard({ book, onPreview }: { book: Book; onPreview: (book: Book) => void }) {
  const router = useRouter();
  const subject = subjectById(book.subject);
  const removeLocal = useBooksStore((s) => s.removeLocal);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const running = isActivePhase(book.phase);
  const uploading = book.phase === "uploading";
  const incomplete =
    !running && (uploading || book.pagesDone < book.pageCount || book.failedPages > 0 || (book.status === "error" && book.pagesDone === 0));
  const usable = book.pagesDone > 0;

  const status = running
    ? { label: "در حال پردازش", cls: "bg-primary-soft text-primary" }
    : book.status === "error" && !usable
      ? { label: "ناکام", cls: "bg-danger-soft text-danger" }
      : incomplete
        ? { label: "ناتمام", cls: "bg-[#fff4e0] text-[#b45309]" }
        : { label: "آماده", cls: "bg-success-soft text-success" };

  const resume = async () => {
    if (!book.hasFile) {
      fileRef.current?.click();
      return;
    }
    try {
      await startBook(book.id);
      toast.success("خواندن کتاب در سرور دوباره شروع شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "شروع نشد. دوباره امتحان کنید.");
    }
  };

  const ask = () => {
    updateSettings({ bookIds: [book.id] });
    setActiveChat(null);
    router.push("/");
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    const res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
    if (res.ok) {
      removeLocal(book.id);
      toast.success("کتاب حذف شد.");
    } else {
      toast.error("حذف نشد. دوباره امتحان کنید.");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      className="card group flex flex-col overflow-hidden rounded-3xl"
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void resumeWithFile(book, file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => usable && onPreview(book)}
        className="relative h-36 overflow-hidden text-start"
        style={{ background: `linear-gradient(140deg, ${subject.from}, ${subject.to})` }}
      >
        <div className="absolute -start-6 -top-8 size-32 rounded-full bg-white/15 blur-sm" />
        <div className="absolute -bottom-10 end-4 size-28 rounded-full bg-white/10" />
        <div className="absolute inset-y-0 start-0 w-3 bg-black/10" />
        <div className="relative flex h-full flex-col justify-between p-4 ps-6 text-white">
          <span className="w-fit rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
            {subject.name}
            {book.grade ? ` · صنف ${toFaDigits(book.grade)}` : ""}
          </span>
          <BookOpen className="size-9 opacity-90 transition duration-500 group-hover:rotate-[-8deg] group-hover:scale-110" strokeWidth={1.6} />
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-[15.5px] font-bold leading-7">{book.title}</h3>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="گزینه‌ها">
              <Ellipsis className="size-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="menu-content z-50 min-w-44 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]">
                {usable && (
                  <DropdownMenu.Item onSelect={() => onPreview(book)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">
                    <Eye className="size-4" /> مشاهده متن
                  </DropdownMenu.Item>
                )}
                {incomplete && (
                  <DropdownMenu.Item onSelect={resume} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">
                    <Play className="size-4" /> ادامه پردازش
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  onSelect={() => setConfirmDelete(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-danger-soft"
                >
                  <Trash2 className="size-4" /> حذف کتاب
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", status.cls)}>{status.label}</span>
          <span>
            {toFaDigits(book.pagesDone)} از {toFaDigits(book.pageCount)} صفحه
          </span>
        </div>

        <div className="mt-auto flex gap-2">
          {incomplete ? (
            <button
              type="button"
              onClick={resume}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#f5d9a8] bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-[#b45309] transition hover:brightness-95"
            >
              <Play className="size-4" /> ادامه پردازش
            </button>
          ) : null}
          <button
            type="button"
            disabled={!usable}
            onClick={ask}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary transition hover:bg-[#e3e1ff] disabled:opacity-40"
          >
            <MessageSquare className="size-4" /> سوال از این کتاب
          </button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title="حذف کتاب؟" description={`«${book.title}» و همه متن‌های آن از حافظه هما پاک می‌شود.`} className="max-w-sm">
        <div className="flex gap-2 p-5">
          <button type="button" onClick={doDelete} className="flex-1 rounded-2xl bg-danger px-4 py-2.5 font-semibold text-white hover:brightness-110">
            بله، حذف شود
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-2xl border border-line px-4 py-2.5 hover:bg-surface-2">
            لغو
          </button>
        </div>
      </Dialog>
    </motion.div>
  );
}
