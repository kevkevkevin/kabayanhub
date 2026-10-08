"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "../../lib/backend/auth";
import { requireBackend } from "../../lib/backend/client";
import Icon from "../components/Icon";

type Member = { id: string; username: string; displayName: string; points: number; rank: number };
type Rankings = { members: Member[]; me: Member | null; total: number; updatedAt: string };
const name = (member: Member) => member.username || member.displayName || "Kabayan";
export default function KpLeaderboard() {
  const [identity, setIdentity] = useState<{ ready: boolean; uid: string | null }>({ ready: false, uid: null });
  useEffect(() => onAuthStateChanged(auth, user => setIdentity({ ready: true, uid: user?.uid ?? null })), []);
  return <div className="kp-page"><header className="kp-heading"><p className="kh-eyebrow">A LITTLE FRIENDLY COMPETITION</p><h1>Top <span>Kabayans.</span></h1><p>Meet the community members with the highest Kabayan Points right now.</p></header>
    {!identity.ready ? <p className="kh-card" role="status">Opening the leaderboard…</p> : identity.uid ? <MemberRankings key={identity.uid} uid={identity.uid} /> : <section className="kh-card kp-signin"><span aria-hidden="true">🏆</span><h2>See who’s leading the hub.</h2><p>Sign in to see the current KP rankings and find your own place in the community.</p><Link className="kh-button kh-button-primary" href="/login">Sign in to view rankings</Link></section>}
  </div>;
}

function MemberRankings({ uid }: { uid: string }) {
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let loading = false;
    const controller = new AbortController();
    async function refresh() {
      if (loading) return;
      loading = true; setBusy(true);
      try {
        const { data, error: failed } = await requireBackend().rpc("get_kp_leaderboard").abortSignal(controller.signal);
        if (failed) throw failed;
        if (active && auth.currentUser?.uid === uid) { setRankings(data); setError(""); }
      } catch { if (active) setError("Couldn’t refresh the leaderboard. Please try again."); }
      finally { loading = false; if (active) setBusy(false); }
    }
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("kabayan-coins-updated", visible);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("kabayan-coins-updated", visible); };
  }, [uid, revision]);
  const leader = rankings?.members[0];
  return <>
    <div className="kp-toolbar"><p>{rankings ? `${rankings.total.toLocaleString()} active member${rankings.total === 1 ? "" : "s"} · Updated ${new Date(rankings.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading current balances…"}</p><button type="button" className="kh-button kh-button-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}><Icon name="refresh" width={15} />{busy ? "Refreshing…" : "Refresh rankings"}</button></div>
    {error && <p role="alert" className="kh-card kp-error">{error} {rankings && "Showing the last loaded rankings."}</p>}
    {leader && rankings && <section className="kp-highlights" aria-label="Leaderboard highlights"><div className="kp-leader"><div><p className="kh-eyebrow">{rankings.members.filter(member => member.rank === 1).length > 1 ? "SHARING THE TOP SPOT" : "LEADING THE HUB"}</p><h2>{name(leader)}</h2><p><strong>{leader.points.toLocaleString()}</strong> KP</p><span>Rank #1 · Current balance</span></div><span className="kp-trophy" aria-hidden="true">🏆</span></div><div className="kh-card kp-own"><p className="kh-eyebrow">YOUR PLACE IN THE COMMUNITY</p><strong>{rankings.me ? `#${rankings.me.rank.toLocaleString()}` : "—"}</strong><p>{rankings.me?.points.toLocaleString() ?? "0"} Kabayan Points</p><Link href="/dashboard" className="kh-inline-link">My dashboard <Icon name="arrow" width={14} /></Link></div></section>}
    <section className="kh-card kp-ranking"><div className="kp-list-heading"><h2>Current KP rankings</h2><span>Top 50 members</span></div><p className="kp-explanation">Ranked by current KP balance. Equal balances share a rank. Rankings refresh every 30 seconds while this page is visible.</p>
      {!rankings ? <p role="status">Loading members…</p> : !rankings.members.length ? <p>No rankings yet. Your next step starts on the dashboard.</p> : <ol className="kp-list">{rankings.members.map(member => <li key={member.id} className={member.id === uid ? "is-you" : ""}><span className={`kp-position ${member.rank <= 3 ? "is-top" : ""}`}>#{member.rank}</span><span className="kp-avatar" aria-hidden="true">{name(member).slice(0, 1).toUpperCase()}</span><div className="kp-member"><strong>{name(member)}{member.id === uid && <small>You</small>}</strong><span>{member.username && member.displayName && member.username !== member.displayName ? member.displayName : "KabayanHub member"}</span></div><span className="kp-score"><strong>{member.points.toLocaleString()}</strong><small>KP</small></span></li>)}</ol>}
    </section>
  </>;
}
