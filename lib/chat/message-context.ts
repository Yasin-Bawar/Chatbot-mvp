"use client";

import { createContext } from "react";

/** The chat message a piece of rendered Markdown belongs to (lets a quiz send its results). */
export const MessageContext = createContext<{ chatId: string; messageId: string } | null>(null);
