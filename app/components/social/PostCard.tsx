"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { REPLY_LIMIT, socialError, type SocialPost } from "../../../lib/social";
import Icon from "../Icon";
import { Author } from "./Profile";

export default function PostCard({ post, uid, canPost, following, onFollow, onDelete }: { post: SocialPost; uid?: string; canPost: boolean; following: boolean; onFollow: (uid: string) => Promise<void>; onDelete: (id: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number | null>(null);
  const [replies, setReplies] = useState<number | null>(null);
  const [openReplies, setOpenReplies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("spam");
  useEffect(() => {
    let active = true;
    Promise.all([
      getCountFromServer(collection(db, "socialPosts", post.id, "likes")),
      getCountFromServer(collection(db, "socialPosts", post.id, "replies")),
      uid ? getDoc(doc(db, "socialPosts", post.id, "likes", uid)) : null,
    ]).then(([likesSnap, repliesSnap, mine]) => { if (active) { setLikes(likesSnap.data().count); setReplies(repliesSnap.data().count); setLiked(mine?.exists() || false); } }).catch(() => { if (active) setError("Couldn’t load interactions. Refresh the feed to try again."); });
    return () => { active = false; };
  }, [post.id, uid]);
  async function action(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await run(); } catch (err) { setError(socialError(err)); } finally { setBusy(false); }
  }
  async function toggleLike() {
    if (!uid || likes === null) return;
    await action(async () => {
      const reference = doc(db, "socialPosts", post.id, "likes", uid);
      if (liked) await deleteDoc(reference);
      else await setDoc(reference, { uid, createdAt: serverTimestamp() });
      setLiked(!liked); setLikes(value => Math.max(0, (value || 0) + (liked ? -1 : 1)));
    });
  }
  return <article className="social-post">
    <div className="social-post-heading"><Author uid={post.uid} /><div className="social-post-meta"><time dateTime={post.createdAt?.toDate().toISOString()}>{post.createdAt?.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" }) || "Just now"}</time>{uid && uid !== post.uid && <button disabled={busy} className="social-follow" aria-pressed={following} onClick={() => action(() => onFollow(post.uid))}>{following ? "Following" : "+ Follow"}</button>}</div></div>
    <p className="social-post-text">{post.text}</p>
    <div className="social-post-actions">
      <button onClick={toggleLike} disabled={!uid || busy || likes === null} aria-label={`${liked ? "Unlike" : "Like"} post`} aria-pressed={liked} className={liked ? "is-liked" : ""}><Icon name="heart" fill={liked ? "currentColor" : "none"} /><span>{likes ?? "—"}</span></button>
      <button onClick={() => setOpenReplies(!openReplies)} aria-expanded={openReplies} aria-label="View replies"><Icon name="chat" /><span>{replies ?? "—"}</span></button>
      <button aria-label="Copy post link" onClick={() => action(async () => { await navigator.clipboard.writeText(`${location.origin}/community?post=${encodeURIComponent(post.id)}`); setNotice("Post link copied."); })}><Icon name="share" /></button>
      {uid === post.uid ? <button className="social-post-overflow" onClick={() => setConfirmDelete(!confirmDelete)} aria-label="Delete post"><Icon name="trash" /></button> : uid && <button className="social-post-overflow" onClick={() => setReport(!report)} aria-label="Report post"><Icon name="flag" /></button>}
    </div>
    {confirmDelete && <div className="social-inline-panel"><p>Delete this post? It will disappear from the feed.</p><button disabled={busy} className="kh-button kh-button-secondary" onClick={() => action(async () => { await deleteDoc(doc(db, "socialPosts", post.id)); onDelete(post.id); })}>Delete post</button><button className="kh-text-button" onClick={() => setConfirmDelete(false)}>Keep post</button></div>}
    {report && uid && <div className="social-inline-panel"><label htmlFor={`report-${post.id}`}>Why are you reporting this post?</label><select id={`report-${post.id}`} value={reason} onChange={e => setReason(e.target.value)}><option value="spam">Spam</option><option value="abuse">Harassment or abuse</option><option value="scam">Scam or misleading content</option><option value="other">Something else</option></select><button disabled={busy} className="kh-button kh-button-secondary" onClick={() => action(async () => { const reportRef = doc(db, "socialReports", `${post.id}_${uid}`); const existing = await getDoc(reportRef); if (!existing.exists()) await setDoc(reportRef, { uid, postId: post.id, reason, status: "open", createdAt: serverTimestamp() }); setReport(false); setNotice("Report received. The community team can review it."); })}>Submit report</button></div>}
    {error && <p role="alert" className="social-error">{error}</p>}{notice && <p role="status" className="social-success">{notice}</p>}
    {openReplies && <Replies postId={post.id} uid={uid} canPost={canPost} onCount={delta => setReplies(value => Math.max(0, (value || 0) + delta))} />}
  </article>;
}

function Replies({ postId, uid, canPost, onCount }: { postId: string; uid?: string; canPost: boolean; onCount: (delta: number) => void }) {
  const [items, setItems] = useState<SocialPost[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, "socialPosts", postId, "replies"), orderBy("createdAt", "desc"), limit(20))).then(snap => {
      if (active) { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost))); setCursor(snap.docs.at(-1) || null); setMore(snap.size === 20); }
    }).catch(err => { if (active) setError(socialError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId]);
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try {
      const snap = await getDocs(query(collection(db, "socialPosts", postId, "replies"), orderBy("createdAt", "desc"), startAfter(cursor), limit(20)));
      setItems(previous => [...previous, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost))]); setCursor(snap.docs.at(-1) || null); setMore(snap.size === 20);
    } catch (err) { setError(socialError(err)); } finally { setLoading(false); }
  }
  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!uid || !canPost || !text.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const reference = await addDoc(collection(db, "socialPosts", postId, "replies"), { uid, text: text.trim(), createdAt: serverTimestamp() });
      const saved = await getDoc(reference);
      setItems(previous => [{ id: saved.id, ...saved.data() } as SocialPost, ...previous]); setText(""); onCount(1);
    } catch (err) { setError(socialError(err)); } finally { setBusy(false); }
  }
  return <section className="social-replies" aria-label="Replies">
    <h3>Conversation</h3>
    {canPost ? <form onSubmit={reply} className="social-reply-form"><label className="sr-only" htmlFor={`reply-${postId}`}>Write a reply</label><textarea id={`reply-${postId}`} rows={2} maxLength={REPLY_LIMIT} value={text} onChange={e => setText(e.target.value)} placeholder="Join the conversation…" /><button disabled={busy || !text.trim()} className="kh-button kh-button-primary">{busy ? "Replying…" : "Reply"}</button></form> : <p><Link className="kh-inline-link" href={uid ? "/dashboard#social-profile" : "/login"}>{uid ? "Set up your profile" : "Log in"}</Link> to reply.</p>}
    {error && <p role="alert" className="social-error">{error}</p>}
    {items.map(item => <div className="social-reply" key={item.id}><Author uid={item.uid} /><p className="social-post-text">{item.text}</p>{uid === item.uid && <button disabled={busy} className="kh-text-button" onClick={async () => { setBusy(true); try { await deleteDoc(doc(db, "socialPosts", postId, "replies", item.id)); setItems(previous => previous.filter(r => r.id !== item.id)); onCount(-1); } catch (err) { setError(socialError(err)); } finally { setBusy(false); } }}>Delete reply</button>}</div>)}
    {loading && <p role="status">Loading replies…</p>}{!loading && !items.length && !error && <p className="social-muted">Be the first to reply.</p>}{more && <button disabled={loading} className="kh-text-button" onClick={loadMore}>Older replies</button>}
  </section>;
}
