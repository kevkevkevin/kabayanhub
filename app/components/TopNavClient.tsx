"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import logoImg from "../../public/logomain.png";

type Theme = "dark" | "light";

export default function TopNavClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  // Mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dropdown states
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // For closing dropdown on outside click
  const learnRef = useRef<HTMLDivElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("kh-theme") as Theme | null;
    const initial: Theme = saved === "light" || saved === "dark" ? saved : "light";
    applyTheme(initial);
    setTheme(initial);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (learnRef.current && !learnRef.current.contains(target)) setIsLearnOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(target)) setIsToolsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
    setIsMobileMenuOpen(false);
    setIsLearnOpen(false);
    setIsToolsOpen(false);
    router.push("/");
  };

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsLearnOpen(false);
    setIsToolsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--kh-border)] bg-[var(--kh-bg-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 z-50"
          onClick={closeAllMenus}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--kh-yellow)] text-xs font-black text-slate-900 shadow-[var(--kh-card-shadow)]">
            <img
              src={logoImg.src}
              alt="Kabayan Hub Logo"
              className="h-full w-full object-cover rounded-2xl"
            />
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

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-2 text-xs md:text-sm">
          <Link
            href="/news"
            className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
          >
            News &amp; Updates
          </Link>

          {/* Learn & Tutorials dropdown */}
          <div className="relative" ref={learnRef}>
            <button
              type="button"
              onClick={() => {
                setIsLearnOpen((v) => !v);
                setIsToolsOpen(false);
              }}
              className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition inline-flex items-center gap-1"
            >
              Learn &amp; Tutorials
              <span className="text-[10px] opacity-80">▾</span>
            </button>

            {isLearnOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-[var(--kh-card-shadow)]">
                <Link
                  href="/videos"
                  onClick={() => setIsLearnOpen(false)}
                  className="block px-4 py-3 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                >
                  🎥 Videos
                </Link>
                <Link
                  href="/arabic-quiz"
                  onClick={() => setIsLearnOpen(false)}
                  className="block px-4 py-3 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                >
                  🟢 Learn Arabic (Quiz)
                </Link>
              </div>
            )}
          </div>

          {/* Kabayan Tools dropdown */}
          <div className="relative" ref={toolsRef}>
            <button
              type="button"
              onClick={() => {
                setIsToolsOpen((v) => !v);
                setIsLearnOpen(false);
              }}
              className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition inline-flex items-center gap-1"
            >
              Kabayan Tools
              <span className="text-[10px] opacity-80">▾</span>
            </button>

            {isToolsOpen && (
              <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-[var(--kh-card-shadow)]">
                <Link
                  href="/budget"
                  onClick={() => setIsToolsOpen(false)}
                  className="block px-4 py-3 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                >
                  💸 Budget Tracker
                </Link>
                <Link
                  href="/calorie-tracker"
                  onClick={() => setIsToolsOpen(false)}
                  className="block px-4 py-3 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                >
                  🍽️ Calorie Tracker
                </Link>
                <Link
                  href="/supermarket-sale"
                  onClick={() => setIsToolsOpen(false)}
                  className="block px-4 py-3 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                >
                  🛒 Supermarket Sale
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/marketplace"
            className="rounded-full px-3 py-1 text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
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
              className="rounded-full border border-red-200 px-3 py-1 text-[11px] text-red-600 hover:bg-red-500 hover:text-white transition"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-[var(--kh-border)] px-3 py-1 text-[11px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
            >
              Login / Signup
            </Link>
          )}
        </nav>

        {/* MOBILE ACTIONS */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-[13px] text-[var(--kh-text-secondary)] transition"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsLearnOpen(false);
              setIsToolsOpen(false);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--kh-border)] text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)] transition"
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 18 18" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-4 py-4 shadow-xl">
          <nav className="flex flex-col space-y-2">
            <Link
              href="/news"
              onClick={closeAllMenus}
              className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
            >
              News &amp; Updates
            </Link>

            {/* Learn section (mobile) */}
            <div className="rounded-md border border-[var(--kh-border)] overflow-hidden">
              <div className="px-3 py-2 text-sm font-semibold text-[var(--kh-text)] bg-[var(--kh-bg-subtle)]">
                Learn &amp; Tutorials
              </div>
              <Link
                href="/videos"
                onClick={closeAllMenus}
                className="block px-3 py-2 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                🎥 Videos
              </Link>
              <Link
                href="/arabic-quiz"
                onClick={closeAllMenus}
                className="block px-3 py-2 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                🟢 Learn Arabic (Quiz)
              </Link>
            </div>

            {/* Tools section (mobile) */}
            <div className="rounded-md border border-[var(--kh-border)] overflow-hidden">
              <div className="px-3 py-2 text-sm font-semibold text-[var(--kh-text)] bg-[var(--kh-bg-subtle)]">
                Kabayan Tools
              </div>
              <Link
                href="/budget"
                onClick={closeAllMenus}
                className="block px-3 py-2 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                💸 Budget Tracker
              </Link>
              <Link
                href="/calorie-tracker"
                onClick={closeAllMenus}
                className="block px-3 py-2 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                🍽️ Calorie Tracker
              </Link>
              <Link
                href="/supermarket-sale"
                onClick={closeAllMenus}
                className="block px-3 py-2 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                🛒 Supermarket Sale
              </Link>
            </div>

            <Link
              href="/marketplace"
              onClick={closeAllMenus}
              className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
            >
              Marketplace
            </Link>

            <div className="my-2 border-t border-[var(--kh-border)]" />

            <Link
              href="/dashboard"
              onClick={closeAllMenus}
              className="block w-full text-center rounded-md bg-[var(--kh-yellow)] px-3 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-[#ffe56f]"
            >
              My Kabayan Stats
            </Link>

            {user ? (
              <button
                onClick={handleLogout}
                className="block w-full rounded-md border border-red-200 px-3 py-2 text-center text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                onClick={closeAllMenus}
                className="block w-full rounded-md border border-[var(--kh-border)] px-3 py-2 text-center text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                Login / Signup
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
