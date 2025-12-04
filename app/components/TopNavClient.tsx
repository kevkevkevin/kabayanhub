"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";

type Theme = "dark" | "light";

export default function TopNavClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("kh-theme") as Theme | null;
    const initial: Theme =
      saved === "light" || saved === "dark" ? saved : "light";
    applyTheme(initial);
    setTheme(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.remove("kh-light", "kh-dark");
    html.classList.add(t === "light" ? "kh-light" : "kh-dark");
    window.localStorage.setItem("kh-theme", t);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <header className="border-b border-[var(--kh-border)] bg-[var(--kh-bg-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--kh-yellow)] text-xs font-black text-slate-900 shadow-[var(--kh-card-shadow)]">
            KH
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-[var(--kh-text)]">
              Kabayan Hub
            </p>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              OFW life &amp; money playbook
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-2 text-xs md:text-sm">
          <Link
            href="/news"
            className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
          >
            News &amp; Updates
          </Link>
          <Link
            href="/videos"
            className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
          >
            Learn &amp; Tutorials
          </Link>
          <Link
            href="/marketplace"
            className="hidden md:inline-flex rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
          >
            Marketplace
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[var(--kh-card-shadow)] hover:bg-[#ffe56f] transition"
          >
            My Kabayan Stats
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-[13px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-card)] transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Login / Logout */}
          {user ? (
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex rounded-full border border-red-200 px-3 py-1 text-[11px] text-red-600 hover:bg-red-500 hover:text-white transition"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex rounded-full border border-[var(--kh-border)] px-3 py-1 text-[11px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
            >
              Login / Signup
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
