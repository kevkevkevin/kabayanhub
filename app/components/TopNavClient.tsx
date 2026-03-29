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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

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
    closeAllMenus();
    router.push("/");
  };

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsLearnOpen(false);
    setIsToolsOpen(false);
  };

  // Shared Styles
  const navItemClasses = "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all hover:bg-[var(--kh-bg-subtle)] text-[var(--kh-text-secondary)] hover:text-[var(--kh-text)]";
  const dropdownItemClasses = "flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition-colors";

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-4">
      <div className="mx-auto max-w-6xl">
        {/* Main Pill Container */}
        <div className="flex h-14 items-center justify-between rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)]/80 px-4 shadow-sm backdrop-blur-xl md:px-5">
          
          {/* Brand - Smaller and Tighter */}
          <Link href="/" className="flex items-center gap-2.5 group" onClick={closeAllMenus}>
            <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-[var(--kh-yellow)] shadow-sm">
              <img src={logoImg.src} alt="Logo" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:block leading-none">
              <h3 className="text-[15px] font-bold tracking-tight text-[var(--kh-text)]">Kabayan Hub</h3>
              <p className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--kh-text-muted)] font-bold">OFW All In One Platform</p>
            </div>
          </Link>

          {/* DESKTOP NAV - Slimmer Pill */}
          <nav className="hidden items-center gap-0.5 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]/30 p-1 md:flex">
            <Link href="/news" className={navItemClasses}>News</Link>

            <div className="relative" ref={learnRef}>
              <button
                onClick={() => { setIsLearnOpen(!isLearnOpen); setIsToolsOpen(false); }}
                className={`${navItemClasses} flex items-center gap-1`}
              >
                Learn <span className="text-[10px] opacity-50">▾</span>
              </button>
              {isLearnOpen && (
                <div className="absolute left-0 mt-4 w-48 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-xl">
                  <Link href="/videos" onClick={closeAllMenus} className={dropdownItemClasses}>🎥 Videos</Link>
                  <Link href="/arabic-quiz" onClick={closeAllMenus} className={dropdownItemClasses}>🟢 Arabic Quiz</Link>
                </div>
              )}
            </div>

            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => { setIsToolsOpen(!isToolsOpen); setIsLearnOpen(false); }}
                className={`${navItemClasses} flex items-center gap-1`}
              >
                Tools <span className="text-[10px] opacity-50">▾</span>
              </button>
              {isToolsOpen && (
                <div className="absolute left-0 mt-4 w-48 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-xl">
                  <Link href="/budget" onClick={closeAllMenus} className={dropdownItemClasses}>💸 Budget Tracker</Link>
                  <Link href="/calorie-tracker" onClick={closeAllMenus} className={dropdownItemClasses}>🍽️ Calories</Link>
                </div>
              )}
            </div>

            <Link href="/marketplace" className={navItemClasses}>Market</Link>
          </nav>

          {/* Right Side - Fixed Alignment */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden md:flex h-8 items-center px-4 rounded-full bg-[var(--kh-yellow)] text-[12px] font-bold text-slate-900 shadow-sm hover:brightness-105 transition-all"
            >
              My Stats
            </Link>

            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-xs hover:bg-[var(--kh-bg-card)] transition-colors"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {user ? (
              <button 
                onClick={handleLogout} 
                className="hidden md:flex h-8 items-center px-4 rounded-full border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link 
                href="/login" 
                className="hidden md:flex h-8 items-center px-5 rounded-full bg-slate-900 dark:bg-slate-100 text-[12px] font-medium text-white dark:text-slate-900 hover:opacity-90 transition-all"
              >
                Login
              </Link>
            )}

            {/* Mobile Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kh-border)] md:hidden"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Card */}
      {isMobileMenuOpen && (
        <div className="fixed inset-x-6 top-24 z-50 overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-2xl md:hidden animate-in zoom-in-95">
          <nav className="flex flex-col gap-1">
            <Link href="/news" onClick={closeAllMenus} className="px-4 py-2.5 rounded-xl hover:bg-[var(--kh-bg-subtle)] text-sm">News & Updates</Link>
            <Link href="/videos" onClick={closeAllMenus} className="px-4 py-2.5 rounded-xl hover:bg-[var(--kh-bg-subtle)] text-sm">🎥 Videos</Link>
            <Link href="/arabic-quiz" onClick={closeAllMenus} className="px-4 py-2.5 rounded-xl hover:bg-[var(--kh-bg-subtle)] text-sm">🟢 Arabic Quiz</Link>
            <Link href="/marketplace" onClick={closeAllMenus} className="px-4 py-2.5 rounded-xl hover:bg-[var(--kh-bg-subtle)] text-sm">Marketplace</Link>
            <div className="my-2 border-t border-[var(--kh-border)]" />
            <Link href="/dashboard" onClick={closeAllMenus} className="flex justify-center rounded-xl bg-[var(--kh-yellow)] p-3 text-sm font-bold text-slate-900">My Stats</Link>
          </nav>
        </div>
      )}
    </header>
  );
}