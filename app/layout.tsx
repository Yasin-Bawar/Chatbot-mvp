import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "هما سعادت | معلم هوشمند",
  description: "معلم هوشمند برای شاگردان مکاتب افغانستان",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f2f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa-AF" dir="rtl" className="h-full antialiased">
      <body className="h-full overflow-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
