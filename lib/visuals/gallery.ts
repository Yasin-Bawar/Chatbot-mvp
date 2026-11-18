import { SYSTEMS } from "./anatomy";
import { PRESETS } from "./molecules";
import { SIM_TITLES } from "./physics";
import type { SimType, VisualKind } from "./types";

/**
 * Everything on the «نمایش‌ها» page: every 3D visual and experiment, ready to
 * open without asking Homa (so it costs no AI credit). Each item is the same
 * JSON Homa would write in a ```globe / ```molecule / ```sim / ```anatomy block.
 */

export type GallerySubject = "geography" | "physics" | "chemistry" | "biology";

export interface GalleryItem {
  id: string;
  subject: GallerySubject;
  /** A smaller heading inside the subject (e.g. «مولکول‌ها»). */
  group?: string;
  title: string;
  /** A few words under the title. */
  hint: string;
  kind: VisualKind;
  data: Record<string, unknown>;
}

export const GALLERY_SUBJECTS: { id: GallerySubject; name: string }[] = [
  { id: "geography", name: "جغرافیه" },
  { id: "physics", name: "فزیک" },
  { id: "chemistry", name: "کیمیا" },
  { id: "biology", name: "بیولوژی" },
];

const PHYSICS_SIMS: [SimType, string][] = [
  ["projectile", "زاویه و سرعت پرتاب"],
  ["freefall", "توپ و پَر، با هوا و بی‌هوا"],
  ["pendulum", "دوره و طول ریسمان"],
  ["spring", "نوسان با گراف زنده"],
  ["incline", "قوه‌ها و اصطکاک"],
  ["collision", "مومنتم دو گادی"],
  ["circuit", "ولتاژ، جریان و مقاومت"],
  ["wave", "فریکونسی و طول موج"],
  ["lens", "تصویر حقیقی و مجازی"],
  ["refraction", "شکست نور و انعکاس کامل"],
];

const CHEMISTRY_SIMS: [SimType, string, Record<string, unknown>][] = [
  ["atom", "پروتون، نیوترون و الکترون", { element: "C" }],
  ["reaction", "حرکت اتوم‌ها در تعامل", { reaction: "methane", title: "سوختن میتان" }],
  ["states", "جامد، مایع و گاز", {}],
  ["ph", "تیزاب، خنثی و قلوی", { params: { ph: 3 } }],
  ["gas", "فشار، حجم و درجه حرارت", {}],
];

export const GALLERY: GalleryItem[] = [
  {
    id: "globe-earth",
    subject: "geography",
    title: "کره زمین",
    hint: "تصویر ماهواره‌ای، کوه‌ها و دریاها",
    kind: "globe",
    data: { title: "کره زمین", rivers: true, zoom: 1 },
  },
  {
    id: "globe-countries",
    subject: "geography",
    title: "کشورهای جهان",
    hint: "نام و بیرق هر کشور",
    kind: "globe",
    data: { title: "کشورهای جهان", countries: true, zoom: 1, focus: { lat: 30, lon: 60 } },
  },
  {
    id: "globe-afghanistan",
    subject: "geography",
    title: "افغانستان و همسایه‌ها",
    hint: "همسایه‌ها، شهرها و دریاها",
    kind: "globe",
    data: {
      title: "افغانستان و همسایه‌ها",
      focus: { lat: 34, lon: 66 },
      zoom: 3,
      rivers: true,
      highlight: ["Afghanistan", "Iran", "Pakistan", "Tajikistan", "Uzbekistan", "Turkmenistan", "China"],
      markers: [
        { lat: 34.53, lon: 69.17, label: "کابل" },
        { lat: 34.35, lon: 62.2, label: "هرات" },
        { lat: 36.71, lon: 67.11, label: "مزار شریف" },
        { lat: 31.61, lon: 65.71, label: "کندهار" },
      ],
    },
  },
  {
    id: "globe-silk-road",
    subject: "geography",
    title: "راه ابریشم",
    hint: "از چین تا روم، از راه افغانستان",
    kind: "globe",
    data: {
      title: "راه ابریشم",
      focus: { lat: 38, lon: 66 },
      zoom: 2,
      markers: [
        { lat: 34.34, lon: 108.94, label: "شیان" },
        { lat: 39.47, lon: 75.99, label: "کاشغر" },
        { lat: 39.65, lon: 66.96, label: "سمرقند" },
        { lat: 36.76, lon: 66.9, label: "بلخ" },
        { lat: 33.31, lon: 44.36, label: "بغداد" },
        { lat: 41.01, lon: 28.98, label: "استانبول" },
      ],
      routes: [
        {
          label: "راه ابریشم",
          points: [
            [34.34, 108.94],
            [39.47, 75.99],
            [39.65, 66.96],
            [36.76, 66.9],
            [35.69, 51.39],
            [33.31, 44.36],
            [41.01, 28.98],
          ],
        },
      ],
    },
  },
  ...PHYSICS_SIMS.map(
    ([type, hint]): GalleryItem => ({
      id: `sim-${type}`,
      subject: "physics",
      title: SIM_TITLES[type],
      hint,
      kind: "sim",
      data: { type },
    }),
  ),
  ...CHEMISTRY_SIMS.map(
    ([type, hint, extra]): GalleryItem => ({
      id: `sim-${type}`,
      subject: "chemistry",
      group: "آزمایش‌ها",
      title: (extra.title as string | undefined) ?? SIM_TITLES[type],
      hint,
      kind: "sim",
      data: { type, ...extra },
    }),
  ),
  ...Object.entries(PRESETS).map(
    ([key, p]): GalleryItem => ({
      id: `molecule-${key}`,
      subject: "chemistry",
      group: "مولکول‌های سه‌بعدی",
      title: p.title,
      hint: p.formula.replace(/_(\d+)/g, (_, d: string) => [...d].map((c) => "₀₁₂₃₄₅₆₇₈₉"[+c]).join("")),
      kind: "molecule",
      data: { preset: key },
    }),
  ),
  {
    id: "body-all",
    subject: "biology",
    title: "بدن انسان",
    hint: "تمام بدن؛ روی هر عضو بزنید",
    kind: "anatomy",
    data: { title: "بدن انسان" },
  },
  ...SYSTEMS.map(
    (s): GalleryItem => ({
      id: `body-${s.key}`,
      subject: "biology",
      title: s.name,
      hint: s.note,
      kind: "anatomy",
      data: { title: s.name, system: s.key },
    }),
  ),
];
