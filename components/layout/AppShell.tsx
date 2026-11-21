"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { AnimatePresence, motion } from "motion/react";
import { Menu, SquarePen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useChatStore } from "@/lib/chat/store";
import { useUi } from "@/lib/ui-store";
import { Logo } from "@/components/ui/Logo";
import { Toaster } from "@/components/ui/Toast";
import { NameDialog } from "./NameDialog";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const chromeHidden = useUi((s) => s.chromeHidden) && pathname === "/";
  // The login page stands alone (no menu, no chats).
  const bare = pathname === "/login";

  // Close the mobile drawer on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  // Ctrl/⌘ + Shift + O → new chat (like other chat apps)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setActiveChat(null);
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setActiveChat]);

  if (bare) return <DirectionProvider dir="rtl">{children}</DirectionProvider>;

  return (
    <DirectionProvider dir="rtl">
      <div className="flex h-dvh w-full gap-3 overflow-hidden p-0 md:p-3">
        {/* Desktop sidebar */}
        <aside className="hidden w-[288px] shrink-0 md:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-[#1f2330]/30 backdrop-blur-[2px] md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                className="fixed inset-y-0 start-0 z-50 w-[86vw] max-w-[320px] p-2 md:hidden"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
              >
                <Sidebar onClose={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-panel md:rounded-[28px] md:border md:border-line">
          {/* Mobile top bar (slides away while reading an answer) */}
          <div className="md:hidden">
            <div className="chrome-collapse" data-hidden={chromeHidden ? "true" : undefined}>
              <div>
                <div className="flex items-center justify-between border-b border-line bg-surface/80 px-2 py-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
                    aria-label="منو"
                  >
                    <Menu className="size-5" />
                  </button>
                  <Link href="/" onClick={() => setActiveChat(null)}>
                    <Logo className="scale-[0.85]" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChat(null);
                      router.push("/");
                    }}
                    className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
                    aria-label="گفتگوی تازه"
                  >
                    <SquarePen className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
      <NameDialog />
      <Toaster />
    </DirectionProvider>
  );
}
