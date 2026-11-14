/**
 * Events streamed from /api/chat to the browser as NDJSON (one JSON per line).
 * Shared by server and client.
 */

export interface SourceRef {
  bookId: string;
  title: string;
  page: number;
}

export type ChatStreamEvent =
  | { t: "thinking"; d: string }
  | { t: "text"; d: string }
  | { t: "tool"; id: string; name: "search_books" | "read_book_pages" | "web_search"; label: string }
  | { t: "tool_done"; id: string }
  | { t: "sources"; items: SourceRef[] }
  | { t: "done"; stop: string | null }
  | { t: "error"; message: string };

export interface ChatAttachment {
  kind: "image" | "pdf";
  name: string;
  mediaType: string;
  /** base64 without data: prefix */
  data: string;
}

export interface ChatRequestMessage {
  role: "user" | "assistant";
  text: string;
  attachments?: ChatAttachment[];
}

export interface ChatRequestOptions {
  model: string;
  reasoning: boolean;
  quiz: boolean;
  webSearch: boolean;
  bookIds: string[];
}

export interface ChatRequestBody {
  messages: ChatRequestMessage[];
  options: ChatRequestOptions;
  studentName?: string;
}

export function encodeEvent(event: ChatStreamEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Incremental NDJSON parser: feed chunks, get complete events back.
 * Keeps the trailing partial line in its buffer.
 */
export function createNdjsonParser() {
  let buffer = "";
  return {
    push(chunk: string): ChatStreamEvent[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      const events: ChatStreamEvent[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          events.push(JSON.parse(trimmed) as ChatStreamEvent);
        } catch {
          // ignore malformed line
        }
      }
      return events;
    },
    flush(): ChatStreamEvent[] {
      const rest = buffer.trim();
      buffer = "";
      if (!rest) return [];
      try {
        return [JSON.parse(rest) as ChatStreamEvent];
      } catch {
        return [];
      }
    },
  };
}
