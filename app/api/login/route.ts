import { cookies } from "next/headers";
import { z } from "zod";
import { checkLogin, SESSION_COOKIE, SESSION_DAYS, sessionFor, userFromSession } from "@/lib/auth";
import { isDbConfigured } from "@/lib/server/db";
import { questionsToday } from "@/lib/server/quota";

/** GET: who am I (and today's questions)? POST: log in. DELETE: log out. */

export async function GET() {
  const jar = await cookies();
  const user = await userFromSession(jar.get(SESSION_COOKIE)?.value);
  let usedToday: number | null = null;
  if (user?.dailyLimit != null && isDbConfigured()) usedToday = await questionsToday(user.username).catch(() => null);
  return Response.json({ loggedIn: Boolean(user), user, usedToday }, { headers: { "Cache-Control": "no-store" } });
}

const BodySchema = z.object({ username: z.string().max(100), password: z.string().max(200) });

/** Only paths on this site (no "//other.site"). */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(req: Request) {
  // The page sends JSON; a plain HTML form post (before the page's script has loaded) sends form data.
  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  let input: unknown = null;
  let next = "/";
  if (isForm) {
    const form = await req.formData().catch(() => null);
    input = { username: form?.get("username") ?? "", password: form?.get("password") ?? "" };
    next = safeNext(form?.get("next"));
  } else {
    input = await req.json().catch(() => null);
  }
  const back = (url: string) => new Response(null, { status: 303, headers: { Location: url } });

  const parsed = BodySchema.safeParse(input);
  const user = parsed.success ? checkLogin(parsed.data.username, parsed.data.password) : null;
  if (!user) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 700));
    if (isForm) return back(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
    return Response.json({ ok: false, message: "نام کاربری یا رمز درست نیست. دوباره امتحان کنید." }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionFor(user.username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return isForm ? back(next) : Response.json({ ok: true, user });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
