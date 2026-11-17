/**
 * Organs in the 3D body model (public/models/human-body.glb, built by
 * scripts/build-body-model.mjs). Each key is a mesh in the model.
 */

export type BodySystem = "skin" | "skeleton" | "muscular" | "digestive" | "respiratory" | "circulatory" | "nervous" | "urinary";

export const SYSTEMS: { key: BodySystem; name: string }[] = [
  { key: "digestive", name: "سیستم هاضمه" },
  { key: "respiratory", name: "سیستم تنفس" },
  { key: "circulatory", name: "دوران خون" },
  { key: "nervous", name: "سیستم عصبی" },
  { key: "urinary", name: "سیستم ادرار" },
  { key: "skeleton", name: "اسکلیت" },
  { key: "muscular", name: "عضلات" },
  { key: "skin", name: "پوست" },
];

export const ORGANS: Record<string, { name: string; system: BodySystem }> = {
  skin: { name: "پوست", system: "skin" },
  brain: { name: "مغز", system: "nervous" },
  eyes: { name: "چشم‌ها", system: "nervous" },
  heart: { name: "قلب", system: "circulatory" },
  arteries: { name: "شریان‌ها", system: "circulatory" },
  veins: { name: "وریدها", system: "circulatory" },
  spleen: { name: "طحال", system: "circulatory" },
  lungs: { name: "شش‌ها", system: "respiratory" },
  trachea: { name: "نای", system: "respiratory" },
  diaphragm: { name: "حجاب حاجز", system: "respiratory" },
  esophagus: { name: "مری", system: "digestive" },
  stomach: { name: "معده", system: "digestive" },
  liver: { name: "جگر", system: "digestive" },
  gallbladder: { name: "کیسه صفرا", system: "digestive" },
  pancreas: { name: "پانکراس", system: "digestive" },
  small_intestine: { name: "روده کوچک", system: "digestive" },
  large_intestine: { name: "روده بزرگ", system: "digestive" },
  kidneys: { name: "گرده‌ها", system: "urinary" },
  ureters: { name: "حالب‌ها", system: "urinary" },
  bladder: { name: "مثانه", system: "urinary" },
  skull: { name: "جمجمه", system: "skeleton" },
  spine: { name: "ستون فقرات", system: "skeleton" },
  ribs: { name: "قبرغه‌ها", system: "skeleton" },
  pelvis: { name: "لگن", system: "skeleton" },
  arm_bones: { name: "استخوان‌های دست", system: "skeleton" },
  leg_bones: { name: "استخوان‌های پا", system: "skeleton" },
  muscles: { name: "عضلات", system: "muscular" },
};

export const ORGAN_KEYS = Object.keys(ORGANS);

export function organsOf(system: BodySystem): string[] {
  return ORGAN_KEYS.filter((k) => ORGANS[k].system === system);
}

function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s_-]+/g, " ")
    .replace(/^the /, "")
    .trim();
}

// Other names (English and Dari) → keys. One name can mean several parts.
const ORGAN_ALIASES: Record<string, string[]> = {
  kidney: ["kidneys"],
  lung: ["lungs"],
  eye: ["eyes"],
  intestine: ["small_intestine", "large_intestine"],
  intestines: ["small_intestine", "large_intestine"],
  bowel: ["small_intestine", "large_intestine"],
  gut: ["small_intestine", "large_intestine"],
  colon: ["large_intestine"],
  "small bowel": ["small_intestine"],
  duodenum: ["small_intestine"],
  appendix: ["large_intestine"],
  oesophagus: ["esophagus"],
  gullet: ["esophagus"],
  windpipe: ["trachea"],
  bronchi: ["trachea"],
  "gall bladder": ["gallbladder"],
  "urinary bladder": ["bladder"],
  ureter: ["ureters"],
  artery: ["arteries"],
  aorta: ["arteries"],
  vein: ["veins"],
  "vena cava": ["veins"],
  "blood vessels": ["arteries", "veins"],
  vessels: ["arteries", "veins"],
  cranium: ["skull"],
  "vertebral column": ["spine"],
  backbone: ["spine"],
  vertebrae: ["spine"],
  rib: ["ribs"],
  "rib cage": ["ribs"],
  hip: ["pelvis"],
  "hip bone": ["pelvis"],
  femur: ["leg_bones"],
  "leg bones": ["leg_bones"],
  "arm bones": ["arm_bones"],
  humerus: ["arm_bones"],
  "hand bones": ["arm_bones"],
  muscle: ["muscles"],
  // Dari
  کلیه: ["kidneys"],
  گرده: ["kidneys"],
  ریه: ["lungs"],
  ریه‌ها: ["lungs"],
  شش: ["lungs"],
  قلب: ["heart"],
  دل: ["heart"],
  مغز: ["brain"],
  چشم: ["eyes"],
  روده: ["small_intestine", "large_intestine"],
  روده‌ها: ["small_intestine", "large_intestine"],
  کبد: ["liver"],
  صفرا: ["gallbladder"],
  لوزالمعده: ["pancreas"],
  شریان: ["arteries"],
  رگ‌ها: ["arteries", "veins"],
  ورید: ["veins"],
  قبرغه: ["ribs"],
  دنده: ["ribs"],
  دنده‌ها: ["ribs"],
  جمجمه: ["skull"],
  "کاسه سر": ["skull"],
  "ستون فقرات": ["spine"],
  مهره‌ها: ["spine"],
  "لگن خاصره": ["pelvis"],
  حالب: ["ureters"],
  عضله: ["muscles"],
  ماهیچه: ["muscles"],
};

const BY_NAME = new Map<string, string[]>();
for (const [key, o] of Object.entries(ORGANS)) {
  BY_NAME.set(norm(key), [key]);
  BY_NAME.set(norm(o.name), [key]);
}
for (const [alias, keys] of Object.entries(ORGAN_ALIASES)) BY_NAME.set(norm(alias), keys);

/** Organ keys for a name (English, Dari or a key); empty when unknown. */
export function resolveOrgan(name: string): string[] {
  const k = norm(name);
  return BY_NAME.get(k) ?? BY_NAME.get(k.replace(/s$/, "")) ?? BY_NAME.get(k.replace(/(ها|‌ها)$/, "").trim()) ?? [];
}

const SYSTEM_ALIASES: Record<string, BodySystem> = {
  skin: "skin",
  integumentary: "skin",
  skeleton: "skeleton",
  skeletal: "skeleton",
  bones: "skeleton",
  muscular: "muscular",
  muscles: "muscular",
  digestive: "digestive",
  digestion: "digestive",
  respiratory: "respiratory",
  breathing: "respiratory",
  circulatory: "circulatory",
  cardiovascular: "circulatory",
  blood: "circulatory",
  nervous: "nervous",
  nerves: "nervous",
  urinary: "urinary",
  excretory: "urinary",
  renal: "urinary",
  پوست: "skin",
  اسکلیت: "skeleton",
  استخوان: "skeleton",
  استخوان‌ها: "skeleton",
  عضلات: "muscular",
  هاضمه: "digestive",
  گوارش: "digestive",
  تنفس: "respiratory",
  تنفسی: "respiratory",
  "دوران خون": "circulatory",
  "گردش خون": "circulatory",
  عصبی: "nervous",
  اعصاب: "nervous",
  ادرار: "urinary",
  بولی: "urinary",
  اطراح: "urinary",
};

/** "digestive system", «سیستم هاضمه» … → a system key, or null. */
export function resolveSystem(name: string): BodySystem | null {
  const k = norm(name)
    .replace(/ system$/, "")
    .replace(/^سیستم /, "")
    .replace(/^جهاز /, "")
    .trim();
  return SYSTEM_ALIASES[k] ?? null;
}
