"use client";

import { create } from "zustand";

/**
 * Layout state shared by the app shell and the chat: while the student scrolls
 * down to read an answer, the top bars slide away to give the answer more room.
 */
export const useUi = create<{ chromeHidden: boolean; setChromeHidden: (hidden: boolean) => void }>((set) => ({
  chromeHidden: false,
  setChromeHidden: (hidden) => set((s) => (s.chromeHidden === hidden ? s : { chromeHidden: hidden })),
}));
