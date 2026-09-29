"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import Icon from "./Icon";

const groups = [
  { label: "Learn", links: [
    ["Video tutorials", "/videos"], ["Arabic quiz", "/arabic-quiz"],
    ["Arabic Word Rush", "/arabic-word-rush"], ["Baybayin translator", "/baybayin"], ["Baybayin cards", "/baybayin-card"],
  ] },
  { label: "Daily tools", links: [["Budget tracker", "/budget"], ["Calorie tracker", "/calorie-tracker"]] },
  { label: "Discover", links: [["Rewards marketplace", "/marketplace"], ["Job board", "/market/jobs"], ["Restaurants", "/market/restaurants"], ["Supermarkets", "/market/supermarkets"]] },
];

export default function TopNavClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [error, setError] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const groupButtons = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);
  useEffect(() => {
    const syncTheme = () => setDark(document.documentElement.classList.contains("kh-dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) { setOpenGroup(null); setMenuOpen(false); }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (openGroup) groupButtons.current[openGroup]?.focus();
        else if (menuOpen) headerRef.current?.querySelector<HTMLButtonElement>(".kh-menu-toggle")?.focus();
        setOpenGroup(null); setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [openGroup, menuOpen]);

  const close = () => { setMenuOpen(false); setOpenGroup(null); };
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("kh-dark", next);
    document.documentElement.classList.toggle("kh-light", !next);
    try { localStorage.setItem("kh-theme", next ? "dark" : "light"); } catch { /* Theme works without storage. */ }
    setDark(next);
  };
  const logout = async () => {
    try { await signOut(auth); close(); router.push("/"); }
    catch { setError("Could not log out. Please try again."); }
  };
  const navLink = (label: string, href: string) => <Link key={href} href={href} onClick={close} aria-current={pathname === href ? "page" : undefined} className="kh-nav-link">{label}</Link>;

  return (
    <header className="kh-header" ref={headerRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenGroup(null);
    }}>
      <div className="kh-nav-wrap">
        <Link href="/" className="kh-brand" onClick={close} aria-label="Kabayan Hub home">
          <Image src="/logomain.png" alt="" width={42} height={42} unoptimized />
          <span>Kabayan<span className="kh-brand-blue">Hub</span><small>YOUR HOME AWAY FROM HOME</small></span>
        </Link>
        <nav className="kh-desktop-nav" aria-label="Main navigation">
          {navLink("Home", "/")}{navLink("News", "/news")}
          {groups.map((group) => (
            <div className="kh-nav-group" key={group.label}>
              <button ref={(el) => { groupButtons.current[group.label] = el; }} className={`kh-nav-link ${group.links.some(([, href]) => pathname === href || pathname.startsWith(href + "/")) ? "is-active" : ""}`} aria-expanded={openGroup === group.label} aria-controls={`nav-${group.label.replaceAll(" ", "-")}`} onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}>
                {group.label}<Icon name="chevron" width={13} height={13} />
              </button>
              {openGroup === group.label && <div className="kh-dropdown" id={`nav-${group.label.replaceAll(" ", "-")}`}>
                <p>{group.label}</p>{group.links.map(([label, href]) => navLink(label, href))}
              </div>}
            </div>
          ))}
          {navLink("Community", "/community")}
        </nav>
        <div className="kh-nav-actions">
          <button className="kh-icon-button" onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}><Icon name={dark ? "sun" : "moon"} width={18} height={18} /></button>
          <div className="kh-desktop-account">
            {ready && user ? <><Link href="/settings" className="kh-icon-button" aria-label="Profile and settings" onClick={close}><Icon name="settings" /></Link><Link href="/dashboard" className="kh-button kh-button-primary" onClick={close}>My dashboard<Icon name="arrow" width={16} /></Link><button className="kh-text-button" onClick={logout}>Log out</button></> : <><Link href="/login" className="kh-text-button">Log in</Link><Link href="/signup" className="kh-button kh-button-primary">Join the hub<Icon name="arrow" width={16} /></Link></>}
          </div>
          <button className="kh-icon-button kh-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => { setMenuOpen(!menuOpen); setOpenGroup(null); }}><Icon name={menuOpen ? "close" : "menu"} /></button>
        </div>
      </div>
      {error && <p className="kh-nav-error" role="alert">{error}</p>}
      {menuOpen && <nav className="kh-mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">
        <div className="kh-mobile-primary">{navLink("Home", "/")}{navLink("News", "/news")}{navLink("Community", "/community")}{navLink("My dashboard", "/dashboard")}</div>
        {groups.map((group) => <div className="kh-mobile-group" key={group.label}><p>{group.label}</p>{group.links.map(([label, href]) => navLink(label, href))}</div>)}
        <div className="kh-mobile-account">{user ? <>{navLink("Profile & settings", "/settings")}<button className="kh-button kh-button-secondary" onClick={logout}>Log out</button></> : <><Link href="/login" className="kh-button kh-button-secondary" onClick={close}>Log in</Link><Link href="/signup" className="kh-button kh-button-primary" onClick={close}>Join the hub<Icon name="arrow" /></Link></>}</div>
      </nav>}
    </header>
  );
}
