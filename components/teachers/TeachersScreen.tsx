"use client";

import { motion } from "motion/react";
import { GraduationCap, Mic } from "lucide-react";
import Link from "next/link";
import { TEACHERS } from "@/lib/teachers";

/** The «معلم‌ها» page: one voice teacher per subject. */
export function TeachersScreen() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="flex items-center gap-3 text-[26px] font-black">
          <span className="bg-gradient-brand grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]">
            <GraduationCap className="size-6" />
          </span>
          معلم‌ها
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          با معلم هر مضمون با صدا درس بخوانید. صحبت کنید، وسط حرف معلم سوال بپرسید، و ببینید چطور روی تخته حل می‌کند.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEACHERS.map((t, i) => {
            const body = (
              <>
                <span className="teacher-avatar" style={{ background: t.color }}>
                  {t.ready ? <Mic className="size-6" /> : <GraduationCap className="size-6" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-ink">{t.name}</span>
                  <span className="block text-[12.5px] leading-6 text-muted">{t.ready ? t.intro : "به زودی"}</span>
                </span>
                {t.ready && <span className="teacher-live">زنده</span>}
              </>
            );
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {t.ready ? (
                  <Link href={`/teachers/${t.id}`} className="teacher-card">
                    {body}
                  </Link>
                ) : (
                  <div className="teacher-card teacher-card-soon" aria-disabled="true">
                    {body}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
