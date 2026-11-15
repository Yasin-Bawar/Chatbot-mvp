"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { BookOpen, Check, ChevronDown, Library } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useChatStore } from "@/lib/chat/store";
import { useMounted } from "@/lib/hooks/useMounted";
import { useBooksStore } from "@/lib/library/books-store";
import { MODELS, modelById } from "@/lib/models";
import { toFaDigits } from "@/lib/persian";
import { subjectById } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/Orb";

const pill =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] font-semibold text-ink shadow-[var(--shadow-sm)] transition hover:border-primary/30 data-[state=open]:border-primary/40";

export function ModelPicker() {
  const mounted = useMounted();
  const modelId = useChatStore((s) => s.settings.model);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const current = modelById(mounted ? modelId : undefined);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={pill}>
        <Orb size={18} />
        <span>{current.label}</span>
        <ChevronDown className="size-4 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="menu-content z-50 w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]"
        >
          {MODELS.map((m) => (
            <DropdownMenu.Item
              key={m.id}
              onSelect={() => updateSettings({ model: m.id })}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs text-muted">{m.hint}</div>
              </div>
              {m.id === current.id && <Check className="size-4 text-primary" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function BookScopePicker() {
  const mounted = useMounted();
  const bookIds = useChatStore((s) => s.settings.bookIds);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const { books, loaded, refresh } = useBooksStore();

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  const ready = books.filter((b) => b.pagesDone > 0);
  const selected = mounted ? ready.filter((b) => bookIds.includes(b.id)) : [];
  const label =
    selected.length === 0 ? "همه کتاب‌ها" : selected.length === 1 ? selected[0].title : `${toFaDigits(selected.length)} کتاب`;

  const toggle = (id: string) => {
    const next = bookIds.includes(id) ? bookIds.filter((x) => x !== id) : [...bookIds, id];
    updateSettings({ bookIds: next });
  };

  return (
    <Popover.Root onOpenChange={(open) => open && void refresh()}>
      <Popover.Trigger className={cn(pill, "max-w-[200px]")}>
        <BookOpen className="size-4 shrink-0 text-primary" />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="menu-content z-50 w-80 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-lg)]"
        >
          <div className="px-2 pb-2 pt-1 text-xs leading-6 text-muted">دانا از کدام کتاب‌ها درس بدهد؟</div>
          <button
            type="button"
            onClick={() => updateSettings({ bookIds: [] })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm hover:bg-surface-2"
          >
            <Library className="size-4 text-primary" />
            <span className="flex-1 font-semibold">همه کتاب‌ها</span>
            {selected.length === 0 && <Check className="size-4 text-primary" />}
          </button>
          <div className="my-1 h-px bg-line" />
          <div className="max-h-72 overflow-y-auto">
            {ready.length === 0 && (
              <div className="px-3 py-4 text-center text-sm leading-7 text-muted">
                هنوز کتابی اضافه نشده.
                <br />
                <Link href="/library" className="font-semibold text-primary">
                  رفتن به کتابخانه
                </Link>
              </div>
            )}
            {ready.map((b) => {
              const subject = subjectById(b.subject);
              const on = bookIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-surface-2"
                >
                  <span
                    className="h-8 w-6 shrink-0 rounded-md shadow-sm"
                    style={{ background: `linear-gradient(160deg, ${subject.from}, ${subject.to})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.title}</span>
                    <span className="block text-xs text-muted">
                      {subject.name}
                      {b.grade ? ` · صنف ${toFaDigits(b.grade)}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-md border transition",
                      on ? "border-primary bg-primary text-white" : "border-line-strong",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
