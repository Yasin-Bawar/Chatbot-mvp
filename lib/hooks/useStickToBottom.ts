"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps a scroll container pinned to the bottom while new content streams in,
 * but only if the reader has not scrolled up.
 */
export function useStickToBottom<T extends HTMLElement, C extends HTMLElement>(enabled: boolean, resetKey?: string | null) {
  const scrollRef = useRef<T | null>(null);
  const contentRef = useRef<C | null>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!enabled || !el || !content) return;
    // New conversation opened: jump to the latest message.
    pinned.current = true;
    el.scrollTop = el.scrollHeight;

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = distance < 80;
      pinned.current = near;
      setAtBottom(near);
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [enabled, resetKey]);

  return { scrollRef, contentRef, atBottom, scrollToBottom };
}
