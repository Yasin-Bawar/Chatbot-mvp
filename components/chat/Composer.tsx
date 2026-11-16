"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, FileText, Globe, Lightbulb, ListChecks, Paperclip, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { attachmentSrc, fileToAttachment } from "@/lib/chat/attachments";
import { sendUserMessage, stopStreaming } from "@/lib/chat/send";
import { useChatStore } from "@/lib/chat/store";
import type { ChatAttachment } from "@/lib/stream-protocol";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

interface Props {
  chatId: string | null;
  streaming: boolean;
  variant: "hero" | "dock";
  /** Pre-filled text (e.g. from a suggestion card). */
  seed?: { text: string; nonce: number } | null;
}

export function Composer({ chatId, streaming, variant, seed }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busyFiles, setBusyFiles] = useState(0);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);

  const [lastSeed, setLastSeed] = useState(seed?.nonce);
  if (seed && seed.nonce !== lastSeed) {
    setLastSeed(seed.nonce);
    setText(seed.text);
  }

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, variant === "hero" ? 220 : 180)}px`;
  }, [text, variant]);

  useEffect(() => {
    if (seed) textareaRef.current?.focus();
  }, [seed]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 4);
    setBusyFiles((n) => n + list.length);
    for (const file of list) {
      try {
        const att = await fileToAttachment(file);
        setAttachments((prev) => [...prev, att].slice(0, 4));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "فایل اضافه نشد.");
      } finally {
        setBusyFiles((n) => n - 1);
      }
    }
  }, []);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !streaming && busyFiles === 0;

  const submit = () => {
    if (!canSend) return;
    const message = text.trim() || (settings.quiz ? "از این موضوع یک آزمونک بساز." : "");
    void sendUserMessage(chatId, message, attachments);
    setText("");
    setAttachments([]);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const chips = [
    {
      key: "reasoning" as const,
      label: "تفکر عمیق",
      Icon: Lightbulb,
      on: settings.reasoning,
      title: "فکر بیشتر برای سوال‌های سخت",
      color: "#f59e0b",
    },
    {
      key: "quiz" as const,
      label: "آزمونک",
      Icon: ListChecks,
      on: settings.quiz,
      title: "ساختن آزمونک چند گزینه‌ای",
      color: "#8b5cf6",
    },
    {
      key: "webSearch" as const,
      label: "جستجوی وب",
      Icon: Globe,
      on: settings.webSearch,
      title: "جستجو در انترنت",
      color: "#0d9488",
    },
  ];

  // In the chat, the box is a single line until the student taps it (more room for answers).
  const compact = variant === "dock" && !focused && !text && attachments.length === 0 && busyFiles === 0 && !dragging;
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  const actionButton = streaming ? (
    <motion.button
      key="stop"
      type="button"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      onClick={() => chatId && stopStreaming(chatId)}
      className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-ink text-white shadow-md transition hover:opacity-90"
      aria-label="توقف"
    >
      <Square className="size-3.5 fill-current" />
    </motion.button>
  ) : (
    <motion.button
      key="send"
      type="button"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      onMouseDown={keepFocus}
      onClick={submit}
      disabled={!canSend}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[14px] text-white transition",
        canSend ? "bg-gradient-brand shadow-[0_8px_20px_rgba(79,70,229,0.35)] hover:brightness-110" : "bg-[#d9dbe3]",
      )}
      aria-label="فرستادن"
    >
      <ArrowUp className="size-5" />
    </motion.button>
  );

  return (
    <div className={cn("relative isolate w-full", variant === "hero" && "composer-glow")}>
      <div
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          blurTimer.current = setTimeout(() => setFocused(false), 150);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-[22px] border bg-surface/95 shadow-[var(--shadow-lg)] backdrop-blur transition sm:rounded-[26px]",
          dragging ? "border-primary/50 ring-4 ring-primary/10" : "border-line focus-within:border-primary/30",
        )}
      >
        <AnimatePresence initial={false}>
          {(attachments.length > 0 || busyFiles > 0) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 overflow-hidden px-3.5 pt-3"
            >
              {attachments.map((a, i) => (
                <div key={i} className="group relative">
                  {a.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachmentSrc(a)} alt={a.name} className="size-14 rounded-2xl border border-line object-cover" />
                  ) : (
                    <div className="flex h-14 w-40 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 text-xs">
                      <FileText className="size-6 shrink-0 text-danger" />
                      <span className="line-clamp-2">{a.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white shadow"
                    aria-label="حذف فایل"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {Array.from({ length: busyFiles }).map((_, i) => (
                <div key={`busy-${i}`} className="size-14 animate-pulse rounded-2xl bg-surface-2" />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={cn(
            "flex gap-2.5",
            variant === "hero"
              ? "items-start px-4 pt-4 sm:px-5 sm:pt-5"
              : compact
                ? "items-center py-1.5 pe-1.5 ps-4"
                : "items-start px-4 pt-3",
          )}
        >
          <Sparkles className={cn("size-[18px] shrink-0 text-primary-2", !compact && "mt-1")} />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={
              settings.quiz
                ? "موضوع آزمونک را بنویسید…"
                : variant === "hero"
                  ? "سوال خود را بپرسید یا درسی را که نفهمیدید بنویسید…"
                  : "سوال خود را بپرسید…"
            }
            className={cn(
              "composer-input max-h-[200px] min-w-0 flex-1 resize-none bg-transparent text-[16px] leading-7 outline-none placeholder:text-muted",
              variant === "hero" ? "min-h-[56px] sm:min-h-[72px]" : "min-h-[28px]",
            )}
          />
          {compact && (
            <>
              {chips.some((c) => c.on) && (
                <span className="flex shrink-0 items-center gap-1" aria-label="حالت‌های روشن">
                  {chips
                    .filter((c) => c.on)
                    .map((c) => (
                      <span key={c.key} title={c.label} className="size-2.5 rounded-full" style={{ background: c.color }} />
                    ))}
                </span>
              )}
              <AnimatePresence mode="wait" initial={false}>
                {actionButton}
              </AnimatePresence>
            </>
          )}
        </div>

        <AnimatePresence initial={false}>
          {!compact && (
            <motion.div
              key="tools"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1.5">
                <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) void addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => fileRef.current?.click()}
                    className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 shadow-[var(--shadow-sm)] transition hover:border-primary/30 hover:text-primary"
                    aria-label="ضمیمه کردن عکس یا PDF"
                    title="ضمیمه کردن عکس یا PDF"
                  >
                    <Paperclip className="size-4" />
                  </button>
                  {chips.map(({ key, label, Icon, on, title }) => (
                    <motion.button
                      key={key}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onMouseDown={keepFocus}
                      onClick={() => updateSettings({ [key]: !on })}
                      title={title}
                      aria-pressed={on}
                      className={cn(
                        "flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] shadow-[var(--shadow-sm)] transition",
                        on
                          ? "border-primary/30 bg-primary-soft font-semibold text-primary"
                          : "border-line bg-surface text-ink-2 hover:border-primary/30 hover:text-ink",
                      )}
                    >
                      <Icon className="size-4" />
                      {label}
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {actionButton}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {variant === "dock" && (
        <p className="mt-1.5 hidden text-center text-[11px] text-muted sm:block">
          هما هم ممکن است اشتباه کند. جواب‌های مهم را با کتاب و معلم خود چک کنید.
        </p>
      )}
    </div>
  );
}
