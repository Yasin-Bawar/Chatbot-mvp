"use client";

import { create } from "zustand";

/**
 * Which full-screen layer is open (by component id). Only one board, one quiz
 * and one visual can be full screen at a time; a quiz or a visual that wants to
 * open by itself waits while another layer is open.
 */
export const useOverlays = create<{ board: string | null; quiz: string | null; visual: string | null }>(() => ({
  board: null,
  quiz: null,
  visual: null,
}));
