/**
 * Models offered in the model picker. The most capable (and most expensive)
 * one is Claude Sonnet 4.6; the server only ever uses models from this list.
 */
export const MODELS = [
  {
    id: "claude-sonnet-4-6",
    label: "همای سعادت (۲) پیشرفته",
    hint: "بهترین کیفیت برای درس‌ها",
    defaultEffort: "medium",
    webSearchTool: "web_search_20260209",
  },
  {
    id: "claude-haiku-5-5",
    label: "همای سعادت (۲) سبک",
    hint: "خیلی سریع و ارزان برای سوال‌های ساده",
    defaultEffort: "low",
    webSearchTool: "web_search_20250305",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-6";

/** The cheapest model, for small background jobs such as chat titles. */
export const LIGHT_MODEL: ModelId = "claude-haiku-5-5";

export function modelById(id: string | undefined | null) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
