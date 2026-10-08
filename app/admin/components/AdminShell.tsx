"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db } from "../../../lib/backend";
import { onAuthStateChanged, type User } from "../../../lib/backend/auth";
import { doc, onSnapshot } from "../../../lib/backend/db";
import Icon, { type IconName } from "../../components/Icon";

const AdminContext = createContext<User | null>(null);
export function useAdmin() {
  const user = useContext(AdminContext);
  if (!user) throw new Error("Admin context is required");
  return user;
}
const sections: { label: string; links: { title: string; href: string; icon: IconName }[] }[] = [
  { label: "WORKSPACE", links: [
    { title: "Overview", href: "/admin", icon: "home" },
    { title: "Users", href: "/admin/users", icon: "users" },
    { title: "News & articles", href: "/admin/news", icon: "news" },
    { title: "Tutorials & rewards", href: "/admin/content", icon: "gift" },
    { title: "Community reports", href: "/admin/community", icon: "shield" },
    { title: "Live Tambayan", href: "/admin/tambayan", icon: "chat" },
  ] },
  { label: "LOCAL DIRECTORY", links: [
    { title: "Jobs & applications", href: "/admin/jobs", icon: "briefcase" },
    { title: "Restaurants", href: "/admin/market/restaurants", icon: "globe" },
    { title: "Supermarkets", href: "/admin/market/supermarkets", icon: "bag" },
    { title: "Products", href: "/admin/market/products", icon: "wallet" },
  ] },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ user: User | null; loading: boolean; error: string }>({ user: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let watchedUid: string | null = null;
    let stopProfile = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      if (!active) return;
      // A profile update for this account must not unmount the editor. The live
      // role subscription below still removes access if admin rights change.
      if (user && user.uid === watchedUid) {
        setState(previous => previous.user ? { ...previous, user } : previous);
        return;
      }
      watchedUid = user?.uid ?? null;
      const current = ++generation;
      stopProfile();
      if (!user) { setState({ user: null, loading: false, error: "Sign in with your administrator account to continue." }); return; }
      setState({ user: null, loading: true, error: "" });
      stopProfile = onSnapshot(doc(db, "users", user.uid), snapshot => {
        if (!active || current !== generation) return;
        const allowed = snapshot.data()?.role === "admin";
        setState({ user: allowed ? user : null, loading: false, error: allowed ? "" : "This account does not have administrator access." });
      }, () => { if (active && current === generation) setState({ user: null, loading: false, error: "We couldn’t check your access. Check your connection and try again." }); });
    });
    return () => { active = false; stopAuth(); stopProfile(); };
  }, [attempt]);
  if (!state.user) return <section className="admin-access kh-card">
    <span className="kh-feature-icon kh-tone-blue"><Icon name="shield" /></span>
    <h1>{state.loading ? "Opening your workspace…" : "Administrator access"}</h1>
    <p role={state.loading ? "status" : "alert"}>{state.loading ? "Checking your account permissions." : state.error}</p>
    {!state.loading && <div className="admin-actions"><Link href="/login" className="kh-button kh-button-primary">Sign in</Link><button className="kh-button kh-button-secondary" onClick={() => setAttempt(value => value + 1)}>Check again</button><Link href="/" className="kh-text-button">Back to the hub</Link></div>}
  </section>;
  return <AdminContext.Provider value={state.user}><div className="admin-workspace">
    <aside className="admin-sidebar">
      <div className="admin-wordmark"><span className="kh-feature-icon kh-tone-blue"><Icon name="shield" /></span><div><strong>Hub Studio</strong><small>KABAYANHUB ADMIN</small></div></div>
      <nav aria-label="Admin navigation">{sections.map(section => <div className="admin-nav-group" key={section.label}><p>{section.label}</p>{section.links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}><Icon name={link.icon} width={18} /><span>{link.title}</span></Link>)}</div>)}</nav>
      <div className="admin-sidebar-footer"><span className="admin-admin-badge"><Icon name="check" width={14} /> Administrator</span><p>{state.user.email}</p><Link href="/" className="kh-inline-link">View live website <Icon name="external" width={14} /></Link></div>
    </aside>
    <div className="admin-content">{children}</div>
  </div></AdminContext.Provider>;
}
