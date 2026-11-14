/**
 * Makes a partially streamed Markdown string safe to render, so raw symbols
 * like "**" or half-written formulas never flash on screen:
 * - closes an open code fence,
 * - hides an unfinished $$display$$ or $inline$ formula,
 * - closes dangling **bold** and `code`,
 * - hides a table whose delimiter row has not arrived yet,
 * - drops a half-written link.
 */
export function repairMarkdown(src: string): string {
  let text = src;

  const fences = text.match(/^\s*(```|~~~)/gm)?.length ?? 0;
  if (fences % 2 === 1) return text + "\n```";

  // Unfinished display math: hide from the last opening $$.
  const displayCount = text.match(/\$\$/g)?.length ?? 0;
  if (displayCount % 2 === 1) {
    text = text.slice(0, text.lastIndexOf("$$")).trimEnd();
  }

  // Work on the last paragraph only.
  const cut = text.lastIndexOf("\n\n");
  const head = cut >= 0 ? text.slice(0, cut + 2) : "";
  let tail = cut >= 0 ? text.slice(cut + 2) : text;

  // Table header without its |---| delimiter row yet → hide it for now.
  const tailLines = tail.split("\n");
  if (tailLines[0]?.trimStart().startsWith("|") && !tailLines.some((l) => /^\s*\|?\s*:?-{2,}/.test(l))) {
    return head.trimEnd();
  }

  // Unfinished inline math (odd number of single $).
  const singles = tail.replace(/\$\$/g, "").match(/(?<!\\)\$/g)?.length ?? 0;
  if (singles % 2 === 1) {
    const idx = findLastSingleDollar(tail);
    if (idx >= 0) tail = tail.slice(0, idx).trimEnd();
  }

  // Half-written link: "[text](http..." or "[text"
  tail = tail.replace(/\[[^\]\n]*\]\([^)\n]*$/, "").replace(/\[[^\]\n]*$/, "");

  // Dangling bold / inline code.
  tail = tail.replace(/(\*\*|__)\s*$/, "");
  const bold = tail.match(/\*\*/g)?.length ?? 0;
  if (bold % 2 === 1) tail = tail.trimEnd() + "**";
  const ticks = tail.replace(/```/g, "").match(/`/g)?.length ?? 0;
  if (ticks % 2 === 1) tail += "`";

  // A lone list marker or heading marker at the very end.
  tail = tail.replace(/(^|\n)\s*([-*+]|\d+\.|#{1,6})\s*$/, "$1");

  return head + tail;
}

function findLastSingleDollar(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] !== "$") continue;
    if (s[i - 1] === "$" || s[i + 1] === "$" || s[i - 1] === "\\") continue;
    return i;
  }
  return -1;
}

/**
 * A line that is only "$$…$$" is meant as a display formula, but remark-math
 * treats single-line $$ as inline math. Put the delimiters on their own lines.
 */
export function normalizeDisplayMath(src: string): string {
  return src.replace(/^[ \t]*\$\$([^\n$]+?)\$\$[ \t]*$/gm, (_m, tex: string) => `$$\n${tex.trim()}\n$$`);
}
