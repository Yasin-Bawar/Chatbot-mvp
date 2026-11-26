/**
 * Login for the whole website. For now there are two fixed accounts:
 * - admin   : everything, no daily limit
 * - teacher : 20 AI questions a day, no library
 *
 * The session cookie is "<username>.<HMAC of the username and password>", so
 * changing an account's password here logs that account out. Uses Web Crypto
 * only, so it runs in proxy.ts as well as in route handlers.
 */

export const SESSION_COOKIE = "hs_session";
export const SESSION_DAYS = 30;

export type Role = "admin" | "teacher";

export type AppUser = {
  username: string;
  /** Shown in the menu. */
  name: string;
  role: Role;
  /** AI questions per day (chat and voice teacher together); null = no limit. */
  dailyLimit: number | null;
};

type Account = AppUser & { password: string };

const ACCOUNTS: Account[] = [
  { username: "admin", password: "Yasin2025@", name: "مدیر", role: "admin", dailyLimit: null },
  { username: "teacher", password: "12345678", name: "معلم", role: "teacher", dailyLimit: 20 },
];

const publicUser = ({ password: _password, ...user }: Account): AppUser => user;

/** The library (adding, reading and deleting books) is only for the admin. */
export function canUseLibrary(user: AppUser | null): boolean {
  return user?.role === "admin";
}

function secret(env: Record<string, string | undefined>): string {
  // AUTH_SECRET is optional; without it the passwords themselves are the key material.
  return env.AUTH_SECRET?.trim() || `homay-saadat:v2:${ACCOUNTS.map((a) => a.password).join("|")}`;
}

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const findAccount = (username: string) => ACCOUNTS.find((a) => a.username === username.trim().toLowerCase());

/** The account for this username and password, or null. */
export function checkLogin(username: string, password: string): AppUser | null {
  const account = findAccount(username);
  if (!account || !same(account.password, password)) return null;
  return publicUser(account);
}

/** Cookie value for someone who logged in as `username`. */
export async function sessionFor(username: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  const account = findAccount(username);
  if (!account) throw new Error(`unknown account ${username}`);
  return `${account.username}.${await hmac(secret(env), `session:v2:${account.username}:${account.password}`)}`;
}

/** Who this cookie belongs to, or null if it is missing, forged or out of date. */
export async function userFromSession(
  cookie: string | undefined,
  env: Record<string, string | undefined> = process.env,
): Promise<AppUser | null> {
  if (!cookie) return null;
  const account = findAccount(cookie.split(".")[0] ?? "");
  if (!account) return null;
  return same(cookie, await sessionFor(account.username, env)) ? publicUser(account) : null;
}
