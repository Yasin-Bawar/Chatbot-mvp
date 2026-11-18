import { BicepsFlexed, Bone, Brain, Droplets, Hand, HeartPulse, PersonStanding, Utensils, Wind } from "lucide-react";
import type { BodySystem } from "@/lib/visuals/anatomy";

/** One icon per body system (the body viewer's buttons and the «نمایش‌ها» page). */
export const BODY_ICONS: Record<BodySystem | "all", React.ReactNode> = {
  all: <PersonStanding />,
  digestive: <Utensils />,
  respiratory: <Wind />,
  circulatory: <HeartPulse />,
  nervous: <Brain />,
  urinary: <Droplets />,
  skeleton: <Bone />,
  muscular: <BicepsFlexed />,
  skin: <Hand />,
};
