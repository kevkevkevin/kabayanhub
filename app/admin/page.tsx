"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { requireBackend } from "../../lib/backend/client";
import Icon, { type IconName } from "../components/Icon";

type Summary = { members: number; articles: number; posts: number; reports: number; pending: number; news: { id: string; title: string; tag: string; date: string }[] };
const tools: { title: string; description: string; href: string; icon: IconName; tone: string }[] = [
  { title: "News & articles", description: "Publish helpful updates and stories from home.", href: "/admin/news", icon: "news", tone: "blue" },
  { title: "Tutorials", description: "Add videos and everyday learning resources.", href: "/admin/content", icon: "play", tone: "red" },
  { title: "Rewards", description: "Manage rewards, point prices, and available stock.", href: "/admin/content?section=marketplace", icon: "gift", tone: "yellow" },
  { title: "Jobs & applications", description: "Manage opportunities and review applications.", href: "/admin/jobs", icon: "briefcase", tone: "blue" },
  { title: "Local directory", description: "Keep restaurants, supermarkets, and products up to date.", href: "/admin/market/restaurants", icon: "globe", tone: "yellow" },
  { title: "Live Tambayan", description: "Manage chat, stickers, and community moments.", href: "/admin/tambayan", icon: "chat", tone: "red" },
];

export default function AdminOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [updated, setUpdated] = useState("");
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const client = requireBackend();
      const results = await Promise.all([
        client.from("users").select("id", { count: "exact", head: true }).abortSignal(signal),
        client.from("news").select("id", { count: "exact", head: true }).abortSignal(signal),
        client.from("social_posts").select("id", { count: "exact", head: true }).abortSignal(signal),
        client.from("social_reports").select("id", { count: "exact", head: true }).eq("data->>status", "open").abortSignal(signal),
        client.from("marketplace_purchases").select("id", { count: "exact", head: true }).eq("data->>status", "pending").abortSignal(signal),
        client.from("news").select("id,title:data->>title,tag:data->>tag,date:data->>createdAt").order("data->createdAt", { ascending: false }).limit(5).abortSignal(signal),
      ]);
      if (signal.aborted) return;
      if (results.some(result => result.error)) throw new Error("Couldn’t load the overview. Please try again.");
      setSummary({ members: results[0].count ?? 0, articles: results[1].count ?? 0, posts: results[2].count ?? 0, reports: results[3].count ?? 0, pending: results[4].count ?? 0, news: (results[5].data ?? []).map(item => ({ id: String(item.id), title: item.title || "Untitled article", tag: item.tag || "News", date: item.date || "" })) });
      setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch { if (!signal.aborted) setError("Couldn’t load the overview. Please try again."); }
    finally { if (!signal.aborted) setLoading(false); }
  }, []);
  const [revision, setRevision] = useState(0);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, revision]);
  const filtered = tools.filter(tool => `${tool.title} ${tool.description}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <div className="admin-page-stack">
    <header className="admin-overview-header"><div><p className="kh-eyebrow">YOUR COMMUNITY, AT A GLANCE</p><h1>Welcome to Hub Studio<span>.</span></h1><p>A little behind-the-scenes care. A better hub for every Kabayan.</p></div><button className="kh-button kh-button-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}><Icon name="refresh" width={16} />{loading ? "Refreshing…" : "Refresh"}</button></header>
    {error && <p className="admin-error" role="alert">{error} {summary && "Showing the last loaded figures."}</p>}
    <section className="admin-welcome"><div><span className="admin-live-label"><span /> KABAYANHUB WORKSPACE</span><h2>Make something<br />helpful happen today.</h2><p>Share an update, support a conversation, or help someone find their next opportunity.</p><Link href="/admin/news" className="kh-button kh-button-yellow">Create a news article <Icon name="arrow" width={17} /></Link></div><div className="admin-welcome-art" aria-hidden="true"><span className="admin-art-orbit" /><Icon name="users" width={88} height={88} /><span className="admin-art-star">✦</span><span className="admin-art-caption">ONE HUB.<br />ONE KABAYAN FAMILY.</span></div></section>
    <section className="admin-stats" aria-label="Hub statistics" aria-busy={loading}>
      {[{ label: "Registered members", value: summary?.members, icon: "users" }, { label: "Published articles", value: summary?.articles, icon: "news" }, { label: "Community posts", value: summary?.posts, icon: "chat" }].map(stat => <div key={stat.label} className="admin-stat"><Icon name={stat.icon as IconName} /><span>{stat.label}</span><strong>{stat.value === undefined ? "—" : stat.value.toLocaleString()}</strong></div>)}
    </section>
    <div className="admin-section-heading"><h2>Needs your attention</h2><span>{updated ? `Updated ${updated}` : "Waiting for data"}</span></div>
    <section className="admin-attention" aria-label="Items needing attention"><Link href="/admin/community"><span className="kh-feature-icon kh-tone-red"><Icon name="flag" /></span><div><strong>Community reports</strong><p>{summary ? `${summary.reports} open report${summary.reports === 1 ? "" : "s"} to review` : "Review reported conversations"}</p></div><Icon name="arrow" /></Link><Link href="/admin/content?section=purchases"><span className="kh-feature-icon kh-tone-yellow"><Icon name="gift" /></span><div><strong>Reward redemptions</strong><p>{summary ? `${summary.pending} pending redemption${summary.pending === 1 ? "" : "s"}` : "Review pending redemptions"}</p></div><Icon name="arrow" /></Link></section>
    <section aria-labelledby="admin-tools-heading"><div className="admin-section-heading"><h2 id="admin-tools-heading">Your everyday tools</h2><label className="admin-tool-search"><span className="sr-only">Find an admin tool</span><input type="search" placeholder="Find a tool…" value={search} onChange={event => setSearch(event.target.value)} /></label></div><div className="admin-tools">{filtered.map(tool => <Link href={tool.href} key={tool.title} className="admin-tool"><span className={`kh-feature-icon kh-tone-${tool.tone}`}><Icon name={tool.icon} /></span><h3>{tool.title}</h3><p>{tool.description}</p><span className="admin-tool-open">Open tool <Icon name="arrow" width={16} /></span></Link>)}</div>{!filtered.length && <p className="admin-note" role="status">No tools match “{search}”. Try news, rewards, jobs, or chat.</p>}</section>
    <section className="admin-recent"><div className="admin-section-heading"><div><h2>Latest from the newsroom</h2><p>Your five most recent articles.</p></div><Link href="/admin/news" className="kh-inline-link">Manage articles <Icon name="arrow" width={16} /></Link></div>{summary?.news.map(item => <Link href={`/news/${encodeURIComponent(item.id)}`} className="admin-news-row" key={item.id}><span className="admin-news-symbol"><Icon name="news" /></span><div><span>{item.tag}</span><h3>{item.title}</h3></div><time>{item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</time><Icon name="external" width={16} /></Link>)}{summary && !summary.news.length && <p className="admin-note">No articles yet. Share the first update with your community.</p>}{!summary && <p className="admin-note" role="status">{loading ? "Loading recent articles…" : "Articles are unavailable. Try refreshing."}</p>}</section>
  </div>;
}
