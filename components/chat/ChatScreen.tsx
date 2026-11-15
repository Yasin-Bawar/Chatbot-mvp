"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Atom, BookOpenText, Calculator, FlaskConical, Globe2, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "@/lib/chat/store";
import { useMounted } from "@/lib/hooks/useMounted";
import { useStickToBottom } from "@/lib/hooks/useStickToBottom";
import { useUi } from "@/lib/ui-store";
import { cn, greeting } from "@/lib/utils";
import { Orb } from "@/components/ui/Orb";
import { Composer } from "./Composer";
import { AssistantMessage, UserMessage } from "./Messages";
import { PageViewer, type PageTarget } from "./PageViewer";
import { BookScopePicker, ModelPicker } from "./Pickers";

const SUGGESTIONS = [
  { Icon: FlaskConical, color: "#10B981", title: "بیولوژی", text: "فتوسنتز را خیلی ساده برایم توضیح بده." },
  { Icon: Calculator, color: "#4F46E5", title: "ریاضی", text: "معادله درجه دوم را با یک مثال قدم به قدم حل کن." },
  { Icon: Atom, color: "#0EA5E9", title: "فزیک", text: "قانون دوم نیوتن را با مثال‌های روزمره توضیح بده." },
  { Icon: Languages, color: "#F59E0B", title: "انگلیسی", text: "فرق بین present simple و present continuous چیست؟" },
  { Icon: Globe2, color: "#0D9488", title: "جغرافیه", text: "دریاهای مهم افغانستان کدام‌ها هستند؟" },
  { Icon: BookOpenText, color: "#7C3AED", title: "آزمونک", text: "از درس سیستم هاضمه یک آزمونک ۵ سوالی بساز." },
];

export function ChatScreen() {
  const mounted = useMounted();
  const hydrated = useChatStore((s) => s.hydrated);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const chat = useChatStore((s) => (s.activeChatId ? s.chats[s.activeChatId] : undefined));
  const studentName = useChatStore((s) => s.settings.studentName);
  const [source, setSource] = useState<PageTarget | null>(null);
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const messages = chat?.messages ?? [];
  const last = messages[messages.length - 1];
  const streaming = last?.role === "assistant" && last.status === "streaming";
  const empty = !chat || messages.length === 0;
  const ready = mounted && hydrated;
  const { scrollRef, contentRef, atBottom, scrollToBottom } = useStickToBottom<HTMLDivElement, HTMLDivElement>(
    ready && !empty,
    activeChatId,
  );

  // Scrolling down to read hides the top bars; scrolling up (or reaching the top) brings them back.
  const chromeHidden = useUi((s) => s.chromeHidden);
  const setChromeHidden = useUi((s) => s.setChromeHidden);
  useEffect(() => {
    const el = scrollRef.current;
    if (!ready || empty || !el) {
      setChromeHidden(false);
      return;
    }
    let lastY = el.scrollTop;
    let travel = 0;
    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastY;
      lastY = y;
      if (y < 48) {
        travel = 0;
        setChromeHidden(false);
        return;
      }
      if (Math.sign(dy) !== Math.sign(travel)) travel = 0;
      travel += dy;
      if (travel > 36) setChromeHidden(true);
      else if (travel < -36) setChromeHidden(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      setChromeHidden(false);
    };
  }, [ready, empty, activeChatId, scrollRef, setChromeHidden]);

  // A finished exam sends its result: bring the newest messages into view.
  useEffect(() => {
    const onScroll = () => setTimeout(() => scrollToBottom(), 50);
    window.addEventListener("dana:scroll-bottom", onScroll);
    return () => window.removeEventListener("dana:scroll-bottom", onScroll);
  }, [scrollToBottom]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="chrome-collapse" data-hidden={chromeHidden && !empty ? "true" : undefined}>
        <div>
          <header className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pb-1.5 pt-2 md:px-6 md:pt-4">
            <ModelPicker />
            <BookScopePicker />
          </header>
        </div>
      </div>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center">
          <Orb size={64} busy />
        </div>
      ) : empty ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-6 pt-2 md:px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Orb size={84} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-5 text-center text-[22px] font-extrabold leading-[1.6] text-[#2b2d3a] sm:text-[30px]"
            >
              {greeting()}
              {studentName ? `، ${studentName}` : ""}
              <br />
              امروز چه چیزی را <span className="text-gradient">یاد بگیریم؟</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-6 w-full"
            >
              <Composer chatId={null} streaming={false} variant="hero" seed={seed} />
            </motion.div>

            <div className="mt-5 grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
              {SUGGESTIONS.map(({ Icon, color, title, text }, i) => (
                <motion.button
                  key={title}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  whileHover={{ y: -3 }}
                  onClick={() => setSeed({ text, nonce: Date.now() })}
                  className={cn(
                    "flex flex-col gap-1 rounded-2xl border border-line bg-surface/80 p-3 text-start shadow-[var(--shadow-sm)] transition hover:border-primary/25 hover:shadow-[var(--shadow-md)]",
                    i >= 4 && "hidden sm:flex",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color }}>
                    <Icon className="size-4" />
                    {title}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-6 text-ink-2">{text}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div ref={contentRef} className="mx-auto flex w-full max-w-[50rem] flex-col gap-5 px-3 pb-6 pt-3 sm:gap-6 md:px-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} chatId={chat.id} message={m} disabled={streaming} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    chatId={chat.id}
                    message={m}
                    isLast={i === messages.length - 1}
                    onOpenSource={setSource}
                  />
                ),
              )}
            </div>
          </div>

          <AnimatePresence>
            {!atBottom && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={() => scrollToBottom()}
                className="absolute bottom-28 start-1/2 z-10 grid size-9 translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-[var(--shadow-lg)]"
                aria-label="رفتن به پایین"
              >
                <ArrowDown className="size-5" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="safe-bottom mx-auto w-full max-w-[50rem] px-2.5 pt-1 md:px-6">
            <Composer chatId={activeChatId} streaming={streaming} variant="dock" />
          </div>
        </>
      )}

      <PageViewer target={source} onClose={() => setSource(null)} />
    </div>
  );
}
