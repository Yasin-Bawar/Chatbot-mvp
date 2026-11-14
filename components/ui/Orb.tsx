import { cn } from "@/lib/utils";

/** The animated gradient orb from the design. Small orbs don't float (they sit in pills/avatars). */
export function Orb({ size = 96, busy = false, className }: { size?: number; busy?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("orb isolate shrink-0", size < 48 && "orb-still", busy && "orb-busy", className)}
      style={{ width: size, height: size }}
    />
  );
}
