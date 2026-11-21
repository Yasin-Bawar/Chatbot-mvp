"use client";

import { motion } from "motion/react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/Logo";

/** The password page in front of the whole website (see lib/auth.ts). */
export function LoginScreen() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState("/");

  // Read ?next= and ?error= (set when the form was sent before this script loaded).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once after load
    setNext(q.get("next") ?? "/");
    if (q.get("error")) setError("رمز درست نیست. دوباره امتحان کنید.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "ورود ممکن نشد. دوباره امتحان کنید.");
        setBusy(false);
        return;
      }
      // Back to the page the student wanted (only paths on this site).
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("اتصال برقرار نشد. انترنت خود را بررسی کنید.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh w-full place-items-center bg-panel p-4" dir="rtl">
      <motion.form
        onSubmit={submit}
        method="post"
        action="/api/login"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-sm rounded-[28px] p-7 text-center"
      >
        <LogoMark className="mx-auto size-14" />
        <h1 className="mt-3 text-[24px] font-black text-[#1e1b4b]">همای سعادت (۲)</h1>
        <p className="mt-1 text-sm leading-7 text-muted">معلم هوشمند. برای ورود، رمز را بنویسید.</p>

        <label className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-start shadow-[var(--shadow-sm)] focus-within:border-primary/40">
          <LockKeyhole className="size-4 shrink-0 text-muted" />
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز"
            name="password"
            autoComplete="current-password"
            autoFocus
            aria-label="رمز"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-muted hover:text-ink"
            aria-label={show ? "پنهان کردن رمز" : "نشان دادن رمز"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </label>

        <input type="hidden" name="next" value={next} />
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password.trim()}
          className="bg-gradient-brand mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition disabled:opacity-60"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          ورود
        </button>
        <p className="mt-4 text-xs leading-6 text-muted">رمز را از معلم یا مسئول مکتب بگیرید.</p>
      </motion.form>
    </div>
  );
}
