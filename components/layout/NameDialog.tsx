"use client";

import { useState } from "react";
import { useChatStore } from "@/lib/chat/store";
import { Dialog } from "@/components/ui/Dialog";
import { Orb } from "@/components/ui/Orb";

/** Asks the student's name once (optional), for the greeting. */
export function NameDialog() {
  const hydrated = useChatStore((s) => s.hydrated);
  const askedName = useChatStore((s) => s.settings.askedName);
  const currentName = useChatStore((s) => s.settings.studentName);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const open = hydrated && !askedName;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && updateSettings({ askedName: true })}
      title="سلام! من همای سعادت هستم 👋"
      description="معلم هوشمند شما. نام شما چیست؟ (اختیاری)"
      className="max-w-md"
    >
      {open && <NameForm initial={currentName} onDone={(name) => updateSettings({ studentName: name, askedName: true })} />}
    </Dialog>
  );
}

function NameForm({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDone(name.trim().slice(0, 40));
      }}
      className="flex flex-col items-center gap-5 p-6"
    >
      <Orb size={72} />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="مثلاً: احمد، مریم، زهرا…"
        className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-center text-[16px] outline-none transition focus:border-primary/40 focus:bg-surface focus:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]"
      />
      <div className="flex w-full gap-2">
        <button
          type="submit"
          className="bg-gradient-brand flex-1 rounded-2xl px-4 py-3 font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition hover:brightness-110"
        >
          شروع یادگیری
        </button>
        <button
          type="button"
          onClick={() => onDone(initial)}
          className="rounded-2xl border border-line px-4 py-3 text-ink-2 transition hover:bg-surface-2"
        >
          بعداً
        </button>
      </div>
    </form>
  );
}
