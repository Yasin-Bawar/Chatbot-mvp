/** Models offered in the model picker. Opus 5.5 is the default teacher. */
export const MODELS = [
  {
    id: "claude-opus-5-5",
    label: "دانا پیشرفته",
    hint: "بهترین کیفیت برای درس‌های سخت",
    defaultEffort: "medium",
  },
  {
    id: "claude-sonnet-5-5",
    label: "دانا سریع",
    hint: "سریع‌تر و ارزان‌تر",
    defaultEffort: "medium",
  },
  {
    id: "claude-haiku-5-5",
    label: "دانا سبک",
    hint: "خیلی سریع برای سوال‌های ساده",
    defaultEffort: "low",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "claude-opus-5-5";

export function modelById(id: string | undefined | null) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
