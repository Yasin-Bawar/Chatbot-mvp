import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Time-based Dari greeting. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "صبح بخیر";
  if (h >= 11 && h < 17) return "روز بخیر";
  if (h >= 17 && h < 21) return "عصر بخیر";
  return "شب بخیر";
}

export type DateGroup = "امروز" | "دیروز" | "۷ روز گذشته" | "۳۰ روز گذشته" | "قدیمی‌تر";

export function dateGroup(ts: number, now = Date.now()): DateGroup {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= startOfToday.getTime()) return "امروز";
  if (ts >= startOfToday.getTime() - day) return "دیروز";
  if (ts >= startOfToday.getTime() - 7 * day) return "۷ روز گذشته";
  if (ts >= startOfToday.getTime() - 30 * day) return "۳۰ روز گذشته";
  return "قدیمی‌تر";
}

export const DATE_GROUP_ORDER: DateGroup[] = ["امروز", "دیروز", "۷ روز گذشته", "۳۰ روز گذشته", "قدیمی‌تر"];
