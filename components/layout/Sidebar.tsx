"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { Box, Ellipsis, History, House, Library, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { sortedChats, useChatStore } from "@/lib/chat/store";
import type { Chat } from "@/lib/chat/types";
import { useMounted } from "@/lib/hooks/useMounted";
import { normalizeFa } from "@/lib/persian";
import { cn, DATE_GROUP_ORDER, dateGroup, type DateGroup } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "/", label: "خانه", Icon: House },
  { href: "/visuals", label: "نمایش‌ها", Icon: Box },
  { href: "/library", label: "کتابخانه", Icon: Library },
  { href: "/history", label: "تاریخچه", Icon: History },
];

export function chatMatches(chat: Chat, query: string): boolean {
  const q = normalizeFa(query.trim());
  if (!q) return true;
  if (normalizeFa(chat.title).includes(q)) return true;
  return chat.messages.some((m) => normalizeFa(m.text).includes(q));
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ + K focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const list = sortedChats(chats).filter((c) => chatMatches(c, query));
    const map = new Map<DateGroup, Chat[]>();
    for (const chat of list) {
      const g = dateGroup(chat.updatedAt);
      map.set(g, [...(map.get(g) ?? []), chat]);
    }
    return DATE_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, chats: map.get(g)! }));
  }, [chats, query]);

  const openChat = (id: string) => {
    setActiveChat(id);
    if (pathname !== "/") router.push("/");
    onClose?.();
  };

  const newChat = () => {
    setActiveChat(null);
    if (pathname !== "/") router.push("/");
    onClose?.();
  };

  return (
    <div className="flex h-full flex-col rounded-[26px] border border-line bg-surface/95 shadow-[var(--shadow-md)] backdrop-blur">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <Link href="/" onClick={newChat}>
          <Logo />
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label="بستن منو">
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="px-4">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-[0_2px_10px_rgba(16,24,40,0.05)] transition focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]">
          <Search className="size-4 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="text-muted hover:text-ink" aria-label="پاک کردن">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-lg bg-primary-soft px-1.5 py-0.5 font-sans text-[11px] font-semibold text-primary md:inline" dir="ltr">
              Ctrl K
            </kbd>
          )}
        </label>
      </div>

      <nav className="mt-4 grid gap-0.5 px-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={href === "/" ? newChat : onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition",
                active ? "bg-primary-soft font-semibold text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={newChat}
        className="bg-gradient-brand mx-4 mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <Plus className="size-4" />
        گفتگوی تازه
      </button>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {mounted && groups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm leading-7 text-muted">
            {query ? "چیزی پیدا نشد." : "هنوز گفتگویی ندارید. اولین سوال خود را بپرسید! ✨"}
          </p>
        )}
        {mounted &&
          groups.map(({ group, chats: list }) => (
            <div key={group} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[13px] text-muted">{group}</div>
              <AnimatePresence initial={false}>
                {list.map((chat) => (
                  <motion.div
                    key={chat.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <ChatRow chat={chat} active={pathname === "/" && chat.id === activeChatId} onOpen={() => openChat(chat.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
      </div>

      <StudentFooter />
    </div>
  );
}

function ChatRow({ chat, active, onOpen }: { chat: Chat; active: boolean; onOpen: () => void }) {
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          renameChat(chat.id, draft);
          setEditing(false);
        }}
        className="px-1 py-0.5"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            renameChat(chat.id, draft);
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="w-full rounded-xl border border-primary/40 bg-surface px-3 py-2 text-sm outline-none"
        />
      </form>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-xl transition",
        active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2",
      )}
    >
      <button type="button" onClick={onOpen} className="fade-end min-w-0 flex-1 truncate px-3 py-2.5 text-start text-[14.5px]">
        {chat.title}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="me-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted opacity-100 transition hover:bg-white hover:text-ink md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="گزینه‌ها"
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="menu-content z-50 min-w-40 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]"
          >
            <DropdownMenu.Item
              onSelect={() => {
                setDraft(chat.title);
                setEditing(true);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"
            >
              <Pencil className="size-4" /> تغییر نام
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => deleteChat(chat.id)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
            >
              <Trash2 className="size-4" /> حذف
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function StudentFooter() {
  const mounted = useMounted();
  const name = useChatStore((s) => s.settings.studentName);
  const updateSettings = useChatStore((s) => s.updateSettings);
  return (
    <button
      type="button"
      onClick={() => updateSettings({ askedName: false })}
      className="m-3 mt-0 flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-3 py-2.5 text-start transition hover:border-primary/30"
    >
      <span className="bg-gradient-brand grid size-9 place-items-center rounded-xl text-white">
        <UserRound className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{mounted && name ? name : "شاگرد عزیز"}</span>
        <span className="block text-xs text-muted">تغییر نام</span>
      </span>
    </button>
  );
}
