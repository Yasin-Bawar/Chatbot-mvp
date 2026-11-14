import type { ChatStreamEvent } from "@/lib/stream-protocol";

/**
 * Canned answer used when MOCK_AI=1, so the UI (streaming, Markdown, math,
 * tables, callouts, quizzes, tool chips) can be developed without an API key.
 */
const MOCK_ANSWER = `## فتوسنتز چیست؟ 🌱

**فتوسنتز** روشی است که نباتات با آن غذای خود را می‌سازند. نبات از **نور آفتاب**، **آب** و **کاربن دای اکساید** استفاده می‌کند و **گلوکوز** (قند) و **اکسیجن** می‌سازد (کتاب بیولوژی صنف هفتم، صفحه ۴۵).

### مراحل ساده

1. ریشه‌ها آب را از خاک جذب می‌کنند.
2. برگ‌ها کاربن دای اکساید را از هوا می‌گیرند.
3. **کلوروفیل** (رنگ سبز برگ) نور آفتاب را جذب می‌کند.
4. نبات با این انرژی، گلوکوز و اکسیجن می‌سازد.

### معادله کیمیاوی

$$6CO_2 + 6H_2O \\xrightarrow{\\text{نور}} C_6H_{12}O_6 + 6O_2$$

> 💡 **نکته:** اکسیجنی که ما تنفس می‌کنیم، از همین فتوسنتز به دست می‌آید!

| ورودی | خروجی |
| --- | --- |
| آب ($H_2O$) | گلوکوز ($C_6H_{12}O_6$) |
| کاربن دای اکساید ($CO_2$) | اکسیجن ($O_2$) |
| نور آفتاب | انرژی ذخیره‌شده |

مثل نانوایی که با آرد و آب و آتش نان می‌پزد، برگ هم با آب و هوا و نور آفتاب غذا می‌سازد. 🍞

حالا یک آزمونک کوچک:

\`\`\`quiz
{"title": "آزمونک: فتوسنتز", "questions": [{"q": "نبات برای فتوسنتز به کدام یک نیاز ندارد؟", "options": ["نور آفتاب", "آب", "نمک", "کاربن دای اکساید"], "answer": 2, "explain": "نبات برای فتوسنتز به نور، آب و کاربن دای اکساید نیاز دارد، نه نمک."}, {"q": "کدام گاز در فتوسنتز آزاد می‌شود؟", "options": ["اکسیجن", "نایتروجن", "هایدروجن"], "answer": 0, "explain": "اکسیجن محصول فتوسنتز است و به هوا آزاد می‌شود."}]}
\`\`\`

**سوال برای شما:** چرا برگ‌های نبات سبز رنگ هستند؟ 🤔`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runMockChat(send: (e: ChatStreamEvent) => void, signal: AbortSignal) {
  const thought = "Student asks about photosynthesis. I will search the biology book, then explain step by step with a simple Afghan example and a short quiz.";
  for (const word of thought.split(" ")) {
    if (signal.aborted) return;
    send({ t: "thinking", d: word + " " });
    await sleep(25);
  }
  send({ t: "tool", id: "mock1", name: "search_books", label: "جستجو در کتاب‌ها: «فتوسنتز»" });
  await sleep(900);
  send({ t: "sources", items: [{ bookId: "demo", title: "بیولوژی صنف هفتم", page: 45 }, { bookId: "demo", title: "بیولوژی صنف هفتم", page: 46 }] });
  send({ t: "tool_done", id: "mock1" });

  let i = 0;
  while (i < MOCK_ANSWER.length) {
    if (signal.aborted) return;
    const size = 4 + Math.floor(Math.random() * 18);
    send({ t: "text", d: MOCK_ANSWER.slice(i, i + size) });
    i += size;
    await sleep(30 + Math.random() * 40);
  }
  send({ t: "done", stop: "end_turn" });
}
