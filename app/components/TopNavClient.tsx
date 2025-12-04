"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import logoImg from '../../public/logomain.png';

type Theme = "dark" | "light";

export default function TopNavClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  
  // New State for Mobile Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    setIsMobileMenuOpen(false); // Close menu on logout
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--kh-border)] bg-[var(--kh-bg-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
        {/* Brand */}
        <Link 
          href="/" 
          className="flex items-center gap-3 z-50"
          onClick={() => setIsMobileMenuOpen(false)}
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

        {/* --- DESKTOP NAV (Hidden on Mobile) --- */}
        <nav className="hidden md:flex items-center gap-2 text-xs md:text-sm">
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

        {/* --- MOBILE ACTIONS (Visible only on Mobile) --- */}
        <div className="flex items-center gap-2 md:hidden">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-[13px] text-[var(--kh-text-secondary)] transition"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--kh-border)] text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)] transition"
            >
               {isMobileMenuOpen ? (
                // Close Icon
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
              ) : (
                // Menu Icon
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              )}
            </button>
        </div>
      </div>

      {/* --- MOBILE MENU DROPDOWN --- */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-4 py-4 shadow-xl">
           <nav className="flex flex-col space-y-3">
              <Link
                href="/news"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                News &amp; Updates
              </Link>
              <Link
                href="/videos"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                Learn &amp; Tutorials
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)]"
              >
                Marketplace
              </Link>
              
              <div className="my-2 border-t border-[var(--kh-border)]"></div>

              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
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
                  onClick={() => setIsMobileMenuOpen(false)}
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