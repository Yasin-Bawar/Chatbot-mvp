/**
 * Organs in the 3D body model (public/models/human-body.glb, built by
 * scripts/build-body-model.mjs from BodyParts3D). Each key is a mesh in the
 * model; "about" and "question" are shown when a student taps the organ.
 */

export type BodySystem = "skin" | "skeleton" | "muscular" | "digestive" | "respiratory" | "circulatory" | "nervous" | "urinary";

export const SYSTEMS: { key: BodySystem; name: string; note: string }[] = [
  { key: "digestive", name: "سیستم هاضمه", note: "غذا تجزیه می‌شود و مواد غذایی بیشتر در روده کوچک جذب می‌شوند." },
  {
    key: "respiratory",
    name: "سیستم تنفس",
    note: "هوا از نای به شش‌ها می‌رود؛ اکسیجن وارد خون و کاربن دای‌اکساید از آن خارج می‌شود.",
  },
  { key: "circulatory", name: "دوران خون", note: "قلب خون را به شش‌ها و سپس به سراسر بدن پمپ می‌کند." },
  { key: "nervous", name: "سیستم عصبی", note: "مغز، نخاع و عصب‌ها پیام‌های بدن را دریافت و منتقل می‌کنند." },
  { key: "urinary", name: "سیستم ادرار", note: "گرده‌ها خون را تصفیه می‌کنند و ادرار از راه حالب‌ها به مثانه می‌رسد." },
  { key: "skeleton", name: "اسکلیت", note: "استخوان‌ها به بدن شکل می‌دهند و از اعضای داخلی محافظت می‌کنند." },
  { key: "muscular", name: "عضلات", note: "عضلات با کوتاه شدن استخوان‌ها را می‌کشند و بدن را حرکت می‌دهند." },
  { key: "skin", name: "پوست", note: "پوست بزرگ‌ترین عضو بدن است و از بدن محافظت می‌کند." },
];

export interface Organ {
  name: string;
  system: BodySystem;
  /** Two short sentences about what it does. */
  about: string;
  /** A question to check understanding. */
  question: string;
}

export const ORGANS: Record<string, Organ> = {
  skin: {
    name: "پوست",
    system: "skin",
    about: "پوست بدن را از میکروب‌ها، آفتاب و از دست دادن آب محافظت می‌کند و با عرق کردن حرارت بدن را تنظیم می‌کند.",
    question: "وقتی هوا گرم است، پوست چگونه بدن را سرد می‌کند؟",
  },
  brain: {
    name: "مغز",
    system: "nervous",
    about: "مغز مرکز پردازش پیام‌هاست. در فکر کردن، حافظه، حس کردن و هدایت حرکت‌ها نقش دارد.",
    question: "وقتی چیزی را می‌بینیم، پیام چشم در کجا پردازش می‌شود؟",
  },
  eyes: {
    name: "چشم‌ها",
    system: "nervous",
    about: "چشم نور را می‌گیرد و تصویر را به پیام عصبی تبدیل می‌کند؛ عصب بینایی این پیام را به مغز می‌برد.",
    question: "پیام بینایی از چشم به کدام عضو می‌رود؟",
  },
  heart: {
    name: "قلب",
    system: "circulatory",
    about: "قلب یک عضو عضلانی با چهار حفره است. سمت راست خون را به شش‌ها و سمت چپ آن را به بدن پمپ می‌کند.",
    question: "چرا خون باید از قلب به شش‌ها برود؟",
  },
  arteries: {
    name: "شریان‌ها",
    system: "circulatory",
    about:
      "شریان‌ها خون را از قلب دور می‌کنند. بیشتر آن‌ها خون غنی از اکسیجن دارند؛ شریان ریوی یک استثناست. رنگ‌ها در این مدل قراردادی‌اند.",
    question: "شریان خون را به سوی قلب می‌برد یا از آن دور می‌کند؟",
  },
  veins: {
    name: "وریدها",
    system: "circulatory",
    about: "وریدها خون را به قلب برمی‌گردانند. خون داخل ورید هم سرخ است؛ آبی در مدل فقط برای تشخیص رگ‌هاست.",
    question: "آیا خون داخل ورید واقعاً آبی است؟",
  },
  spleen: {
    name: "طحال",
    system: "circulatory",
    about: "طحال در سمت چپ بالای شکم است؛ کریوات سرخ کهنه را از خون جدا می‌کند و در دفاع بدن نقش دارد.",
    question: "طحال در کدام طرف بدن قرار دارد؟",
  },
  lungs: {
    name: "شش‌ها",
    system: "respiratory",
    about:
      "در کیسه‌های هوایی کوچک شش‌ها، اکسیجن به خون وارد و کاربن دای‌اکساید از خون خارج می‌شود. شش چپ برای قلب جای کمتری دارد.",
    question: "هنگام نفس کشیدن کدام گاز وارد خون می‌شود؟",
  },
  trachea: {
    name: "نای",
    system: "respiratory",
    about: "نای راه عبور هواست و در سینه به دو شاخه اصلی تقسیم می‌شود که به شش‌ها می‌روند.",
    question: "چرا نای به دو شاخه اصلی تقسیم می‌شود؟",
  },
  diaphragm: {
    name: "حجاب حاجز",
    system: "respiratory",
    about: "این عضله زیر شش‌هاست. هنگام دم منقبض و پایین می‌رود؛ حجم قفس سینه بیشتر می‌شود و هوا وارد شش‌ها می‌گردد.",
    question: "هنگام دم، حجاب حاجز به کدام طرف حرکت می‌کند؟",
  },
  esophagus: {
    name: "مری",
    system: "digestive",
    about: "مری غذا را با حرکت‌های موجی عضلات از حلق به معده می‌رساند. راه غذا با راه هوا فرق دارد.",
    question: "مری غذا را به کدام عضو می‌رساند؟",
  },
  stomach: {
    name: "معده",
    system: "digestive",
    about: "معده غذا را با شیره معده مخلوط می‌کند. اسید و انزایم‌های آن به آغاز هضم پروتین‌ها کمک می‌کنند.",
    question: "معده چگونه غذا را برای ادامه هضم آماده می‌کند؟",
  },
  liver: {
    name: "جگر",
    system: "digestive",
    about: "جگر در سمت راست بالای شکم قرار دارد. مواد غذایی را پردازش و ذخیره می‌کند و صفرا می‌سازد که به هضم چربی کمک می‌کند.",
    question: "صفرا در هضم کدام نوع ماده غذایی کمک می‌کند؟",
  },
  gallbladder: {
    name: "کیسه صفرا",
    system: "digestive",
    about: "کیسه صفرا زیر جگر است؛ صفرایی را که جگر می‌سازد ذخیره می‌کند و هنگام غذا به روده می‌فرستد.",
    question: "صفرا را کدام عضو می‌سازد و کدام ذخیره می‌کند؟",
  },
  pancreas: {
    name: "پانکراس",
    system: "digestive",
    about: "پانکراس پشت معده است؛ شیره‌ای برای هضم غذا به روده می‌فرستد و انسولین می‌سازد که قند خون را تنظیم می‌کند.",
    question: "کدام هورمون پانکراس قند خون را کم می‌کند؟",
  },
  small_intestine: {
    name: "روده کوچک",
    system: "digestive",
    about: "بخش بزرگی از هضم و جذب مواد غذایی در روده کوچک انجام می‌شود. پرزهای دیواره آن سطح جذب را زیاد می‌کنند.",
    question: "پرزهای روده چه کمکی به جذب مواد غذایی می‌کنند؟",
  },
  large_intestine: {
    name: "روده بزرگ",
    system: "digestive",
    about: "روده بزرگ بخشی از آب و نمک‌های باقی‌مانده را جذب می‌کند و در تشکیل و دفع مدفوع نقش دارد.",
    question: "جذب آب باقی‌مانده بیشتر به کدام بخش مربوط است؟",
  },
  kidneys: {
    name: "گرده‌ها",
    system: "urinary",
    about: "دو گرده در بخش عقبی شکم قرار دارند. مواد زاید و آب اضافی را از خون جدا می‌کنند تا ادرار ساخته شود.",
    question: "گرده‌ها مواد زاید را از کدام مایع جدا می‌کنند؟",
  },
  ureters: {
    name: "حالب‌ها",
    system: "urinary",
    about: "دو لوله باریک، ادرار را از گرده‌ها به مثانه می‌رسانند. این لوله‌ها حالب نام دارند.",
    question: "حالب گرده را به کدام عضو وصل می‌کند؟",
  },
  bladder: {
    name: "مثانه",
    system: "urinary",
    about: "مثانه یک کیسه عضلانی است که ادرار را تا زمان دفع نگه می‌دارد.",
    question: "کدام عضو ادرار را می‌سازد و کدام آن را نگه می‌دارد؟",
  },
  skull: {
    name: "جمجمه",
    system: "skeleton",
    about: "استخوان‌های جمجمه از مغز محافظت می‌کنند و چارچوب صورت را می‌سازند.",
    question: "جمجمه از کدام عضو محافظت می‌کند؟",
  },
  spine: {
    name: "ستون فقرات",
    system: "skeleton",
    about: "ستون فقرات از مهره‌ها ساخته شده است، بدن را نگه می‌دارد و از نخاع محافظت می‌کند.",
    question: "فرق ستون فقرات با نخاع چیست؟",
  },
  ribs: {
    name: "قبرغه‌ها",
    system: "skeleton",
    about: "قبرغه‌ها و استخوان سینه از قلب و شش‌ها محافظت می‌کنند. حرکت قبرغه‌ها در تنفس هم کمک می‌کند.",
    question: "کدام دو عضو مهم در داخل قفس سینه‌اند؟",
  },
  pelvis: {
    name: "لگن",
    system: "skeleton",
    about: "لگن وزن بالاتنه را به پاها منتقل می‌کند و از بعضی اعضای پایین شکم محافظت می‌کند.",
    question: "لگن بالاتنه را به کدام بخش بدن وصل می‌کند؟",
  },
  arm_bones: {
    name: "استخوان‌های دست",
    system: "skeleton",
    about: "بازو یک استخوان و ساعد دو استخوان دارد؛ دست از ده‌ها استخوان کوچک ساخته شده تا بتواند چیزها را بگیرد.",
    question: "چرا دست این قدر استخوان کوچک دارد؟",
  },
  leg_bones: {
    name: "استخوان‌های پا",
    system: "skeleton",
    about:
      "استخوان ران بزرگ‌ترین استخوان بدن است. استخوان‌های پا وزن بدن را نگه می‌دارند و با مفصل‌ها و عضلات راه رفتن را ممکن می‌سازند.",
    question: "برای حرکت، استخوان‌ها با کدام ساختارهای دیگر همکاری می‌کنند؟",
  },
  muscles: {
    name: "عضلات",
    system: "muscular",
    about: "بدن بیش از ۶۰۰ عضله دارد. عضلات اسکلیتی با کوتاه شدن استخوان‌ها را می‌کشند؛ عضلات معمولاً جفت جفت کار می‌کنند.",
    question: "چرا عضلات جفت جفت کار می‌کنند؟",
  },
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
  ribcage: ["ribs"],
  limb_bones: ["arm_bones", "leg_bones"],
  "limb bones": ["arm_bones", "leg_bones"],
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
