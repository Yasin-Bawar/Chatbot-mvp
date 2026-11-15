"use client";

import { create } from "zustand";

/**
 * Which full-screen layer is open (by component id). Only one board and one
 * quiz can be full screen at a time; a quiz waits while a board is open.
 */
export const useOverlays = create<{ board: string | null; quiz: string | null }>(() => ({ board: null, quiz: null }));
