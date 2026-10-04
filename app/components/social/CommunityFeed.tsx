"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect,useState,type FormEvent } from "react";
import { auth,db } from "../../../lib/backend";
import { onAuthStateChanged,type User } from "../../../lib/backend/auth";
import { addDoc,collection,deleteDoc,doc,documentId,getDoc,getDocs,limit,onSnapshot,orderBy,query,serverTimestamp,setDoc,startAfter,where,type QueryConstraint,type Timestamp } from "../../../lib/backend/db";
import { POST_LIMIT,profileLink,socialError,type SocialPost } from "../../../lib/social";
import Icon from "../Icon";
import Moderation from "./Moderation";
import PostCard from "./PostCard";
import { Avatar,useSocialProfile } from "./Profile";

export default function CommunityFeed() {
  const params = useSearchParams();
  const member = params.get("member") || "";
  const singlePost = params.get("post") || "";
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { profile, loaded: profileLoaded } = useSocialProfile(user?.uid);
  const [following, setFollowing] = useState<string[]>([]);
  const [followReady, setFollowReady] = useState(false);
  const [tab, setTab] = useState("everyone");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setAuthReady(true); setFollowing([]); setFollowReady(!next); setText(""); }), []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "socialProfiles", user.uid, "following"), snap => { setFollowing(snap.docs.map(d => d.id).sort()); setFollowReady(true); }, err => { setError(socialError(err)); setFollowReady(true); });
  }, [user]);
  async function follow(target: string) {
    if (!user || target === user.uid) return;
    if (!profile) throw new Error("Set up your community profile from your dashboard first.");
    const reference = doc(db, "socialProfiles", user.uid, "following", target);
    if (following.includes(target)) await deleteDoc(reference);
    else await setDoc(reference, { createdAt: serverTimestamp() });
  }
  async function post(event: FormEvent) {
    event.preventDefault();
    if (!user || !profile || !text.trim() || busy) return;
    setBusy(true); setError("");
    try { await addDoc(collection(db, "socialPosts"), { uid: user.uid, text: text.trim(), createdAt: serverTimestamp() }); setText(""); setRefresh(value => value + 1); }
    catch (err) { setError(socialError(err)); } finally { setBusy(false); }
  }
  const canPost = !!user && !!profile;
  return <div className="social-layout">
    <aside className="social-sidebar">
      <Link href="/community" className="social-wordmark"><span className="kh-flag-mark" />The community<span className="social-wordmark-dot">.</span></Link>
      <p className="social-muted">A little closer to home.</p>
      <nav aria-label="Community navigation"><Link className={!member && !singlePost ? "is-active" : ""} href="/community"><Icon name="home" />Community feed</Link>{user && <Link className={member === user.uid ? "is-active" : ""} href={profileLink(user.uid)}><Icon name="users" />My profile</Link>}<Link href="/dashboard#social-profile"><Icon name="settings" />Edit my profile</Link><Link href="/tambayan"><Icon name="chat" />Live Tambayan</Link></nav>
      {profile && <div className="social-self"><Avatar profile={profile} /><strong>{profile.displayName}</strong><small>@{profile.username}</small><p>{profile.bio || "Your people are here."}</p></div>}
      <div className="social-sidebar-note"><span>🇵🇭</span><strong>One community.<br />A thousand stories.</strong><p>Share a thought. Say hello.<br />Make someone feel at home.</p></div>
    </aside>
    <section className="social-feed" aria-label="Community feed">
      <header className="social-feed-header"><div><p className="kh-eyebrow">KABAYAN HUB / COMMUNITY</p><h1>{member ? "Community profile" : singlePost ? "The conversation" : "Anong kwento mo?"}</h1><p>{member ? "Get to know the person behind the posts." : "Everyday thoughts. Familiar faces. Your kind of people."}</p></div><button className="kh-icon-button" aria-label="Refresh feed" onClick={() => { setError(""); setRefresh(value => value + 1); }}><Icon name="refresh" /></button></header>
      {member && <MemberProfile key={member} uid={member} own={member === user?.uid} signedIn={!!user} following={following.includes(member)} onFollow={() => follow(member)} />}
      {!member && !singlePost && <>
        <div className="social-tabs" role="group" aria-label="Feed filter"><button aria-pressed={tab === "everyone"} onClick={() => setTab("everyone")}>Everyone</button><button aria-pressed={tab === "following"} onClick={() => setTab("following")}>Following</button></div>
        <div className="social-composer">
          {!authReady || (user && !profileLoaded) ? <p role="status">Getting your profile ready…</p> : canPost ? <form onSubmit={post}><div className="social-composer-top"><Avatar profile={profile} /><label className="sr-only" htmlFor="new-social-post">Write a post</label><textarea id="new-social-post" placeholder="Anong kwento mo, Kabayan?" rows={3} maxLength={POST_LIMIT} value={text} onChange={e => setText(e.target.value)} /></div><div className="social-composer-bottom"><span><Icon name="globe" width={14} />Public post</span><small>{text.length}/{POST_LIMIT}</small><button className="kh-button kh-button-primary" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post"}<Icon name="arrow" width={16} /></button></div></form> : <div className="social-welcome"><strong>{user ? "Let’s put a face to your stories." : "There’s a place for you here."}</strong><p>{user ? "Choose your username and add a photo or bio to start posting." : "Log in to post, reply, like, and follow fellow Kabayans."}</p><Link className="kh-button kh-button-primary" href={user ? "/dashboard#social-profile" : "/login"}>{user ? "Set up my profile" : "Join the conversation"}<Icon name="arrow" width={16} /></Link></div>}
        </div>
      </>}
      {error && <p role="alert" className="social-error">{error}</p>}
      {tab === "following" && !member && !singlePost && !user ? <div className="social-empty"><h2>Your people, in one place.</h2><p><Link href="/login">Log in</Link> to follow people and see their posts here.</p></div> : !authReady || (user && tab === "following" && !followReady) ? <p className="social-loading" role="status">Loading the feed…</p> : <FeedList key={`${user?.uid || "guest"}:${member}:${singlePost}:${tab}:${refresh}:${tab === "following" ? following.join(",") : ""}`} member={member} singlePost={singlePost} filter={tab} uid={user?.uid} canPost={canPost} following={following} onFollow={follow} />}
    </section>
    <aside className="social-right"><div className="kh-card"><p className="kh-eyebrow">GOOD COMPANY</p><h2>Small moments.<br />Real connections.</h2><p>A first day at work. A taste of home. Something that made you smile. There’s room for all of it here.</p><Link href="/baybayin-card" className="kh-inline-link">Make a Baybayin card <Icon name="arrow" width={14} /></Link></div><div className="kh-card social-ground-rules"><strong>Keep it a good place to be.</strong><p>Be respectful. Protect personal details. Report spam, scams, or harassment.</p><span>Malayo man, magkakasama.</span></div>{user && <Moderation uid={user.uid} />}</aside>
  </div>;
}

function MemberProfile({ uid, own, signedIn, following, onFollow }: { uid: string; own: boolean; signedIn: boolean; following: boolean; onFollow: () => Promise<void> }) {
  const { profile, loaded, error: loadError } = useSocialProfile(uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="social-member">{!loaded ? <p role="status">Loading profile…</p> : !profile ? <p>{loadError ? "This profile couldn’t load. Please try again." : "This member hasn’t published a community profile yet."}</p> : <><div className="social-member-top"><Avatar profile={profile} large />{own ? <Link className="kh-button kh-button-secondary" href="/dashboard#social-profile">Edit profile</Link> : signedIn && <button disabled={busy} aria-pressed={following} className="kh-button kh-button-primary" onClick={async () => { setBusy(true); setError(""); try { await onFollow(); } catch (err) { setError(socialError(err)); } finally { setBusy(false); } }}>{following ? "Following" : "Follow"}</button>}</div><h2>{profile.displayName}</h2><span>@{profile.username}</span><p>{profile.bio}</p></>}{error && <p role="alert" className="social-error">{error}</p>}</div>;
}

function FeedList({ member, singlePost, filter, uid, canPost, following, onFollow }: { member: string; singlePost: string; filter: string; uid?: string; canPost: boolean; following: string[]; onFollow: (uid: string) => Promise<void> }) {
  const [items, setItems] = useState<SocialPost[]>([]);
  const [cursor, setCursor] = useState<{ createdAt: Timestamp; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  // Follow filters use server queries in groups of 30, then merge by the same
  // timestamp/id cursor. Older matching posts aren't lost between groups.
  async function fetchPage(after: typeof cursor) {
    if (singlePost) { const snap = await getDoc(doc(db, "socialPosts", singlePost)); return snap.exists() ? [{ id: snap.id, ...snap.data() } as SocialPost] : []; }
    const groups: (string[] | null)[] = [];
    if (member) groups.push([member]);
    else if (filter === "following") { for (let i = 0; i < following.length; i += 30) groups.push(following.slice(i, i + 30)); }
    else groups.push(null);
    const pages = await Promise.all(groups.map(async ids => {
      const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), orderBy(documentId(), "desc")];
      if (ids) constraints.unshift(where("uid", "in", ids));
      if (after) constraints.push(startAfter(after.createdAt, after.id));
      constraints.push(limit(20));
      const snap = await getDocs(query(collection(db, "socialPosts"), ...constraints));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
    }));
    return pages.flat().sort((a, b) => {
      const seconds = (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      const nanos = (b.createdAt?.nanoseconds || 0) - (a.createdAt?.nanoseconds || 0);
      return seconds || nanos || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
    }).slice(0, 20);
  }
  useEffect(() => {
    let active = true;
    fetchPage(null).then(page => { if (active) { setItems(page); const last = page.at(-1); setCursor(last?.createdAt ? { id: last.id, createdAt: last.createdAt } : null); setMore(!singlePost && page.length === 20); } }).catch(err => { if (active) setError(socialError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // The parent keys this component by every query input, including follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function loadMore() {
    setLoading(true); setError("");
    try { const page = await fetchPage(cursor); setItems(previous => [...previous, ...page.filter(item => !previous.some(existing => existing.id === item.id))]); const last = page.at(-1); setCursor(last?.createdAt ? { id: last.id, createdAt: last.createdAt } : null); setMore(page.length === 20); }
    catch (err) { setError(socialError(err)); } finally { setLoading(false); }
  }
  return <>{items.map(post => <PostCard key={post.id} post={post} uid={uid} canPost={canPost} following={following.includes(post.uid)} onFollow={onFollow} onDelete={id => setItems(previous => previous.filter(item => item.id !== id))} />)}{loading && <p role="status" className="social-loading">Loading posts…</p>}{error && <div className="social-empty"><p role="alert" className="social-error">{error}</p><p>Use Refresh feed to try again.</p></div>}{!loading && !error && !items.length && <div className="social-empty"><span className="social-empty-icon"><Icon name="chat" width={32} height={32} /></span><h2>{singlePost ? "This post is no longer here." : filter === "following" && !member ? "Find your familiar faces." : member ? "The story starts here." : "Someone has to say hello first."}</h2><p>{singlePost ? "It may have been deleted by its author or the community team." : filter === "following" && !member ? "Follow someone from the Everyone feed. Their posts will appear here." : member ? "No posts yet. Check back for their first hello." : "Share a thought, a small win, or just a good morning. This space is yours."}</p>{singlePost && <Link href="/community" className="kh-inline-link">Back to the community</Link>}</div>}{more && <button disabled={loading} className="social-load-more" onClick={loadMore}>Load more posts</button>}</>;
}
