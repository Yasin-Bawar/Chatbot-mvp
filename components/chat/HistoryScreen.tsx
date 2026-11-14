"use client";

import { motion } from "motion/react";
import { History, MessageSquare, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sortedChats, useChatStore } from "@/lib/chat/store";
import { useMounted } from "@/lib/hooks/useMounted";
import { toFaDigits } from "@/lib/persian";
import { DATE_GROUP_ORDER, dateGroup } from "@/lib/utils";
import { chatMatches } from "@/components/layout/Sidebar";

export function HistoryScreen() {
  const mounted = useMounted();
  const router = useRouter();
  const chats = useChatStore((s) => s.chats);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const [query, setQuery] = useState("");

  const list = useMemo(() => sortedChats(chats).filter((c) => chatMatches(c, query)), [chats, query]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="flex items-center gap-3 text-[26px] font-black">
          <span className="bg-gradient-brand grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]">
            <History className="size-6" />
          </span>
          تاریخچه گفتگوها
        </h1>
        <p className="mt-2 text-sm text-muted">گفتگوهای شما فقط در همین دستگاه ذخیره می‌شوند.</p>

        <label className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
          <Search className="size-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در گفتگوها…"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>

        {mounted && list.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted">{query ? "چیزی پیدا نشد." : "هنوز گفتگویی ندارید."}</p>
        )}

        {mounted &&
          DATE_GROUP_ORDER.map((group) => {
            const items = list.filter((c) => dateGroup(c.updatedAt) === group);
            if (!items.length) return null;
            return (
              <section key={group} className="mt-6">
                <h2 className="mb-2 px-1 text-sm text-muted">{group}</h2>
                <div className="grid gap-2">
                  {items.map((chat, i) => {
                    const preview = chat.messages.find((m) => m.role === "assistant" && m.text)?.text ?? "";
                    return (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.03 }}
                        className="card group flex items-center gap-3 rounded-2xl px-4 py-3"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                          <MessageSquare className="size-5" />
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChat(chat.id);
                            router.push("/");
                          }}
                          className="min-w-0 flex-1 text-start"
                        >
                          <div className="truncate font-semibold">{chat.title}</div>
                          <div className="truncate text-xs text-muted">
                            {toFaDigits(chat.messages.length)} پیام ·{" "}
                            {preview
                              .replace(/```[\s\S]*?(```|$)/g, " ")
                              .replace(/[#*>`$|]/g, "")
                              .slice(0, 80)}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChat(chat.id)}
                          className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-danger-soft hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                          aria-label="حذف"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
