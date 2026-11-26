import { NextResponse, type NextRequest } from "next/server";
import { canUseLibrary, SESSION_COOKIE, userFromSession } from "@/lib/auth";

/**
 * Login gate (see lib/auth.ts). Pages redirect to /login; API calls get 401.
 * The teacher account cannot open the library or change books.
 * Left open: the login itself, the background book worker (it calls itself
 * and runs from a cron) and Vercel Blob's signed upload callbacks.
 */

const OPEN = ["/login", "/api/login", "/api/worker"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  // Vercel Blob calls back after an upload; it signs the request and the route checks it.
  if (pathname === "/api/books/upload" && request.headers.get("x-vercel-signature")) return NextResponse.next();

  const user = await userFromSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) {
    if (!canUseLibrary(user)) {
      if (pathname === "/library" || pathname.startsWith("/library/")) {
        const home = request.nextUrl.clone();
        home.pathname = "/";
        home.search = "";
        return NextResponse.redirect(home);
      }
      // Reading books in a chat is fine; adding, re-reading or deleting them is not.
      if (pathname.startsWith("/api/books") && request.method !== "GET") {
        return NextResponse.json({ error: "forbidden", message: "کتابخانه فقط برای مدیر است." }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "login_required", message: "لطفاً اول وارد شوید." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next.js assets and public files (textures, models, flags, data, icons).
    "/((?!_next/static|_next/image|favicon.ico|textures/|models/|flags/|data/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|glb|json|txt|woff2?)$).*)",
  ],
};
