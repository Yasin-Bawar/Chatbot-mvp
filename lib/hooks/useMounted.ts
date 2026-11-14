"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only in the browser after hydration (avoids SSR mismatches). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
