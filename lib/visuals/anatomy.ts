/** Curated school-level anatomy. Coordinates are schematic, in anatomical left/right. */
export const BODY_SYSTEMS = [
  { id: "all", name: "همه بدن", note: "دستگاه‌های بدن با هم کار می‌کنند تا زنده بمانیم." },
  { id: "respiratory", name: "تنفس", note: "هوا از نای به شش‌ها می‌رود؛ اکسیجن وارد خون و کاربن دای‌اکساید از آن خارج می‌شود." },
  { id: "circulatory", name: "گردش خون", note: "قلب خون را به شش‌ها و سپس به سراسر بدن پمپ می‌کند." },
  { id: "digestive", name: "هضم غذا", note: "غذا تجزیه می‌شود و مواد غذایی بیشتر در روده کوچک جذب می‌شوند." },
  { id: "nervous", name: "اعصاب", note: "مغز، نخاع و عصب‌ها پیام‌های بدن را دریافت و منتقل می‌کنند." },
  { id: "skeletal", name: "استخوان‌ها", note: "استخوان‌ها به بدن شکل می‌دهند و از اعضای داخلی محافظت می‌کنند." },
  { id: "urinary", name: "دستگاه ادراری", note: "گرده‌ها خون را تصفیه می‌کنند و ادرار از راه حالب‌ها به مثانه می‌رسد." },
] as const;

export type BodySystem = (typeof BODY_SYSTEMS)[number]["id"];
export type BodyPoint = [number, number, number];
interface BodyPart {
  id: string;
  name: string;
  english: string;
  system: Exclude<BodySystem, "all">;
  color: string;
  at: BodyPoint;
  description: string;
  question: string;
}

export const BODY_PARTS: BodyPart[] = [
  { id: "brain", name: "مغز", english: "Brain", system: "nervous", color: "#c084fc", at: [0, 2.65, 0], description: "مغز مرکز پردازش پیام‌هاست. در فکر کردن، حافظه، حس کردن و هدایت حرکت‌ها نقش دارد.", question: "وقتی چیزی را می‌بینیم، پیام چشم در کجا پردازش می‌شود؟" },
  { id: "spinal_cord", name: "نخاع", english: "Spinal cord", system: "nervous", color: "#a855f7", at: [0, 1, -0.22], description: "نخاع در داخل ستون فقرات قرار دارد. پیام‌ها را میان مغز و بدن منتقل می‌کند و در بعضی عکس‌العمل‌های سریع نقش دارد.", question: "چرا محافظت ستون فقرات از نخاع مهم است؟" },
  { id: "nerves", name: "عصب‌ها", english: "Nerves", system: "nervous", color: "#d8b4fe", at: [1.1, 0.4, 0], description: "عصب‌ها پیام‌های حسی را به دستگاه عصبی مرکزی و پیام‌های حرکتی را به عضلات می‌رسانند.", question: "پیام لمس کردن یک جسم از چه راهی منتقل می‌شود؟" },
  { id: "heart", name: "قلب", english: "Heart", system: "circulatory", color: "#e84a67", at: [0.16, 1.08, 0.24], description: "قلب یک عضو عضلانی با چهار حفره است. سمت راست خون را به شش‌ها و سمت چپ آن را به بدن پمپ می‌کند.", question: "چرا خون باید از قلب به شش‌ها برود؟" },
  { id: "arteries", name: "شریان‌ها", english: "Arteries", system: "circulatory", color: "#ef4444", at: [-0.12, -0.1, 0.16], description: "شریان‌ها خون را از قلب دور می‌کنند. بیشتر آن‌ها خون غنی از اکسیجن دارند؛ شریان ریوی یک استثناست. رنگ‌ها در این مدل قراردادی‌اند.", question: "شریان خون را به سوی قلب می‌برد یا از آن دور می‌کند؟" },
  { id: "veins", name: "وریدها", english: "Veins", system: "circulatory", color: "#3b82f6", at: [0.14, -0.35, 0.1], description: "وریدها خون را به قلب برمی‌گردانند. خون داخل ورید هم سرخ است؛ آبی در مدل فقط برای تشخیص رگ‌هاست.", question: "آیا خون داخل ورید واقعاً آبی است؟" },
  { id: "lungs", name: "شش‌ها", english: "Lungs", system: "respiratory", color: "#fb8fa8", at: [-0.44, 1.28, 0.06], description: "در کیسه‌های هوایی کوچک شش‌ها، اکسیجن به خون وارد و کاربن دای‌اکساید از خون خارج می‌شود. شش چپ برای قلب فضای بیشتری دارد.", question: "هنگام نفس کشیدن کدام گاز وارد خون می‌شود؟" },
  { id: "trachea", name: "نای", english: "Trachea and bronchi", system: "respiratory", color: "#38bdf8", at: [0, 1.82, 0.12], description: "نای راه عبور هواست و در سینه به دو شاخه اصلی تقسیم می‌شود که به شش‌ها می‌روند.", question: "چرا نای به دو شاخه اصلی تقسیم می‌شود؟" },
  { id: "diaphragm", name: "حجاب حاجز", english: "Diaphragm", system: "respiratory", color: "#f59e0b", at: [0, 0.62, 0], description: "این عضله زیر شش‌هاست. هنگام دم منقبض و پایین می‌رود؛ حجم قفس سینه بیشتر می‌شود و هوا وارد شش‌ها می‌گردد.", question: "هنگام دم، حجاب حاجز به کدام طرف حرکت می‌کند؟" },
  { id: "esophagus", name: "مری", english: "Esophagus", system: "digestive", color: "#fbbf24", at: [0, 1.45, -0.12], description: "مری غذا را با حرکت‌های موجی عضلات از حلق به معده می‌رساند. راه غذا با راه هوا فرق دارد.", question: "مری غذا را به کدام عضو می‌رساند؟" },
  { id: "liver", name: "جگر", english: "Liver", system: "digestive", color: "#a6563d", at: [-0.3, 0.34, 0.17], description: "جگر در سمت راست بالای شکم قرار دارد. مواد غذایی را پردازش و ذخیره می‌کند و صفرا می‌سازد که به هضم چربی کمک می‌کند.", question: "صفرا در هضم کدام نوع ماده غذایی کمک می‌کند؟" },
  { id: "stomach", name: "معده", english: "Stomach", system: "digestive", color: "#f59e8b", at: [0.32, 0.16, 0.2], description: "معده غذا را با شیره معده مخلوط می‌کند. اسید و انزایم‌های آن به آغاز هضم پروتین‌ها کمک می‌کنند.", question: "معده چگونه غذا را برای ادامه هضم آماده می‌کند؟" },
  { id: "small_intestine", name: "روده کوچک", english: "Small intestine", system: "digestive", color: "#e9a463", at: [0, -0.48, 0.24], description: "بخش بزرگی از هضم و جذب مواد غذایی در روده کوچک انجام می‌شود. پرزهای دیواره آن سطح جذب را زیاد می‌کنند.", question: "پرزهای روده چه کمکی به جذب مواد غذایی می‌کنند؟" },
  { id: "large_intestine", name: "روده بزرگ", english: "Large intestine", system: "digestive", color: "#ca7a55", at: [-0.5, -0.35, 0.22], description: "روده بزرگ بخشی از آب و نمک‌های باقی‌مانده را جذب می‌کند و در تشکیل و دفع مدفوع نقش دارد.", question: "جذب آب باقی‌مانده بیشتر به کدام بخش مربوط است؟" },
  { id: "kidneys", name: "گرده‌ها", english: "Kidneys", system: "urinary", color: "#b45366", at: [-0.43, 0.02, -0.2], description: "دو گرده در بخش عقبی شکم قرار دارند. مواد زاید و آب اضافی را از خون جدا می‌کنند تا ادرار ساخته شود.", question: "گرده‌ها مواد زاید را از کدام مایع جدا می‌کنند؟" },
  { id: "ureters", name: "حالب‌ها", english: "Ureters", system: "urinary", color: "#eab308", at: [0.23, -0.57, -0.08], description: "دو لوله باریک، ادرار را از گرده‌ها به مثانه می‌رسانند. این لوله‌ها حالب نام دارند.", question: "حالب گرده را به کدام عضو وصل می‌کند؟" },
  { id: "bladder", name: "مثانه", english: "Bladder", system: "urinary", color: "#facc15", at: [0, -0.99, 0.12], description: "مثانه یک کیسه عضلانی است که ادرار را تا زمان دفع نگه می‌دارد.", question: "کدام عضو ادرار را می‌سازد و کدام آن را نگه می‌دارد؟" },
  { id: "skull", name: "جمجمه", english: "Skull", system: "skeletal", color: "#e7dcc5", at: [0, 2.62, 0], description: "استخوان‌های جمجمه از مغز محافظت می‌کنند و چارچوب صورت را می‌سازند.", question: "جمجمه از کدام عضو محافظت می‌کند؟" },
  { id: "ribcage", name: "قفس سینه", english: "Rib cage", system: "skeletal", color: "#e7dcc5", at: [-0.5, 1.22, 0.3], description: "دنده‌ها و استخوان سینه از قلب و شش‌ها محافظت می‌کنند. حرکت دنده‌ها در تنفس هم کمک می‌کند.", question: "کدام دو عضو مهم در داخل قفس سینه‌اند؟" },
  { id: "spine", name: "ستون فقرات", english: "Vertebral column", system: "skeletal", color: "#ded0b4", at: [0, 0.4, -0.3], description: "ستون فقرات از مهره‌ها ساخته شده است، بدن را نگه می‌دارد و از نخاع محافظت می‌کند.", question: "فرق ستون فقرات با نخاع چیست؟" },
  { id: "pelvis", name: "لگن", english: "Pelvis", system: "skeletal", color: "#e7dcc5", at: [0, -0.98, 0], description: "لگن وزن بالاتنه را به پاها منتقل می‌کند و از بعضی اعضای پایین شکم محافظت می‌کند.", question: "لگن بالاتنه را به کدام بخش بدن وصل می‌کند؟" },
  { id: "limb_bones", name: "استخوان‌های دست و پا", english: "Limb bones", system: "skeletal", color: "#e7dcc5", at: [0.38, -2, 0], description: "استخوان‌ها همراه مفصل‌ها و عضلات حرکت را ممکن می‌سازند. استخوان ران در قسمت بالایی پا قرار دارد.", question: "برای حرکت، استخوان‌ها با کدام ساختارهای دیگر همکاری می‌کنند؟" },
];

export function bodyPart(id: string | undefined): BodyPart | undefined {
  return BODY_PARTS.find((part) => part.id === id);
}

export function bodySystem(value: unknown): BodySystem {
  return BODY_SYSTEMS.find((system) => system.id === value)?.id ?? "all";
}
