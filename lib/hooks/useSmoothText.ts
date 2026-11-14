"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals streamed text at a smooth, adaptive pace (requestAnimationFrame),
 * so bursty network chunks read like fluid typing. Text that was already
 * complete when the component mounted is shown immediately.
 */
export function useSmoothText(target: string, streaming: boolean): string {
  const [shown, setShown] = useState(() => (streaming ? "" : target));
  const shownLen = useRef(streaming ? 0 : target.length);
  const targetRef = useRef(target);
  const streamingRef = useRef(streaming);

  useEffect(() => {
    targetRef.current = target;
    streamingRef.current = streaming;
    if (shownLen.current > target.length) shownLen.current = target.length;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame: number | null = null;

    const tick = () => {
      const full = targetRef.current;
      const remaining = full.length - shownLen.current;
      if (remaining > 0) {
        // Catch up faster when far behind or once streaming has finished.
        const divisor = streamingRef.current ? 14 : 5;
        const step = reduced ? remaining : Math.max(2, Math.ceil(remaining / divisor));
        shownLen.current = Math.min(full.length, shownLen.current + step);
      }
      setShown(full.slice(0, shownLen.current));
      frame = shownLen.current < full.length ? requestAnimationFrame(tick) : null;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [target, streaming]);

  return shown;
}
