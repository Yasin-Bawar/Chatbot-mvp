import { describe, expect, it } from "vitest";
import { canUseLibrary, checkLogin, sessionFor, userFromSession } from "@/lib/auth";
import { parseBoard } from "@/lib/board/parse";
import { boardRaw, soundsLikeEcho, speakable, TeacherStream } from "@/lib/voice/stream";

/** Feeds text in small random-ish pieces, like a network stream. */
function run(text: string, size = 5) {
  const s = new TeacherStream();
  const speech: string[] = [];
  const board: string[] = [];
  let clears = 0;
  const take = (c: { speech: string[]; board: string[]; clear: boolean }) => {
    if (c.clear) {
      clears++;
      board.length = 0;
    }
    speech.push(...c.speech);
    board.push(...c.board);
  };
  for (let i = 0; i < text.length; i += size) take(s.push(text.slice(i, i + size)));
  take(s.flush());
  return { speech, board, clears };
}

describe("voice teacher stream", () => {
  it("separates spoken sentences from board lines", () => {
    const r = run(
      `@clear\n@board {"title": "حل معادله"}\n@board {"math": "x^2 - 5x + 6 = 0"}\nخوب، این معادله را نوشتم. دو عدد پیدا کن که ضرب‌شان شش شود؟ آفرین`,
    );
    expect(r.clears).toBe(1);
    expect(r.board).toEqual(['{"title": "حل معادله"}', '{"math": "x^2 - 5x + 6 = 0"}']);
    expect(r.speech).toEqual(["خوب، این معادله را نوشتم.", "دو عدد پیدا کن که ضرب‌شان شش شود؟", "آفرین"]);
    expect(parseBoard(boardRaw(r.board)).steps).toHaveLength(1);
  });

  it("speaks a finished sentence before the line is complete", () => {
    const s = new TeacherStream();
    expect(s.push("سلام! امروز ").speech).toEqual(["سلام!"]);
    expect(s.push("چه یاد بگیریم").speech).toEqual([]);
    expect(s.flush().speech).toEqual(["امروز چه یاد بگیریم"]);
  });

  it("waits for a whole board line, even when it arrives in pieces", () => {
    const s = new TeacherStream();
    expect(s.push("@bo")).toEqual({ speech: [], board: [], clear: false });
    expect(s.push('ard {"math": "1+1=2"}').board).toEqual([]);
    expect(s.push("\nبله.").board).toEqual(['{"math": "1+1=2"}']);
  });

  it("never reads Markdown, LaTeX or emoji aloud", () => {
    expect(speakable("**آفرین!** جواب $x=2$ است 🎉")).toBe("آفرین! جواب است");
  });

  it("recognises the teacher's own voice coming back through the microphone", () => {
    expect(soundsLikeEcho("این معادله را نوشتم", "خوب، این معادله را روی تخته نوشتم.")).toBe(true);
    expect(soundsLikeEcho("ببخشید یک سوال دارم", "خوب، این معادله را روی تخته نوشتم.")).toBe(false);
  });
});

describe("login accounts", () => {
  const env = { AUTH_SECRET: "test-secret" };

  it("accepts only the right username and password", () => {
    expect(checkLogin("admin", "Yasin2025@")?.role).toBe("admin");
    expect(checkLogin(" Teacher ", "12345678")).toMatchObject({ username: "teacher", role: "teacher", dailyLimit: 20 });
    expect(checkLogin("teacher", "Yasin2025@")).toBeNull();
    expect(checkLogin("admin", "")).toBeNull();
    expect(checkLogin("nobody", "12345678")).toBeNull();
  });

  it("only the admin may use the library", () => {
    expect(canUseLibrary(checkLogin("admin", "Yasin2025@"))).toBe(true);
    expect(canUseLibrary(checkLogin("teacher", "12345678"))).toBe(false);
    expect(canUseLibrary(null)).toBe(false);
  });

  it("a session names its account and cannot be forged", async () => {
    const cookie = await sessionFor("teacher", env);
    expect((await userFromSession(cookie, env))?.username).toBe("teacher");
    expect(await userFromSession(cookie.replace(/^teacher/, "admin"), env)).toBeNull();
    expect(await userFromSession("admin.forged", env)).toBeNull();
    expect(await userFromSession(undefined, env)).toBeNull();
    expect(await userFromSession(cookie, { AUTH_SECRET: "another" })).toBeNull();
  });
});

describe("board lines in the forms models really write", () => {
  it("accepts fenced blocks, bare JSON, a colon and list marks", () => {
    const r = run(
      [
        "خوب، بیایید حل کنیم.",
        "```board",
        '{"title": "معادله"}',
        '{"math": "x + 2 = 5"}',
        "```",
        '- @board: {"math": "x = 3"}',
        '{"answer": "x = 3"}',
        '`@board {"text": "تمام"}`',
        "@board",
        '{"step": "قدم دوم"}',
        "آفرین!",
      ].join("\n"),
    );
    expect(r.board).toEqual([
      '{"title": "معادله"}',
      '{"math": "x + 2 = 5"}',
      '{"math": "x = 3"}',
      '{"answer": "x = 3"}',
      '{"text": "تمام"}',
      '{"step": "قدم دوم"}',
    ]);
    expect(r.speech).toEqual(["خوب، بیایید حل کنیم.", "آفرین!"]);
  });

  it("puts spoken-only math on the board", () => {
    const r = run("جواب $x = 2$ است. و $y=3$ هم.");
    expect(r.board).toEqual(['{"math":"x = 2"}', '{"math":"y=3"}']);
    expect(r.speech).toEqual(["جواب است.", "و هم."]);
  });

  it("does not repeat math the teacher already wrote", () => {
    const r = run('@board {"math": "x=2"}\nجواب $x=2$ است.');
    expect(r.board).toEqual(['{"math": "x=2"}']);
  });
});
