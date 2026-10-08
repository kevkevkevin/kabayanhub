"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminUsersRequest, type AdminMember, type UserAction, type UserPage } from "../../../lib/backend/admin-users";
import { useAdmin } from "../components/AdminShell";
import Icon from "../../components/Icon";

type Selection = { user: AdminMember; action: UserAction["action"] };
const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Never";
export default function AdminUsersPage() {
  const admin = useAdmin();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState({ search: "", status: "all", page: 0 });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<UserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ search: query.search, status: query.status, page: String(query.page) });
        const next = await adminUsersRequest(`?${params}`, undefined, controller.signal);
        if (!controller.signal.aborted) {
          if (query.page > 0 && next.total <= query.page * 25) setQuery(current => ({ ...current, page: Math.max(0, Math.ceil(next.total / 25) - 1) }));
          else setResult(next);
        }
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Couldn’t load users."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [query, revision]);
  return <div className="admin-page-stack">
    <header className="admin-overview-header"><div><p className="kh-eyebrow">YOUR KABAYAN COMMUNITY</p><h1>Users<span>.</span></h1><p>Manage member access, Kabayan Points, and arcade coins.</p></div><button className="kh-button kh-button-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}><Icon name="refresh" width={16} />Refresh</button></header>
    <form className="admin-user-filters kh-card" onSubmit={event => { event.preventDefault(); setQuery({ search: search.trim(), status: filter, page: 0 }); }}><label>Find a member<input type="search" maxLength={100} placeholder="Email, username, name, or user ID" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Account status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All users</option><option value="active">Active</option><option value="blocked">Blocked</option></select></label><button className="kh-button kh-button-primary" type="submit">Search users</button></form>
    {message && <p role="status" className="admin-note">{message}</p>}
    {error && <p role="alert" className="admin-error">{error}</p>}
    <section className="kh-card admin-user-list" aria-label="Members" aria-busy={loading}>
      <div className="admin-section-heading"><h2>{result ? `${result.total.toLocaleString()} member${result.total === 1 ? "" : "s"}` : "Members"}</h2><span>{loading ? "Loading…" : "25 per page"}</span></div>
      <div className="admin-user-table-wrap"><table className="admin-user-table"><thead><tr><th>Member</th><th>Access</th><th>KP</th><th>Coins</th><th>Joined / last sign-in</th><th>Manage</th></tr></thead><tbody>{result?.users.map(member => <tr key={member.id}>
        <td><strong>{member.displayName || member.username || "Kabayan"}{member.id === admin.uid ? " (you)" : ""}</strong><span>{member.email || "No email"}</span><small>@{member.username || "—"} · {member.confirmed ? "Email confirmed" : "Email unconfirmed"}</small><details><summary>User ID</summary><code>{member.id}</code></details></td>
        <td><span className={`admin-user-badge ${member.blocked ? "is-blocked" : ""}`}>{member.deleting ? "Deletion pending" : member.blocked ? "Blocked" : "Active"}</span><small>{member.role === "admin" ? "Administrator" : "Member"}</small></td>
        <td className="admin-user-number">{member.points.toLocaleString()}</td><td className="admin-user-number">{member.coins.toLocaleString()}{!member.walletInitialized && <small>Starter balance</small>}</td>
        <td><span>{date(member.createdAt)}</span><small>Last: {date(member.lastSignInAt)}</small></td>
        <td><div className="admin-user-actions"><button disabled={loading || member.deleting} onClick={() => setSelection({ user: member, action: "balances" })}>Edit balances</button>{member.role !== "admin" && member.id !== admin.uid ? <><button disabled={loading || member.deleting} onClick={() => setSelection({ user: member, action: member.blocked ? "unblock" : "block" })}>{member.blocked ? "Unblock" : "Block"}</button><button className="admin-user-danger" disabled={loading} onClick={() => setSelection({ user: member, action: "delete" })}>{member.deleting ? "Finish deletion" : "Delete"}</button></> : <small>Admin account protected</small>}</div></td>
      </tr>)}</tbody></table></div>
      {!loading && !result?.users.length && <p className="admin-note">No users match this search.</p>}
      <div className="admin-user-pagination"><button className="kh-button kh-button-secondary" disabled={loading || query.page === 0} onClick={() => setQuery(current => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {query.page + 1} of {Math.max(1, Math.ceil((result?.total || 0) / 25))}</span><button className="kh-button kh-button-secondary" disabled={loading || !result || (query.page + 1) * 25 >= result.total} onClick={() => setQuery(current => ({ ...current, page: current.page + 1 }))}>Next</button></div>
    </section>
    <p className="admin-note">Balance changes and account actions are recorded in the admin audit log. Starter coins are included for members who haven’t opened their wallet yet. Administrator accounts cannot be blocked or deleted here.</p>
    {selection && <UserActionDialog key={`${selection.user.id}-${selection.action}`} selection={selection} close={() => setSelection(null)} saved={() => { setMessage(`${selection.action === "balances" ? "Balances updated" : selection.action === "delete" ? "Account deleted" : selection.action === "block" ? "Account blocked" : "Account unblocked"}. The action was recorded.`); setSelection(null); setRevision(value => value + 1); }} />}
  </div>;
}

function UserActionDialog({ selection: { user, action }, close, saved }: { selection: Selection; close: () => void; saved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [points, setPoints] = useState(String(user.points));
  const [coins, setCoins] = useState(String(user.coins));
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<UserAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const title = action === "balances" ? "Edit balances" : action === "delete" ? "Delete account permanently" : action === "block" ? "Block account" : "Unblock account";
  async function submit() {
    if (lock.current) return;
    const payload: UserAction = pending || { requestId: crypto.randomUUID(), userId: user.id, action, reason: reason.trim(), points: Number(points), coins: Number(coins), expectedPoints: user.points, expectedCoins: user.coins, ...(action === "delete" && confirmation === "DELETE" ? { confirmation: `DELETE ${user.id}` } : {}) };
    lock.current = true; setBusy(true); setError(""); setPending(payload);
    try { await adminUsersRequest("", payload); saved(); }
    catch (err) { setError(err instanceof Error ? err.message : "Connection interrupted. Retry this same action safely."); }
    finally { lock.current = false; setBusy(false); }
  }
  return createPortal(<dialog className="admin-user-dialog" ref={dialog} aria-labelledby="admin-user-action-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}><form onSubmit={event => { event.preventDefault(); void submit(); }}>
    <div className="admin-section-heading"><h2 id="admin-user-action-title">{title}</h2><button type="button" aria-label="Close user action" disabled={busy} onClick={close}>×</button></div><p><strong>{user.displayName || user.username}</strong><br />{user.email || user.id}</p>
    {action === "balances" ? <><p>Enter the new total balances. A concurrent game or conversion will require you to refresh before saving.</p><div className="admin-user-balance-fields"><label>Kabayan Points<input autoFocus type="number" required min="0" max="1000000000" step="1" value={points} disabled={!!pending} onChange={event => setPoints(event.target.value)} /></label><label>Kabayan Coins<input type="number" required min="0" max="1000000000" step="1" value={coins} disabled={!!pending} onChange={event => setCoins(event.target.value)} /></label></div></> : <p>{action === "delete" ? "This permanently removes the login, profile, avatar, coin wallet, points, posts, and personal activity. It cannot be undone. The admin audit record is retained." : action === "block" ? "This stops new sign-ins and prevents existing sessions from changing data or earning and spending balances. The account and its data are kept." : "This restores sign-in and access to the hub. Existing balances and data are kept."}</p>}
    <label>Reason<input autoFocus={action !== "balances"} required maxLength={250} placeholder="Why are you making this change?" value={reason} disabled={!!pending} onChange={event => setReason(event.target.value)} /></label>
    {action === "delete" && <label>Type DELETE to confirm<input required pattern="DELETE" autoComplete="off" value={confirmation} disabled={!!pending} onChange={event => setConfirmation(event.target.value)} /></label>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-actions"><button type="button" className="kh-button kh-button-secondary" disabled={busy} onClick={close}>Cancel</button><button type="submit" className={`kh-button ${action === "delete" ? "admin-user-delete-button" : "kh-button-primary"}`} disabled={busy || !reason.trim() || (action === "delete" && confirmation !== "DELETE")}>{busy ? "Saving…" : pending ? "Retry same action" : action === "balances" ? "Save balances" : title}</button></div>
  </form></dialog>, document.body);
}
