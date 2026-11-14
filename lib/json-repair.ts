/**
 * Models often write LaTeX inside JSON with single backslashes ("\frac"),
 * which JSON would read as escapes (\f = form feed, \t = tab, \n = newline…).
 * Doubles every backslash that starts a LaTeX command and is not already escaped,
 * leaving \" \\ \/ and \uXXXX untouched.
 */
export function escapeLatexBackslashes(json: string): string {
  return json.replace(/(\\\\)|\\(?=[a-tv-zA-Z]|u(?![0-9a-fA-F]{4}))|\\(?=[{}()[\]|,;:!> ])/g, (m, doubled: string | undefined) =>
    doubled ? doubled : "\\\\",
  );
}

/** JSON.parse that first repairs LaTeX backslashes. Returns null on failure. */
export function parseLooseJson<T = unknown>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(escapeLatexBackslashes(trimmed)) as T;
  } catch {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
}
