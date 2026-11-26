import { SESSION_COOKIE, userFromSession, type AppUser } from "@/lib/auth";
import { getDb, isDbConfigured } from "./db";

/** The logged-in account that sent this request (proxy.ts already turned away everyone else). */
export async function currentUser(req: Request): Promise<AppUser | null> {
  const cookie = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return userFromSession(cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : undefined);
}

/** Start of today in Kabul (UTC+4:30). */
export function kabulDayStart(now = new Date()): Date {
  const offset = 4.5 * 3600_000;
  const day = 86400_000;
  return new Date(Math.floor((now.getTime() + offset) / day) * day - offset);
}

export async function questionsToday(username: string): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM user_questions WHERE username = $1 AND created_at >= $2`,
    [username, kabulDayStart().toISOString()],
  );
  return Number(row?.n ?? 0);
}

export const LIMIT_MESSAGE = (limit: number) =>
  `سهمیه امروز شما (${limit.toLocaleString("fa-AF")} سوال) تمام شد. فردا دوباره می‌توانید سوال بپرسید.`;

/**
 * Counts one AI question for the user. Returns a 429 response when today's
 * limit is reached, or null to go ahead. Accounts without a limit are not
 * counted. If the count cannot be read, the question is allowed (and logged).
 */
export async function takeQuestion(user: AppUser | null, kind: "chat" | "voice"): Promise<Response | null> {
  if (!user || user.dailyLimit === null) return null;
  if (!isDbConfigured()) {
    console.error("[quota] no database: the daily limit is not counted");
    return null;
  }
  try {
    const used = await questionsToday(user.username);
    if (used >= user.dailyLimit) {
      return Response.json(
        { error: "daily_limit", message: LIMIT_MESSAGE(user.dailyLimit), limit: user.dailyLimit, used },
        { status: 429 },
      );
    }
    const db = await getDb();
    await db.query(`INSERT INTO user_questions (username, kind) VALUES ($1, $2)`, [user.username, kind]);
    return null;
  } catch (err) {
    console.error("[quota] could not count the question", err);
    return null;
  }
}
