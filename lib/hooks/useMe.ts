"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { AppUser } from "@/lib/auth";

type Me = { user: AppUser | null; usedToday: number | null; loaded: boolean };

let me: Me = { user: null, usedToday: null, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Me) {
  me = next;
  for (const l of listeners) l();
}

/** Reads the logged-in account from the server again (e.g. after a question, to update today's count). */
export function refreshMe(): Promise<void> {
  loading = fetch("/api/login", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { user?: AppUser | null; usedToday?: number | null }) => set({ user: d.user ?? null, usedToday: d.usedToday ?? null, loaded: true }))
    .catch(() => set({ ...me, loaded: true }));
  return loading;
}

/** After a question: update today's count, only for accounts with a daily limit. */
export function refreshUsage(): Promise<void> {
  return me.user?.dailyLimit != null ? refreshMe() : Promise.resolve();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Me = { user: null, usedToday: null, loaded: false };

/** The logged-in account: name, role and daily limit (loaded once per page visit). */
export function useMe(): Me {
  useEffect(() => {
    if (!loading) void refreshMe();
  }, []);
  return useSyncExternalStore(subscribe, () => me, () => EMPTY);
}

export async function logout() {
  await fetch("/api/login", { method: "DELETE" }).catch(() => {});
  window.location.replace("/login");
}
