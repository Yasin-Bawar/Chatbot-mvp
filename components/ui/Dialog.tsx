"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#1f2330]/30 backdrop-blur-[2px]" />
        <RadixDialog.Content
          dir="rtl"
          className={cn(
            "dialog-content fixed inset-0 z-50 m-auto flex h-fit max-h-[88dvh] w-[calc(100vw-24px)] max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lg)] outline-none",
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-[17px] font-extrabold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm leading-6 text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : ""}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="بستن">
              <X className="size-5" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
