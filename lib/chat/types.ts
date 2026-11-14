import type { ChatAttachment, SourceRef } from "@/lib/stream-protocol";

export interface ToolStatus {
  id: string;
  name: string;
  label: string;
  done: boolean;
}

export type MessageStatus = "streaming" | "done" | "error" | "stopped";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  thinking?: string;
  tools?: ToolStatus[];
  sources?: SourceRef[];
  status?: MessageStatus;
  error?: string;
  feedback?: "up" | "down" | null;
}

export interface Chat {
  id: string;
  title: string;
  titled: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface Settings {
  model: string;
  reasoning: boolean;
  quiz: boolean;
  webSearch: boolean;
  bookIds: string[];
  studentName: string;
  askedName: boolean;
}
