import { DbNotConfiguredError } from "./db";

/** Uniform JSON error responses for the library API. */
export function apiError(err: unknown): Response {
  if (err instanceof DbNotConfiguredError) {
    return Response.json(
      { error: "db_not_configured", message: "پایگاه داده تنظیم نشده است (DATABASE_URL)." },
      { status: 503 },
    );
  }
  console.error(err);
  return Response.json({ error: "server_error", message: "مشکلی در سرور پیش آمد." }, { status: 500 });
}
