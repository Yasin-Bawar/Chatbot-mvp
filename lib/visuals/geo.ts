/**
 * Country names for the 3D globe. The map data (world-atlas, Natural Earth
 * 1:110m) uses short English names; Dana may write other English names or Dari.
 */

/** world-atlas name → Dari label shown on the globe. */
export const DARI_COUNTRY: Record<string, string> = {
  Afghanistan: "افغانستان",
  Iran: "ایران",
  Pakistan: "پاکستان",
  Tajikistan: "تاجکستان",
  Uzbekistan: "ازبکستان",
  Turkmenistan: "ترکمنستان",
  Kyrgyzstan: "قرغزستان",
  Kazakhstan: "قزاقستان",
  China: "چین",
  India: "هند",
  Russia: "روسیه",
  Turkey: "ترکیه",
  Iraq: "عراق",
  Syria: "سوریه",
  "Saudi Arabia": "عربستان سعودی",
  "United Arab Emirates": "امارات",
  Qatar: "قطر",
  Kuwait: "کویت",
  Oman: "عمان",
  Yemen: "یمن",
  Jordan: "اردن",
  Israel: "اسرائیل",
  Palestine: "فلسطین",
  Lebanon: "لبنان",
  Egypt: "مصر",
  Bangladesh: "بنگله‌دیش",
  Nepal: "نیپال",
  Bhutan: "بوتان",
  "Sri Lanka": "سریلانکا",
  Mongolia: "مغولستان",
  Japan: "جاپان",
  "South Korea": "کوریای جنوبی",
  "North Korea": "کوریای شمالی",
  Indonesia: "اندونیزیا",
  Malaysia: "مالیزیا",
  Thailand: "تایلند",
  Vietnam: "ویتنام",
  Myanmar: "میانمار",
  Philippines: "فلیپین",
  Australia: "آسترالیا",
  "United States of America": "امریکا",
  Canada: "کانادا",
  Mexico: "مکسیکو",
  Brazil: "برازیل",
  Argentina: "ارجنتاین",
  "United Kingdom": "بریتانیا",
  France: "فرانسه",
  Germany: "آلمان",
  Italy: "ایتالیا",
  Spain: "هسپانیه",
  Greece: "یونان",
  Ukraine: "اوکراین",
  Azerbaijan: "آذربایجان",
  Armenia: "ارمنستان",
  Georgia: "گرجستان",
  Morocco: "مراکش",
  Algeria: "الجزایر",
  Libya: "لیبیا",
  Sudan: "سودان",
  Ethiopia: "ایتوپیا",
  Kenya: "کینیا",
  Nigeria: "نایجیریا",
  "South Africa": "افریقای جنوبی",
  Antarctica: "انتارکتیکا",
  Greenland: "گرینلند",
};

const ALIASES: Record<string, string> = {
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  america: "United States of America",
  uk: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  persia: "Iran",
  "islamic republic of iran": "Iran",
  burma: "Myanmar",
  "czech republic": "Czechia",
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  drc: "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "dr congo": "Dem. Rep. Congo",
  "republic of the congo": "Congo",
  "south sudan": "S. Sudan",
  "central african republic": "Central African Rep.",
  "dominican republic": "Dominican Rep.",
  "bosnia and herzegovina": "Bosnia and Herz.",
  bosnia: "Bosnia and Herz.",
  "north macedonia": "Macedonia",
  swaziland: "eSwatini",
  eswatini: "eSwatini",
  "western sahara": "W. Sahara",
  "equatorial guinea": "Eq. Guinea",
  "solomon islands": "Solomon Is.",
  "falkland islands": "Falkland Is.",
  "east timor": "Timor-Leste",
  turkiye: "Turkey",
  türkiye: "Turkey",
  uae: "United Arab Emirates",
  ksa: "Saudi Arabia",
  "korea, south": "South Korea",
  "korea, north": "North Korea",
  "russian federation": "Russia",
  "viet nam": "Vietnam",
  laos: "Laos",
};

// Dari (and common Persian spellings) → world-atlas name.
const FROM_DARI: Record<string, string> = Object.fromEntries([
  ...Object.entries(DARI_COUNTRY).map(([en, fa]) => [fa, en]),
  ["هندوستان", "India"],
  ["ایالات متحده", "United States of America"],
  ["ایالات متحده امریکا", "United States of America"],
  ["آمریکا", "United States of America"],
  ["روسیه", "Russia"],
  ["روس", "Russia"],
  ["عربستان", "Saudi Arabia"],
  ["انگلستان", "United Kingdom"],
  ["انگلیس", "United Kingdom"],
  ["اسپانیا", "Spain"],
  ["ژاپن", "Japan"],
  ["استرالیا", "Australia"],
  ["برزیل", "Brazil"],
  ["مکزیک", "Mexico"],
  ["اتیوپی", "Ethiopia"],
  ["قرقیزستان", "Kyrgyzstan"],
  ["قزاقستان", "Kazakhstan"],
  ["ترکیه", "Turkey"],
]);

function key(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[‌\s]+/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .trim();
}

/** Resolves a country name (English, alias or Dari) to the world-atlas name, given the names on the map. */
export function resolveCountry(name: string, known: Iterable<string>): string | null {
  const byKey = new Map<string, string>();
  for (const n of known) byKey.set(key(n), n);
  const k = key(name);
  if (byKey.has(k)) return byKey.get(k)!;
  const alias = ALIASES[k] ?? FROM_DARI[name.trim()] ?? FROM_DARI[k];
  if (alias && byKey.has(key(alias))) return byKey.get(key(alias))!;
  return null;
}

/** Label to show for a country: Dana's label, else the Dari name, else the English name. */
export function countryLabel(atlasName: string, label?: string): string {
  return label?.trim() || DARI_COUNTRY[atlasName] || atlasName;
}

/** Unit vector for a latitude/longitude (y up, longitude 0 facing +z). */
export function latLonToVector(lat: number, lon: number, radius = 1): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return [radius * Math.cos(phi) * Math.sin(lambda), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(lambda)];
}

/** Points along the great circle between two places (for routes like the Silk Road). */
export function greatCircle(a: [number, number], b: [number, number], segments = 32): [number, number, number][] {
  const va = latLonToVector(a[0], a[1]);
  const vb = latLonToVector(b[0], b[1]);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  const out: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    if (omega < 1e-6) {
      out.push(va);
      continue;
    }
    const s = Math.sin(omega);
    const wa = Math.sin((1 - t) * omega) / s;
    const wb = Math.sin(t * omega) / s;
    out.push([va[0] * wa + vb[0] * wb, va[1] * wa + vb[1] * wb, va[2] * wa + vb[2] * wb]);
  }
  return out;
}

/** Inverse of latLonToVector: a point on (or near) the sphere back to latitude/longitude. */
export function vectorToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z) || 1;
  return { lat: (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI, lon: (Math.atan2(x, z) * 180) / Math.PI };
}

type Ring = number[][];

/** Even-odd test of a point against polygons given as [ [outer, hole…], … ] in [lon, lat]. */
export function pointInPolygons(lon: number, lat: number, polygons: Ring[][]): boolean {
  let inside = false;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      // Rings that cross the antimeridian are tested at both lon and lon ± 360.
      for (const shift of [0, 360, -360]) {
        const x = lon + shift;
        let hit = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > lat !== yj > lat && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
        }
        if (hit) {
          inside = !inside;
          break;
        }
      }
    }
  }
  return inside;
}

/** Dari names for rivers in the Natural Earth data that students meet in school. */
export const DARI_RIVER: Record<string, string> = {
  "Amu Darya": "آمو دریا",
  Panj: "دریای پنج",
  Helmand: "دریای هلمند",
  Harirud: "هریرود",
  Indus: "دریای سند",
  "Syr Darya": "سیر دریا",
  Nile: "نیل",
  Tigris: "دجله",
  Euphrates: "فرات",
  Ganges: "گنگا",
  Volga: "ولگا",
  Yangtze: "یانگتسی",
  Amazon: "امازون",
  Mississippi: "میسیسیپی",
  Danube: "دانوب",
};
