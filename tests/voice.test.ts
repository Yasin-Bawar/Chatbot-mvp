import { describe, expect, it } from "vitest";
import { appPasswords, checkPassword, sessionFor, validSession } from "@/lib/auth";
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

describe("password gate", () => {
  const env = { APP_PASSWORD: "school-2026, class9 " };

  it("reads one or more passwords", () => {
    expect(appPasswords(env)).toEqual(["school-2026", "class9"]);
    expect(appPasswords({})).toEqual([]);
  });

  it("accepts only the right password", () => {
    expect(checkPassword(" class9", env)).toBe("class9");
    expect(checkPassword("class", env)).toBeNull();
    expect(checkPassword("", env)).toBeNull();
  });

  it("a session works until its password is changed", async () => {
    const cookie = await sessionFor("class9", env);
    expect(await validSession(cookie, env)).toBe(true);
    expect(await validSession("forged", env)).toBe(false);
    expect(await validSession(undefined, env)).toBe(false);
    expect(await validSession(cookie, { APP_PASSWORD: "school-2026" })).toBe(false);
  });
});
