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

const MATH_ANSWER = `بیایید این معادله را روی تخته با هم قدم به قدم حل کنیم. ✏️

\`\`\`board
{"title": "حل معادله درجه دوم با تجزیه"}
{"step": "قدم ۱: معادله را بنویسیم"}
{"math": "x^2 - 5x + 6 = 0", "note": "معادله داده شده"}
{"step": "قدم ۲: دو عدد پیدا کنیم"}
{"text": "دو عدد می‌خواهیم که ضرب آن‌ها $6$ و جمع آن‌ها $-5$ باشد."}
{"math": "(-2) \\times (-3) = 6 \\qquad (-2) + (-3) = -5", "note": "این دو عدد ‎-2 و ‎-3 هستند"}
{"step": "قدم ۳: تجزیه کنیم"}
{"math": "(x - 2)(x - 3) = 0"}
{"math": "x - 2 = 0 \\quad \\text{or} \\quad x - 3 = 0", "note": "اگر ضرب دو عدد صفر باشد، یکی از آن‌ها صفر است"}
{"step": "قدم ۴: روی گراف ببینیم"}
{"graph": {"fns": ["x^2-5x+6"], "x": [-1, 6], "y": [-1.5, 7], "points": [[2, 0, "x=2"], [3, 0, "x=3"]]}, "note": "منحنی محور x را در ۲ و ۳ قطع می‌کند"}
{"answer": "x_1 = 2 \\qquad x_2 = 3"}
\`\`\`

> 💡 **نکته:** همیشه جواب را در معادله اصلی امتحان کنید: $2^2 - 5(2) + 6 = 0$ ✅

**تمرین برای شما:** معادله $x^2 - 7x + 12 = 0$ را به همین روش حل کنید. 🤔`;

const PHYSICS_ANSWER = `خوب! این سوال قانون دوم نیوتن است. بیایید روی تخته حلش کنیم. 🚀

\`\`\`board
{"title": "قانون دوم نیوتن: F = ma"}
{"step": "قدم ۱: شکل را بکشیم"}
{"draw": {"items": [{"t": "polygon", "points": [[0,0],[3,0],[3,2],[0,2]], "fill": true, "label": "4 kg"}, {"t": "line", "from": [-2,0], "to": [7,0], "color": "white"}, {"t": "arrow", "from": [3,1], "to": [6,1], "label": "F = 20 N", "color": "yellow"}, {"t": "arrow", "from": [1.5,0], "to": [1.5,-2], "label": "W", "color": "pink"}, {"t": "arrow", "from": [1.5,2], "to": [1.5,4], "label": "N", "color": "blue"}]}, "note": "یک جعبه ۴ کیلوگرامی با قوه ۲۰ نیوتن کش می‌شود"}
{"step": "قدم ۲: معلومات"}
{"math": "m = 4\\,\\text{kg} \\qquad F = 20\\,\\text{N} \\qquad a = ?"}
{"step": "قدم ۳: فورمول و حل"}
{"math": "F = m \\cdot a", "note": "قانون دوم نیوتن"}
{"math": "a = \\frac{F}{m}", "note": "هر دو طرف را تقسیم بر m می‌کنیم"}
{"math": "a = \\frac{20\\,\\text{N}}{4\\,\\text{kg}}"}
{"answer": "a = 5\\,\\text{m/s}^2", "note": "جعبه در هر ثانیه ۵ متر فی ثانیه تیزتر می‌شود"}
\`\`\`

قوه بیشتر ← تعجیل بیشتر؛ کتله بیشتر ← تعجیل کمتر. ⚖️

**تمرین:** اگر همین قوه را به یک جعبه ۱۰ کیلوگرامی وارد کنیم، تعجیل چند می‌شود؟`;

const GEOMETRY_ANSWER = `این یک سوال قضیه فیثاغورث است. بیایید روی تخته بکشیم و حل کنیم. 📐

\`\`\`board
{"title": "قضیه فیثاغورث"}
{"step": "قدم ۱: مثلث قایم‌الزاویه را بکشیم"}
{"draw": {"grid": true, "items": [{"t": "polygon", "points": [[0,0],[4,0],[0,3]], "fill": true}, {"t": "angle", "at": [0,0], "from": [4,0], "to": [0,3], "right": true}, {"t": "point", "at": [0,0], "label": "C"}, {"t": "point", "at": [4,0], "label": "A"}, {"t": "point", "at": [0,3], "label": "B"}, {"t": "line", "from": [0,0], "to": [4,0], "label": "$a = 4$", "color": "yellow"}, {"t": "line", "from": [0,0], "to": [0,3], "label": "$b = 3$", "color": "yellow"}, {"t": "line", "from": [4,0], "to": [0,3], "label": "$c = ?$", "color": "pink"}]}, "note": "زاویه C قایمه (۹۰ درجه) است"}
{"step": "قدم ۲: فورمول"}
{"math": "c^2 = a^2 + b^2", "note": "مربع وتر مساوی است به مجموع مربع‌های دو ضلع دیگر"}
{"step": "قدم ۳: عددها را بگذاریم"}
{"math": "c^2 = 4^2 + 3^2"}
{"math": "c^2 = 16 + 9 = 25"}
{"math": "c = \\sqrt{25}", "note": "از هر دو طرف جذر می‌گیریم"}
{"answer": "c = 5"}
\`\`\`

این مثلث مشهور «۳، ۴، ۵» است. نجاران و معماران از همین قاعده برای ساختن زاویه قایمه استفاده می‌کنند! 🏠

**تمرین:** اگر دو ضلع ۶ و ۸ باشند، وتر چند است؟`;

const QUIZ_ANSWER = `آفرین که می‌خواهید خود را امتحان کنید! 💪 این آزمونک ۵ سوالی درباره **سیستم هاضمه** است:

\`\`\`quiz
{"title": "آزمونک: سیستم هاضمه", "questions": [
{"q": "هضم غذا از کدام عضو شروع می‌شود؟", "options": ["معده", "دهن", "روده باریک", "مری"], "answer": 1, "explain": "هضم از دهن شروع می‌شود؛ دندان‌ها غذا را میده می‌کنند و لعاب دهن هضم نشایسته را آغاز می‌کند."},
{"q": "معده اسید دارد تا میکروب‌ها را از بین ببرد.", "options": ["درست", "نادرست"], "answer": 0, "explain": "اسید معده هم به هضم پروتین کمک می‌کند و هم بسیاری از میکروب‌ها را از بین می‌برد."},
{"q": "بیشترین جذب مواد غذایی در کجا صورت می‌گیرد؟", "options": ["روده بزرگ", "معده", "روده باریک", "جگر"], "answer": 2, "explain": "دیواره روده باریک پرزهای زیادی دارد که مواد غذایی را جذب خون می‌کنند."},
{"q": "اگر روده باریک $6\\,\\text{m}$ و روده بزرگ $1.5\\,\\text{m}$ باشد، طول مجموعی آن‌ها چند متر است؟", "options": ["$6.5$", "$7.5$", "$8$", "$4.5$"], "answer": 1, "explain": "$6 + 1.5 = 7.5$ متر."},
{"q": "کدام عضو صفرا می‌سازد؟", "options": ["پانقراس", "جگر", "گرده", "طحال"], "answer": 1, "explain": "جگر صفرا می‌سازد و صفرا در کیسه صفرا ذخیره می‌شود؛ صفرا به هضم چربی کمک می‌کند."}
]}
\`\`\`

موفق باشید! 🌟`;

const REVIEW_ANSWER = `آفرین برای تلاش شما! 👏 آزمونک را تا آخر حل کردید و این خودش خیلی خوب است.

## مرور اشتباهات

> 💡 **نکته:** هر اشتباه یک فرصت برای یادگیری است!

1. **هضم از دهن شروع می‌شود**، نه از معده. دندان‌ها غذا را میده می‌کنند و **لعاب دهن** هضم را آغاز می‌کند.
2. **جگر** صفرا می‌سازد و **کیسه صفرا** آن را ذخیره می‌کند.

برای مرور، صفحه‌های **سیستم هاضمه** در کتاب بیولوژی را یک بار دیگر بخوانید (کتاب بیولوژی صنف یازدهم، صفحه ۴۲).

**سوال تمرینی:** صفرا به هضم کدام نوع غذا کمک می‌کند؟ 🤔`;

/** Picks a demo answer that matches the student's question. */
function pickAnswer(question: string): { text: string; tool: string; source: { title: string; page: number } } {
  if (question.startsWith("📝")) {
    return { text: REVIEW_ANSWER, tool: "سیستم هاضمه", source: { title: "بیولوژی صنف یازدهم", page: 42 } };
  }
  if (/آزمون|امتحان|quiz|سوال تمرینی/i.test(question)) {
    return { text: QUIZ_ANSWER, tool: "سیستم هاضمه", source: { title: "بیولوژی صنف یازدهم", page: 42 } };
  }
  if (/مثلث|فیثاغورث|زاویه|هندسه|وتر|triangle|pythag/i.test(question)) {
    return { text: GEOMETRY_ANSWER, tool: "قضیه فیثاغورث", source: { title: "ریاضی صنف هشتم", page: 74 } };
  }
  if (/نیوتن|قوه|فزیک|تعجیل|newton|force/i.test(question)) {
    return { text: PHYSICS_ANSWER, tool: "قانون دوم نیوتن", source: { title: "فزیک صنف هشتم", page: 32 } };
  }
  if (/معادله|حل کن|ریاضی|x\^?2|\d\s*[x+\-=]|equation|solve/i.test(question)) {
    return { text: MATH_ANSWER, tool: "معادله درجه دوم", source: { title: "ریاضی صنف نهم", page: 58 } };
  }
  return { text: MOCK_ANSWER, tool: "فتوسنتز", source: { title: "بیولوژی صنف هفتم", page: 45 } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runMockChat(send: (e: ChatStreamEvent) => void, signal: AbortSignal, question = "") {
  const answer = pickAnswer(question);
  const thought = "The student asked a school question. I will search the book first, then explain step by step like a teacher.";
  for (const word of thought.split(" ")) {
    if (signal.aborted) return;
    send({ t: "thinking", d: word + " " });
    await sleep(25);
  }
  send({ t: "tool", id: "mock1", name: "search_books", label: `جستجو در کتاب‌ها: «${answer.tool}»` });
  await sleep(900);
  send({
    t: "sources",
    items: [
      { bookId: "demo", title: answer.source.title, page: answer.source.page },
      { bookId: "demo", title: answer.source.title, page: answer.source.page + 1 },
    ],
  });
  send({ t: "tool_done", id: "mock1" });

  const text = answer.text;
  let i = 0;
  while (i < text.length) {
    if (signal.aborted) return;
    const size = 4 + Math.floor(Math.random() * 18);
    send({ t: "text", d: text.slice(i, i + size) });
    i += size;
    await sleep(30 + Math.random() * 40);
  }
  send({ t: "done", stop: "end_turn" });
}
