"use client";

import { motion } from "motion/react";
import {
  Activity,
  Atom,
  Box,
  Earth,
  Feather,
  Flag,
  Flame,
  Focus,
  Gauge,
  Lightbulb,
  MapPin,
  Rocket,
  Route,
  Search,
  TestTube,
  Thermometer,
  Timer,
  TramFront,
  Triangle,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { BodySystem } from "@/lib/visuals/anatomy";
import { GALLERY, GALLERY_SUBJECTS, type GalleryItem, type GallerySubject } from "@/lib/visuals/gallery";
import { parseVisual } from "@/lib/visuals/parse";
import type { VisualSpec } from "@/lib/visuals/types";
import { normalizeFa, toFaDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { BODY_ICONS } from "./body-icons";
import { SUBJECT_THEMES } from "./theme";
import { VisualLayer } from "./VisualLayer";

const ICONS: Record<string, React.ReactNode> = {
  "globe-earth": <Earth />,
  "globe-countries": <Flag />,
  "globe-afghanistan": <MapPin />,
  "globe-silk-road": <Route />,
  "sim-projectile": <Rocket />,
  "sim-freefall": <Feather />,
  "sim-pendulum": <Timer />,
  "sim-spring": <Activity />,
  "sim-incline": <Triangle />,
  "sim-collision": <TramFront />,
  "sim-circuit": <Zap />,
  "sim-wave": <Waves />,
  "sim-lens": <Focus />,
  "sim-refraction": <Lightbulb />,
  "sim-atom": <Atom />,
  "sim-reaction": <Flame />,
  "sim-states": <Thermometer />,
  "sim-ph": <TestTube />,
  "sim-gas": <Gauge />,
};

function iconOf(item: GalleryItem): React.ReactNode {
  if (item.kind === "anatomy") return BODY_ICONS[(item.data.system as BodySystem | undefined) ?? "all"];
  // Molecules show their formula instead of an icon.
  if (item.kind === "molecule") return <span className="gallery-formula">{item.hint}</span>;
  return ICONS[item.id] ?? <Box />;
}

type Entry = { item: GalleryItem; spec: VisualSpec };

/**
 * The «نمایش‌ها» page: every 3D visual and experiment, grouped by subject.
 * They open full screen right here, without asking Homa (no AI credit used).
 */
export function VisualsScreen() {
  const [subject, setSubject] = useState<GallerySubject | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const [visible, setVisible] = useState(false);

  const entries = useMemo<Entry[]>(
    () =>
      GALLERY.flatMap((item) => {
        const spec = parseVisual(item.kind, JSON.stringify(item.data));
        return spec ? [{ item, spec }] : [];
      }),
    [],
  );

  const q = normalizeFa(query.trim()).toLowerCase();
  const shown = entries.filter(
    ({ item }) =>
      (subject === "all" || item.subject === subject) &&
      (!q || normalizeFa(`${item.title} ${item.hint}`).toLowerCase().includes(q)),
  );

  const close = useCallback(() => setVisible(false), []);
  const launch = (e: Entry) => {
    setOpen(e);
    setVisible(true);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="flex items-center gap-3 text-[26px] font-black">
          <span className="bg-gradient-brand grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]">
            <Box className="size-6" />
          </span>
          نمایش‌ها
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          همه کره‌ها، مدل‌های سه‌بعدی و آزمایش‌ها در یک جا. مستقیم باز می‌شوند، بدون پرسیدن از همای سعادت (۲).
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در نمایش‌ها…"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-muted hover:text-ink" aria-label="پاک کردن">
                <X className="size-4" />
              </button>
            )}
          </label>
          <div className="gallery-tabs" role="tablist" aria-label="مضمون">
            {[{ id: "all" as const, name: "همه" }, ...GALLERY_SUBJECTS].map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={subject === s.id}
                onClick={() => setSubject(s.id)}
                style={s.id === "all" ? undefined : ({ "--accent": SUBJECT_THEMES[s.id].accent } as React.CSSProperties)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 && <p className="mt-12 text-center text-sm text-muted">چیزی پیدا نشد.</p>}

        {GALLERY_SUBJECTS.map((s) => {
          const items = shown.filter((e) => e.item.subject === s.id);
          if (!items.length) return null;
          const theme = SUBJECT_THEMES[s.id];
          const groups = [...new Set(items.map((e) => e.item.group ?? ""))];
          return (
            <section
              key={s.id}
              className="mt-8"
              style={{ "--accent": theme.accent, "--accent-soft": theme.accentSoft } as React.CSSProperties}
            >
              <h2 className="gallery-heading">
                <span className="gallery-dot" />
                {s.name}
                <small>{toFaDigits(items.length)}</small>
              </h2>
              {groups.map((group) => (
                <div key={group}>
                  {group && <h3 className="gallery-group">{group}</h3>}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {items
                      .filter((e) => (e.item.group ?? "") === group)
                      .map((e, i) => (
                        <motion.button
                          key={e.item.id}
                          type="button"
                          onClick={() => launch(e)}
                          className="gallery-card"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 12) * 0.02 }}
                        >
                          <span className={cn("gallery-icon", e.item.kind === "molecule" && "gallery-icon-text")}>
                            {iconOf(e.item)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14.5px] font-bold text-ink">{e.item.title}</span>
                            {e.item.kind !== "molecule" && <span className="gallery-hint">{e.item.hint}</span>}
                          </span>
                        </motion.button>
                      ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <VisualLayer spec={open?.spec ?? null} open={visible} onClose={close} />
    </div>
  );
}
