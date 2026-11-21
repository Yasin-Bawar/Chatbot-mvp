import { VoiceLesson } from "@/components/teachers/VoiceLesson";
import { TEACHERS } from "@/lib/teachers";

export const metadata = { title: "معلم ریاضی | همای سعادت (۲)" };

export default function MathTeacherPage() {
  return <VoiceLesson teacher={TEACHERS.find((t) => t.id === "math")!} />;
}
