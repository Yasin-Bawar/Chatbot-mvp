"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  LoaderCircle,
  Pencil,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { attachmentSrc } from "@/lib/chat/attachments";
import { MessageContext } from "@/lib/chat/message-context";
import { editAndResend, regenerate } from "@/lib/chat/send";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage, ToolStatus } from "@/lib/chat/types";
import { useSmoothText } from "@/lib/hooks/useSmoothText";
import { textDirection, toFaDigits } from "@/lib/persian";
import type { SourceRef } from "@/lib/stream-protocol";
import { cn } from "@/lib/utils";
import { StreamingMarkdown } from "@/components/markdown/Markdown";
import { QuizResultCard } from "@/components/quiz/QuizResultCard";
import { Orb } from "@/components/ui/Orb";
import { toast } from "@/components/ui/Toast";
import type { PageTarget } from "./PageViewer";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("کاپی نشد.");
    }
  };
  return { copied, copy };
}

const iconBtn =
  "grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-sm)]";

/* ---------------- User message ---------------- */

export const UserMessage = memo(function UserMessage({
  chatId,
  message,
  disabled,
}: {
  chatId: string;
  message: ChatMessage;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const { copied, copy } = useCopy();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group flex flex-col items-start gap-1.5"
    >
      {message.attachments?.length ? (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((a, i) =>
            a.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={attachmentSrc(a)}
                alt={a.name}
                className="max-h-56 max-w-[70vw] rounded-2xl border border-line object-cover shadow-[var(--shadow-sm)] sm:max-w-xs"
              />
            ) : (
              <div key={i} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
                <FileText className="size-5 text-danger" /> {a.name}
              </div>
            ),
          )}
        </div>
      ) : null}

      {message.quizResult && !editing ? (
        <QuizResultCard result={message.quizResult} />
      ) : editing ? (
        <div className="w-full max-w-[85%] rounded-3xl border border-primary/30 bg-surface p-3 shadow-[var(--shadow-md)]">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent px-2 text-[15.5px] leading-8 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
              لغو
            </button>
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => {
                setEditing(false);
                void editAndResend(chatId, message.id, draft.trim());
              }}
              className="bg-gradient-brand rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              فرستادن
            </button>
          </div>
        </div>
      ) : (
        message.text && (
          <div
            dir={textDirection(message.text)}
            className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-ss-lg bg-[#ecebff] px-4 py-2.5 text-start text-[15.5px] leading-8 text-[#1e1b4b]"
          >
            {message.text}
          </div>
        )
      )}

      {!editing && (
        <div className="flex gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <button type="button" className={iconBtn} onClick={() => copy(message.text)} aria-label="کاپی">
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </button>
          {!disabled && !message.quizResult && (
            <button
              type="button"
              className={iconBtn}
              onClick={() => {
                setDraft(message.text);
                setEditing(true);
              }}
              aria-label="ویرایش"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
});

/* ---------------- Assistant message ---------------- */

export const AssistantMessage = memo(function AssistantMessage({
  chatId,
  message,
  isLast,
  onOpenSource,
}: {
  chatId: string;
  message: ChatMessage;
  isLast: boolean;
  onOpenSource: (target: PageTarget) => void;
}) {
  const streaming = message.status === "streaming";
  const shown = useSmoothText(message.text, streaming);
  const revealing = streaming || shown.length < message.text.length;
  const updateMessage = useChatStore((s) => s.updateMessage);
  const { copied, copy } = useCopy();
  const tools = message.tools ?? [];
  const waiting = streaming && !message.text && tools.every((t) => t.done);
  const messageContext = useMemo(() => ({ chatId, messageId: message.id }), [chatId, message.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex gap-3"
    >
      <div className="pt-1">
        <Orb size={30} busy={streaming} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {message.thinking?.trim() ? (
          <ThinkingPanel text={message.thinking} active={streaming && !message.text} />
        ) : waiting && tools.length === 0 ? (
          <div className="flex h-8 items-center">
            <span className="shimmer text-[15px] font-medium">در حال فکر کردن…</span>
          </div>
        ) : null}

        {tools.length > 0 && <ToolChips tools={tools} />}

        {shown && (
          <MessageContext.Provider value={messageContext}>
            <StreamingMarkdown text={shown} streaming={revealing} />
          </MessageContext.Provider>
        )}

        {waiting && tools.length > 0 && (
          <div className="flex h-8 items-center">
            <span className="shimmer text-[15px] font-medium">در حال آماده کردن جواب…</span>
          </div>
        )}

        {message.sources && message.sources.length > 0 && !revealing && (
          <SourceChips sources={message.sources} onOpen={onOpenSource} />
        )}

        {message.status === "error" && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-[#9f1d22]">
            <TriangleAlert className="size-5 shrink-0" />
            <span className="flex-1 leading-7">{message.error}</span>
            {isLast && (
              <button
                type="button"
                onClick={() => void regenerate(chatId)}
                className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 font-semibold text-ink shadow-sm"
              >
                <RotateCcw className="size-4" /> دوباره
              </button>
            )}
          </div>
        )}

        {message.status === "stopped" && (
          <div className="text-xs text-muted">⏸ جواب متوقف شد.</div>
        )}

        {!revealing && message.status !== "error" && message.text && (
          <div className="flex items-center gap-0.5">
            <button type="button" className={iconBtn} onClick={() => copy(message.text)} aria-label="کاپی" title="کاپی">
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </button>
            {isLast && (
              <button type="button" className={iconBtn} onClick={() => void regenerate(chatId)} aria-label="جواب دوباره" title="جواب دوباره">
                <RotateCcw className="size-4" />
              </button>
            )}
            <button
              type="button"
              className={cn(iconBtn, message.feedback === "up" && "text-success")}
              onClick={() => {
                updateMessage(chatId, message.id, { feedback: message.feedback === "up" ? null : "up" });
                if (message.feedback !== "up") toast.success("ممنون از نظر شما! 🌟");
              }}
              aria-label="خوب بود"
            >
              <ThumbsUp className={cn("size-4", message.feedback === "up" && "fill-current")} />
            </button>
            <button
              type="button"
              className={cn(iconBtn, message.feedback === "down" && "text-danger")}
              onClick={() => updateMessage(chatId, message.id, { feedback: message.feedback === "down" ? null : "down" })}
              aria-label="خوب نبود"
            >
              <ThumbsDown className={cn("size-4", message.feedback === "down" && "fill-current")} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

function ThinkingPanel({ text, active }: { text: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start text-sm"
        aria-expanded={open}
      >
        <Brain className={cn("size-4", active ? "text-primary" : "text-muted")} />
        <span className={cn("flex-1 font-medium", active ? "shimmer" : "text-ink-2")}>
          {active ? "در حال فکر کردن…" : "مراحل فکر کردن"}
        </span>
        <ChevronDown className={cn("size-4 text-muted transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div dir="auto" className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-line px-4 py-3 text-[13px] leading-6 text-muted">
              {text.trim()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolChips({ tools }: { tools: ToolStatus[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {tools.map((tool) => {
          const Icon = tool.name === "web_search" ? Globe : BookOpen;
          return (
            <motion.div
              key={tool.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition",
                tool.done ? "border-line bg-surface text-ink-2" : "border-primary/20 bg-primary-soft",
              )}
            >
              <Icon className={cn("size-3.5", tool.done ? "text-muted" : "text-primary")} />
              <span className={cn(!tool.done && "shimmer font-medium")}>{tool.label}</span>
              {tool.done ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <LoaderCircle className="size-3.5 animate-spin text-primary" />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SourceChips({ sources, onOpen }: { sources: SourceRef[]; onOpen: (t: PageTarget) => void }) {
  const unique = sources.slice(0, 8);
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">منابع:</span>
      {unique.map((s, i) => (
        <motion.button
          key={`${s.bookId}-${s.page}`}
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onOpen(s)}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink-2 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary"
        >
          <BookOpen className="size-3.5 text-primary" />
          <span className="max-w-40 truncate">{s.title}</span>
          <span className="text-muted">· ص {toFaDigits(s.page)}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
