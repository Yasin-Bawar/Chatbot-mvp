"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

export function CodeBlock({ language, code, children }: { language: string; code: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked
    }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2b2860] bg-[#16142f] shadow-[0_8px_24px_rgba(22,20,47,0.18)]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-indigo-200/80">
        <span dir="ltr" className="font-mono">{language || "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "کاپی شد" : "کاپی"}
        </button>
      </div>
      <pre dir="ltr" className="overflow-x-auto p-3.5 text-[12.5px] leading-6 text-indigo-50">
        <code className="font-mono">{children}</code>
      </pre>
    </div>
  );
}
