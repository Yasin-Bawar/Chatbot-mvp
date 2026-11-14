"use client";

import { del, get, set } from "idb-keyval";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { DEFAULT_MODEL } from "@/lib/models";
import type { ChatStreamEvent } from "@/lib/stream-protocol";
import type { Chat, ChatMessage, Settings } from "./types";

/**
 * IndexedDB storage with debounced writes: streaming updates the store many
 * times per second, but we only persist the latest snapshot every ~700 ms.
 */
function createDebouncedIdbStorage(delay = 700): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [key, value] of entries) {
      try {
        await set(key, value);
      } catch (err) {
        console.warn("Could not save chats", err);
      }
    }
  };

  if (typeof window !== "undefined") {
    const flushNow = () => {
      if (pending.size) void flush();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
    });
  }

  return {
    getItem: async (name) => {
      if (typeof indexedDB === "undefined") return null;
      try {
        return (await get<string>(name)) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof indexedDB === "undefined") return; // server render
      pending.set(name, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    removeItem: async (name) => {
      pending.delete(name);
      if (typeof indexedDB !== "undefined") await del(name);
    },
  };
}

interface ChatState {
  chats: Record<string, Chat>;
  activeChatId: string | null;
  settings: Settings;
  hydrated: boolean;

  setHydrated: () => void;
  setActiveChat: (id: string | null) => void;
  createChat: (first: ChatMessage) => string;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  applyEvent: (chatId: string, messageId: string, event: ChatStreamEvent) => void;
  truncateFrom: (chatId: string, messageId: string) => void;
  renameChat: (chatId: string, title: string) => void;
  deleteChat: (chatId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  model: DEFAULT_MODEL,
  reasoning: false,
  quiz: false,
  webSearch: false,
  bookIds: [],
  studentName: "",
  askedName: false,
  boardSpeed: "normal",
};

function touch(chat: Chat, messages: ChatMessage[]): Chat {
  return { ...chat, messages, updatedAt: Date.now() };
}

export const useChatStore = create<ChatState>()(
  persist(
    (setState, getState) => ({
      chats: {},
      activeChatId: null,
      settings: DEFAULT_SETTINGS,
      hydrated: false,

      setHydrated: () => setState({ hydrated: true }),

      setActiveChat: (id) => setState({ activeChatId: id }),

      createChat: (first) => {
        const id = nanoid(12);
        const now = Date.now();
        const title = first.text.replace(/\s+/g, " ").trim().slice(0, 48) || "گفتگوی تازه";
        setState((s) => ({
          chats: { ...s.chats, [id]: { id, title, titled: false, createdAt: now, updatedAt: now, messages: [first] } },
          activeChatId: id,
        }));
        return id;
      },

      addMessage: (chatId, message) =>
        setState((s) => {
          const chat = s.chats[chatId];
          if (!chat) return s;
          return { chats: { ...s.chats, [chatId]: touch(chat, [...chat.messages, message]) } };
        }),

      updateMessage: (chatId, messageId, patch) =>
        setState((s) => {
          const chat = s.chats[chatId];
          if (!chat) return s;
          const messages = chat.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m));
          return { chats: { ...s.chats, [chatId]: { ...chat, messages } } };
        }),

      applyEvent: (chatId, messageId, event) => {
        const chat = getState().chats[chatId];
        const message = chat?.messages.find((m) => m.id === messageId);
        if (!message) return;
        const patch: Partial<ChatMessage> = {};
        switch (event.t) {
          case "text":
            patch.text = message.text + event.d;
            break;
          case "thinking":
            patch.thinking = (message.thinking ?? "") + event.d;
            break;
          case "tool": {
            const tools = [...(message.tools ?? [])];
            const index = tools.findIndex((t) => t.id === event.id);
            const next = { id: event.id, name: event.name, label: event.label, done: false };
            if (index >= 0) tools[index] = { ...tools[index], label: event.label };
            else tools.push(next);
            patch.tools = tools;
            break;
          }
          case "tool_done":
            patch.tools = (message.tools ?? []).map((t) => (t.id === event.id ? { ...t, done: true } : t));
            break;
          case "sources": {
            const seen = new Set((message.sources ?? []).map((s) => `${s.bookId}:${s.page}`));
            const added = event.items.filter((s) => !seen.has(`${s.bookId}:${s.page}`));
            patch.sources = [...(message.sources ?? []), ...added];
            break;
          }
          case "done":
            patch.status = "done";
            patch.tools = (message.tools ?? []).map((t) => ({ ...t, done: true }));
            break;
          case "error":
            patch.status = "error";
            patch.error = event.message;
            break;
        }
        getState().updateMessage(chatId, messageId, patch);
      },

      truncateFrom: (chatId, messageId) =>
        setState((s) => {
          const chat = s.chats[chatId];
          if (!chat) return s;
          const index = chat.messages.findIndex((m) => m.id === messageId);
          if (index < 0) return s;
          return { chats: { ...s.chats, [chatId]: touch(chat, chat.messages.slice(0, index)) } };
        }),

      renameChat: (chatId, title) =>
        setState((s) => {
          const chat = s.chats[chatId];
          if (!chat) return s;
          return { chats: { ...s.chats, [chatId]: { ...chat, title: title.trim() || chat.title, titled: true } } };
        }),

      deleteChat: (chatId) =>
        setState((s) => {
          const chats = { ...s.chats };
          delete chats[chatId];
          return { chats, activeChatId: s.activeChatId === chatId ? null : s.activeChatId };
        }),

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "dana-chats-v1",
      storage: createJSONStorage(() => createDebouncedIdbStorage()),
      partialize: (s) => ({ chats: s.chats, activeChatId: s.activeChatId, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        // Messages that were streaming when the tab closed are finished as "stopped".
        const chats = Object.fromEntries(
          Object.entries(p.chats ?? {}).map(([id, chat]) => [
            id,
            {
              ...chat,
              messages: chat.messages.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m)),
            },
          ]),
        );
        return {
          ...current,
          ...p,
          chats,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export function sortedChats(chats: Record<string, Chat>): Chat[] {
  return Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);
}
