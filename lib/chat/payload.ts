import type { ChatRequestBody, ChatRequestMessage } from "@/lib/stream-protocol";
import type { ChatMessage, Settings } from "./types";

/** Vercel functions accept ~4.5 MB bodies; keep attachments well under that. */
const ATTACHMENT_BUDGET = 3_200_000;

/**
 * Builds the /api/chat body. Newest attachments are sent while they fit in the
 * budget; older ones are replaced by a short note so the request stays small.
 */
export function buildChatPayload(history: ChatMessage[], settings: Settings): ChatRequestBody {
  let budget = ATTACHMENT_BUDGET;
  const out: ChatRequestMessage[] = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant") {
      if (m.text.trim()) out.push({ role: "assistant", text: m.text });
      continue;
    }
    const kept = [];
    const dropped: string[] = [];
    for (const a of m.attachments ?? []) {
      if (a.data.length <= budget) {
        kept.push(a);
        budget -= a.data.length;
      } else {
        dropped.push(a.name);
      }
    }
    const note = dropped.length ? `\n\n[فایل قبلی ضمیمه شده بود: ${dropped.join("، ")}]` : "";
    out.push({ role: "user", text: m.text + note, attachments: kept.length ? kept : undefined });
  }
  out.reverse();

  return {
    messages: out,
    options: {
      model: settings.model,
      reasoning: settings.reasoning,
      quiz: settings.quiz,
      webSearch: settings.webSearch,
      bookIds: settings.bookIds,
    },
    studentName: settings.studentName || undefined,
  };
}
