"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { create } from "zustand";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const useToasts = create<{ items: ToastItem[]; push: (kind: ToastKind, text: string) => void; remove: (id: number) => void }>(
  (set) => ({
    items: [],
    push: (kind, text) => {
      const id = Date.now() + Math.random();
      set((s) => ({ items: [...s.items.slice(-2), { id, kind, text }] }));
      setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4200);
    },
    remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  }),
);

export const toast = {
  success: (text: string) => useToasts.getState().push("success", text),
  error: (text: string) => useToasts.getState().push("error", text),
  info: (text: string) => useToasts.getState().push("info", text),
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  const remove = useToasts((s) => s.remove);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = t.kind === "success" ? CircleCheck : t.kind === "error" ? CircleX : Info;
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => remove(t.id)}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-start text-sm leading-6 shadow-[var(--shadow-lg)]"
            >
              <Icon className={t.kind === "success" ? "size-5 shrink-0 text-success" : t.kind === "error" ? "size-5 shrink-0 text-danger" : "size-5 shrink-0 text-primary"} />
              {t.text}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
