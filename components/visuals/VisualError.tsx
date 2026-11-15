import { MonitorX } from "lucide-react";

/** Shown when a 3D visual cannot run on this device. */
export function VisualError({ kind }: { kind: "nowebgl" | "error" }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-sm">
        <MonitorX className="mx-auto mb-3 size-10 opacity-70" />
        <p className="text-[15px] leading-8 opacity-90">
          {kind === "nowebgl"
            ? "این دستگاه یا مرورگر نمایش سه‌بعدی را پشتیبانی نمی‌کند. لطفاً با یک مرورگر تازه (مثل Chrome) امتحان کنید."
            : "نمایش آماده نشد. صفحه را ببندید و دوباره امتحان کنید."}
        </p>
      </div>
    </div>
  );
}
