import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { modelById } from "@/lib/models";
import { buildContextPrompt, TEACHER_PERSONA } from "@/lib/prompts/teacher";
import {
  FALLBACK_BETA,
  REFUSAL_TEXT,
  friendlyError,
  getAnthropic,
  hasApiKey,
  isMockMode,
} from "@/lib/server/anthropic";
import { listBooks, type Book } from "@/lib/server/books-repo";
import { isDbConfigured } from "@/lib/server/db";
import { runMockChat } from "@/lib/server/mock";
import { BOOK_TOOLS, runBookTool, toolLabel } from "@/lib/server/tools";
import {
  encodeEvent,
  type ChatRequestBody,
  type ChatRequestMessage,
  type ChatStreamEvent,
  type SourceRef,
} from "@/lib/stream-protocol";

export const maxDuration = 300;

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type BetaToolUnion = Anthropic.Beta.BetaToolUnion;

const MAX_ITERATIONS = 8;

const AttachmentSchema = z.object({
  kind: z.enum(["image", "pdf"]),
  name: z.string(),
  mediaType: z.string(),
  data: z.string(),
});
const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string(),
        attachments: z.array(AttachmentSchema).optional(),
      }),
    )
    .min(1),
  options: z.object({
    model: z.string(),
    reasoning: z.boolean().default(false),
    quiz: z.boolean().default(false),
    webSearch: z.boolean().default(false),
    bookIds: z.array(z.string()).default([]),
  }),
  studentName: z.string().max(60).optional(),
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Converts the app's chat history into API messages (text + attachments). */
function toApiMessages(messages: ChatRequestMessage[]): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "assistant") {
      const text = m.text.trim();
      if (text) out.push({ role: "assistant", content: text });
      continue;
    }
    const blocks: BetaContentBlockParam[] = [];
    for (const a of m.attachments ?? []) {
      if (a.kind === "image" && IMAGE_TYPES.has(a.mediaType)) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: a.mediaType as "image/jpeg", data: a.data },
        });
      } else if (a.kind === "pdf") {
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: a.data },
          title: a.name,
        });
      }
    }
    blocks.push({ type: "text", text: m.text.trim() || "این فایل را برایم توضیح بده." });
    out.push({ role: "user", content: blocks });
  }
  // The API requires the conversation to start with a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };
      try {
        if (isMockMode()) {
          await runMockChat(send, abort.signal);
        } else if (!hasApiKey()) {
          send({ t: "error", message: "کلید API (ANTHROPIC_API_KEY) تنظیم نشده است. فایل ‎.env.local‎ را ببینید." });
        } else {
          await runChat(body, send, abort.signal);
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("chat error", err);
          send({ t: "error", message: friendlyError(err) });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function runChat(body: ChatRequestBody, send: (e: ChatStreamEvent) => void, signal: AbortSignal) {
  const client = getAnthropic();
  const model = modelById(body.options.model);

  let books: Book[] = [];
  if (isDbConfigured()) {
    try {
      books = await listBooks();
    } catch (err) {
      console.error("library unavailable", err);
    }
  }
  const knownIds = new Set(books.map((b) => b.id));
  const scope = body.options.bookIds.filter((id) => knownIds.has(id));
  const hasBooks = books.some((b) => b.pagesDone > 0);

  const tools: BetaToolUnion[] = [];
  if (hasBooks) tools.push(...BOOK_TOOLS);
  if (body.options.webSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: TEACHER_PERSONA },
    {
      type: "text",
      text: buildContextPrompt({
        books,
        scopeBookIds: scope,
        studentName: body.studentName?.trim() || undefined,
        quiz: body.options.quiz,
        webSearch: body.options.webSearch,
      }),
    },
  ];

  const messages = toApiMessages(body.messages);
  if (!messages.length) throw new Error("empty conversation");

  const effort = body.options.reasoning ? "high" : model.defaultEffort;
  let hasText = false;
  let stopReason: string | null = null;
  let jsonRetries = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.beta.messages.stream(
      {
        model: model.id,
        max_tokens: 64000,
        system,
        messages,
        ...(tools.length ? { tools } : {}),
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort },
        cache_control: { type: "ephemeral" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      },
      { signal },
    );

    let thinkingStarted = false;
    let sentTextThisTurn = false;
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "text" && hasText) send({ t: "text", d: "\n\n" });
        if (block.type === "thinking" && thinkingStarted) send({ t: "thinking", d: "\n\n" });
        if (block.type === "tool_use") {
          send({ t: "tool", id: block.id, name: block.name as "search_books", label: toolLabel(block.name, null) });
        }
        if (block.type === "server_tool_use") {
          send({ t: "tool", id: block.id, name: "web_search", label: "جستجو در انترنت…" });
        }
        if (block.type === "web_search_tool_result") {
          send({ t: "tool_done", id: block.tool_use_id });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          hasText = true;
          sentTextThisTurn = true;
          send({ t: "text", d: event.delta.text });
        } else if (event.delta.type === "thinking_delta") {
          thinkingStarted = true;
          send({ t: "thinking", d: event.delta.thinking });
        }
      }
    }

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // With eager input streaming, a tool input that is not parseable JSON rejects
      // finalMessage(). Re-issue that turn (at most twice); rethrow API errors.
      if (err instanceof Anthropic.APIError || signal.aborted || sentTextThisTurn || jsonRetries++ >= 2) throw err;
      continue;
    }
    stopReason = message.stop_reason;

    if (message.stop_reason === "refusal") {
      send({ t: "text", d: (hasText ? "\n\n" : "") + REFUSAL_TEXT });
      break;
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    // Update chips with the real queries now that the inputs are complete.
    for (const tool of toolUses) {
      send({ t: "tool", id: tool.id, name: tool.name as "search_books", label: toolLabel(tool.name, tool.input) });
    }

    messages.push({ role: "assistant", content: message.content });
    const results = await Promise.all(toolUses.map((tool) => runBookTool(tool.name, tool.input, scope)));

    const sources: SourceRef[] = results.flatMap((r) => r.sources);
    if (sources.length) send({ t: "sources", items: sources });
    for (const tool of toolUses) send({ t: "tool_done", id: tool.id });

    messages.push({
      role: "user",
      content: toolUses.map((tool, i) => ({
        type: "tool_result" as const,
        tool_use_id: tool.id,
        content: results[i].content,
        ...(results[i].isError ? { is_error: true } : {}),
      })),
    });
  }

  send({ t: "done", stop: stopReason });
}
