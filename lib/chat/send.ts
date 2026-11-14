"use client";

import { nanoid } from "nanoid";
import { createNdjsonParser, type ChatAttachment } from "@/lib/stream-protocol";
import { buildChatPayload } from "./payload";
import { useChatStore } from "./store";
import type { ChatMessage } from "./types";

const controllers = new Map<string, AbortController>();

export function isStreaming(chatId: string | null): boolean {
  return chatId ? controllers.has(chatId) : false;
}

export function stopStreaming(chatId: string) {
  controllers.get(chatId)?.abort();
}

/** Sends a new user message (creating a chat if needed) and streams the answer. */
export async function sendUserMessage(
  chatId: string | null,
  text: string,
  attachments: ChatAttachment[] = [],
): Promise<string> {
  const store = useChatStore.getState();
  const userMessage: ChatMessage = {
    id: nanoid(10),
    role: "user",
    text,
    attachments: attachments.length ? attachments : undefined,
    createdAt: Date.now(),
  };
  let id = chatId;
  if (!id || !store.chats[id]) {
    id = store.createChat(userMessage);
  } else {
    store.addMessage(id, userMessage);
  }
  await streamAssistant(id);
  return id;
}

/** Re-runs the answer to the last user message. */
export async function regenerate(chatId: string) {
  const chat = useChatStore.getState().chats[chatId];
  if (!chat) return;
  const last = chat.messages[chat.messages.length - 1];
  if (last?.role === "assistant") useChatStore.getState().truncateFrom(chatId, last.id);
  await streamAssistant(chatId);
}

/** Replaces a user message (and everything after it) with an edited version. */
export async function editAndResend(chatId: string, messageId: string, text: string) {
  const store = useChatStore.getState();
  const chat = store.chats[chatId];
  const original = chat?.messages.find((m) => m.id === messageId);
  if (!chat || !original) return;
  store.truncateFrom(chatId, messageId);
  store.addMessage(chatId, { ...original, id: nanoid(10), text, createdAt: Date.now() });
  await streamAssistant(chatId);
}

async function streamAssistant(chatId: string) {
  if (controllers.has(chatId)) return;
  const store = useChatStore.getState();
  const history = store.chats[chatId]?.messages.filter((m) => !(m.role === "assistant" && !m.text.trim())) ?? [];
  const payload = buildChatPayload(history, store.settings);

  const assistantId = nanoid(10);
  store.addMessage(chatId, {
    id: assistantId,
    role: "assistant",
    text: "",
    thinking: "",
    tools: [],
    sources: [],
    status: "streaming",
    createdAt: Date.now(),
  });

  const controller = new AbortController();
  controllers.set(chatId, controller);
  const apply = useChatStore.getState().applyEvent;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(res.status === 413 ? "فایل ضمیمه خیلی بزرگ است." : "اتصال با سرور برقرار نشد.");
    }
    const parser = createNdjsonParser();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of parser.push(value)) apply(chatId, assistantId, event);
    }
    for (const event of parser.flush()) apply(chatId, assistantId, event);
  } catch (err) {
    if (controller.signal.aborted) {
      useChatStore.getState().updateMessage(chatId, assistantId, { status: "stopped" });
    } else {
      useChatStore.getState().updateMessage(chatId, assistantId, {
        status: "error",
        error: err instanceof Error && /[؀-ۿ]/.test(err.message) ? err.message : "اتصال قطع شد. انترنت خود را بررسی کنید.",
      });
    }
  } finally {
    controllers.delete(chatId);
    const message = useChatStore.getState().chats[chatId]?.messages.find((m) => m.id === assistantId);
    if (message?.status === "streaming") {
      useChatStore.getState().updateMessage(chatId, assistantId, {
        status: controller.signal.aborted ? "stopped" : "done",
        tools: (message.tools ?? []).map((t) => ({ ...t, done: true })),
      });
    }
    void maybeGenerateTitle(chatId);
  }
}

async function maybeGenerateTitle(chatId: string) {
  const store = useChatStore.getState();
  const chat = store.chats[chatId];
  if (!chat || chat.titled) return;
  const user = chat.messages.find((m) => m.role === "user");
  const assistant = chat.messages.find((m) => m.role === "assistant" && m.text.trim());
  if (!user || !assistant) return;
  try {
    const res = await fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: user.text, assistant: assistant.text.slice(0, 800), model: store.settings.model }),
    });
    const data = (await res.json()) as { title?: string };
    if (data.title) useChatStore.getState().renameChat(chatId, data.title);
  } catch {
    // keep the default title
  }
}
