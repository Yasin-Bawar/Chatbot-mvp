/**
 * Splits a voice teacher's streamed text into what to SAY (whole sentences, as
 * soon as each one is complete, so the voice can start early) and what to WRITE
 * on the board (`@board {json}` lines, `@clear`). Pure; tested in tests/voice.test.ts.
 */

export interface TeacherChunk {
  /** Complete sentences to speak, in order. */
  speech: string[];
  /** Board lines (the JSON after `@board `), in order. */
  board: string[];
  /** The board should be wiped before `board` is added. */
  clear: boolean;
}

// A sentence ends at . ! ? ؟ … or ۔ followed by a space (or at the end of a line).
const SENTENCE = /^([\s\S]*?[.!?؟…۔])(\s+)/;

/** Text the voice can read: no Markdown, LaTeX, emoji or stray symbols. */
export function speakable(text: string): string {
  return text
    .replace(/\$\$?[^$]*\$\$?/g, " ")
    .replace(/[*_`#>|~]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Board JSON keys (the same as the chat's ```board block). */
const BOARD_KEYS = /^\{\s*"(title|step|math|text|answer|graph|draw)"\s*:/;

export class TeacherStream {
  private pending = "";
  private inFence = false;
  private expectJson = false;
  private boardLines = 0;
  private latex: string[] = [];

  push(chunk: string): TeacherChunk {
    const out: TeacherChunk = { speech: [], board: [], clear: false };
    this.pending += chunk;
    let nl: number;
    while ((nl = this.pending.indexOf("\n")) >= 0) {
      const line = this.pending.slice(0, nl);
      this.pending = this.pending.slice(nl + 1);
      this.line(line, out, true);
    }
    // An unfinished line: speak its finished sentences now, unless it may be a board line.
    const head = this.pending.trimStart();
    if (head && !this.inFence && !this.expectJson && !/^[@{`]/.test(head)) {
      let m: RegExpMatchArray | null;
      while ((m = this.pending.match(SENTENCE))) {
        this.say(m[1], out);
        this.pending = this.pending.slice(m[0].length);
      }
    }
    return out;
  }

  /** The stream ended: whatever is left. */
  flush(): TeacherChunk {
    const out: TeacherChunk = { speech: [], board: [], clear: false };
    const rest = this.pending;
    this.pending = "";
    if (rest.trim()) this.line(rest, out, true);
    // The teacher only said its math out loud: put that math on the board anyway.
    if (this.boardLines === 0) {
      for (const tex of this.latex.slice(0, 4)) out.board.push(JSON.stringify({ math: tex }));
    }
    this.latex = [];
    this.boardLines = 0;
    return out;
  }

  private board(json: string, out: TeacherChunk) {
    out.board.push(json);
    this.boardLines++;
  }

  private line(raw: string, out: TeacherChunk, complete: boolean) {
    // Models sometimes add list marks, quotes or backticks around commands.
    const line = raw.trim().replace(/^[>*\-•]+\s*/, "");
    if (!line) return;
    if (line.startsWith("```")) {
      this.inFence = !this.inFence;
      return;
    }
    const json = line.replace(/^`+|`+$/g, "").trim();
    if (this.inFence || this.expectJson) {
      this.expectJson = false;
      if (json.startsWith("{")) this.board(json, out);
      return;
    }
    const command = json.match(/^@\s*(board|clear)\b\s*:?\s*(.*)$/i);
    if (command) {
      if (command[1].toLowerCase() === "clear") {
        out.clear = true;
        out.board.length = 0;
      } else if (command[2].startsWith("{")) {
        this.board(command[2], out);
      } else {
        this.expectJson = true; // the JSON is on the next line
      }
      return;
    }
    if (BOARD_KEYS.test(json)) {
      this.board(json, out);
      return;
    }
    if (line.startsWith("@")) return;
    let rest = line;
    let m: RegExpMatchArray | null;
    while ((m = rest.match(SENTENCE))) {
      this.say(m[1], out);
      rest = rest.slice(m[0].length);
    }
    if (complete && rest.trim()) this.say(rest, out);
  }

  private say(text: string, out: TeacherChunk) {
    for (const m of text.matchAll(/\$\$?([^$]+)\$\$?|\\\((.+?)\\\)/g)) {
      const tex = (m[1] ?? m[2] ?? "").trim();
      if (tex) this.latex.push(tex);
    }
    const clean = speakable(text);
    if (clean) out.speech.push(clean);
  }
}

/** Board JSON lines → the board format the chalkboard component reads. */
export function boardRaw(lines: string[]): string {
  return lines.map((l) => `${l}\n`).join("");
}

/** Rough "is this just the teacher's own voice coming back through the mic?" check. */
export function soundsLikeEcho(heard: string, spoken: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/[ً-ٟ‌]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  const h = norm(heard);
  if (!h) return true;
  const words = h.split(" ");
  const s = ` ${norm(spoken)} `;
  const found = words.filter((w) => s.includes(` ${w} `)).length;
  return words.length >= 2 ? found / words.length >= 0.6 : s.includes(` ${h} `);
}
