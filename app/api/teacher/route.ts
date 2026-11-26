import { z } from "zod";
import { LIGHT_MODEL } from "@/lib/models";
import { voiceTeacherPrompt } from "@/lib/prompts/voice-teacher";
import { friendlyError, getAnthropic, hasApiKey, isMockMode } from "@/lib/server/anthropic";
import { recordUsage } from "@/lib/server/budget";
import { currentUser, takeQuestion } from "@/lib/server/quota";
import { teacherById } from "@/lib/teachers";

/**
 * One turn of a voice lesson. Streams plain text: spoken Dari sentences and
 * `@board {json}` / `@clear` lines (see lib/prompts/voice-teacher.ts). Always
 * uses the cheapest model and no extended thinking, so the teacher answers fast.
 */

export const maxDuration = 60;

const BodySchema = z.object({
  teacher: z.string().max(20),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .min(1)
    .max(60),
});

const MOCK_TURNS = [
  `سلام! خوش آمدی به درس ریاضی.
امروز چه می‌خواهی یاد بگیری؟ معادله درجه دوم یا کسرها؟`,
  `@clear
@board {"title": "حل معادله درجه دوم"}
@board {"math": "x^2 - 5x + 6 = 0", "note": "معادله داده شده"}
خوب، این معادله را روی تخته نوشتم.
ما دو عدد می‌خواهیم که ضرب‌شان شش و جمع‌شان منفی پنج شود. می‌توانی آن دو عدد را پیدا کنی؟`,
  `@board {"math": "(x - 2)(x - 3) = 0", "note": "تجزیه"}
آفرین! منفی دو و منفی سه.
پس معادله را این طور می‌نویسیم. حالا هر قوس را مساوی صفر بگذار.`,
  `@board {"answer": "x = 2 \\\\quad \\\\text{or} \\\\quad x = 3"}
عالی! جواب‌ها دو و سه هستند. سوال دیگری داری؟`,
];

function mockStream(turn: number): Response {
  const text = MOCK_TURNS[Math.min(turn, MOCK_TURNS.length - 1)];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const piece of text.match(/[\s\S]{1,6}/g) ?? []) {
        controller.enqueue(encoder.encode(piece));
        await new Promise((r) => setTimeout(r, 25));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const teacher = teacherById(parsed.data.teacher);
  if (!teacher) return Response.json({ error: "unknown_teacher" }, { status: 404 });

  const turns = parsed.data.messages.slice(-30);
  if (isMockMode() || !hasApiKey()) return mockStream(turns.filter((m) => m.role === "assistant").length);

  // The API needs the conversation to start with the student and alternate.
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of turns) {
    const text = m.text.trim() || "…";
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content += `\n${text}`;
    else if (messages.length || m.role === "user") messages.push({ role: m.role, content: text });
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  const refused = await takeQuestion(await currentUser(req), "voice");
  if (refused) return refused;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = getAnthropic().beta.messages.stream(
          {
            model: LIGHT_MODEL,
            max_tokens: 900,
            system: [{ type: "text", text: voiceTeacherPrompt(teacher) }],
            messages,
            cache_control: { type: "ephemeral" },
          },
          { signal: req.signal },
        );
        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await response.finalMessage();
        await recordUsage("voice", LIGHT_MODEL, final.usage);
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[teacher] failed", err);
          controller.enqueue(encoder.encode(`\n${friendlyError(err)}\n`));
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed (the student interrupted)
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
