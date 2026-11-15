import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function isMockMode(): boolean {
  return process.env.MOCK_AI === "1";
}


/** Maps SDK errors to short, friendly Dari messages for students. */
export function friendlyError(err: unknown): string {
  if (err instanceof Error && err.name === "BudgetExceededError") return err.message;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return "کلید API درست تنظیم نشده است. لطفاً به مسئول برنامه اطلاع دهید.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "فعلاً درخواست‌ها زیاد است. لطفاً یک دقیقه بعد دوباره امتحان کنید.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return "این درخواست قابل پردازش نبود. شاید فایل ضمیمه خیلی بزرگ است. دوباره امتحان کنید.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "اتصال به سرور برقرار نشد. انترنت خود را بررسی کنید و دوباره امتحان کنید.";
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || err.status === 503) {
      return "سرور هوش مصنوعی فعلاً مصروف است. چند لحظه بعد دوباره امتحان کنید.";
    }
    return "مشکلی در سرور پیش آمد. لطفاً دوباره امتحان کنید.";
  }
  if (err instanceof Error && err.name === "AbortError") return "متوقف شد.";
  return "مشکلی پیش آمد. لطفاً دوباره امتحان کنید.";
}

export const REFUSAL_TEXT =
  "معذرت می‌خواهم، در این مورد نمی‌توانم کمک کنم. بیایید در مورد یک موضوع درسی دیگر صحبت کنیم. 🌱";
