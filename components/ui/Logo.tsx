"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** "هما" brand mark: an open book with a spark, in the brand gradient. */
export function LogoMark({ className }: { className?: string }) {
  // Unique gradient id: the same logo can be rendered in a hidden sidebar and the mobile bar.
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="0.6" stopColor="#7C6CF6" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <path d="M3 9.5c4.2-1.6 8.3-1.2 12 1.6v15.4c-3.7-2.6-7.8-3-12-1.4z" fill={`url(#${id})`} />
      <path d="M29 9.5c-4.2-1.6-8.3-1.2-12 1.6v15.4c3.7-2.6 7.8-3 12-1.4z" fill={`url(#${id})`} opacity="0.72" />
      <path d="M24 2.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#7C6CF6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[22px] font-black tracking-tight text-[#1e1b4b]">هما</span>
    </div>
  );
}
