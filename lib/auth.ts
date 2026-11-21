/**
 * A simple password gate for the whole website. Set APP_PASSWORD (one password,
 * or several separated by commas, e.g. one per class) and only people who know
 * it can open the site. Without APP_PASSWORD the site stays open.
 *
 * The session cookie holds an HMAC of the password that was used, so changing
 * or removing a password logs those people out. Uses Web Crypto only, so it
 * runs in proxy.ts as well as in route handlers.
 */

export const SESSION_COOKIE = "hs_session";
export const SESSION_DAYS = 30;

export function appPasswords(env: Record<string, string | undefined> = process.env): string[] {
  return (env.APP_PASSWORD ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function authEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return appPasswords(env).length > 0;
}

function secret(env: Record<string, string | undefined>): string {
  // AUTH_SECRET is optional; without it the passwords themselves are the key material.
  return env.AUTH_SECRET?.trim() || `homay-saadat:${appPasswords(env).join("|")}`;
}

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie value for someone who logged in with `password`. */
export async function sessionFor(password: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  return hmac(secret(env), `session:v1:${password}`);
}

/** Constant-time string comparison. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The password that matches, or null. */
export function checkPassword(input: string, env: Record<string, string | undefined> = process.env): string | null {
  const given = input.trim();
  return appPasswords(env).find((p) => same(p, given)) ?? null;
}

/** True if the cookie belongs to one of the current passwords. */
export async function validSession(
  cookie: string | undefined,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  if (!cookie) return false;
  for (const p of appPasswords(env)) if (same(cookie, await sessionFor(p, env))) return true;
  return false;
}
