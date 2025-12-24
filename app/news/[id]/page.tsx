// app/news/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type NewsPost = {
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  createdAt?: any;
  tag?: string;
  reward?: number; // points for reading
  shareReward?: number; // points for share
};

function formatDate(value: any) {
  try {
    let d: Date | null = null;

    if (!value) return "";
    if (value instanceof Date) d = value;
    else if (value instanceof Timestamp) d = value.toDate();
    else if (typeof value?.toDate === "function") d = value.toDate();
    else if (typeof value === "string") d = new Date(value);

    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

function splitParagraphs(text: string) {
  // Split by blank lines for nicer reading
  return text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function NewsDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<NewsPost | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // KP system states
  const [secondsLeft, setSecondsLeft] = useState(7);
  const [timerDone, setTimerDone] = useState(false);

  const [claimingRead, setClaimingRead] = useState(false);
  const [claimingShare, setClaimingShare] = useState(false);

  const [alreadyClaimedRead, setAlreadyClaimedRead] = useState(false);
  const [alreadyClaimedShare, setAlreadyClaimedShare] = useState(false);

  const [status, setStatus] = useState<string | null>(null);

  // For FB share URL (avoid hydration mismatch)
  const [shareUrl, setShareUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Load post
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const ref = doc(db, "news", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErr("News post not found.");
          setPost(null);
          return;
        }

        const data = snap.data() as any;
        setPost({
          title: data.title || "",
          summary: data.summary || "",
          content: data.content || "",
          imageUrl: data.imageUrl || "",
          createdAt: data.createdAt,
          tag: data.tag || "",
          reward: typeof data.reward === "number" ? data.reward : 10,
          shareReward: typeof data.shareReward === "number" ? data.shareReward : 5,
        });
      } catch (e) {
        console.error(e);
        setErr("Failed to load article. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Check if already claimed read/share (per user per post)
  useEffect(() => {
    if (!user || !id) return;

    (async () => {
      try {
        // activity docs: users/{uid}/activity/news_read_{newsId}, news_share_{newsId}
        const readRef = doc(db, "users", user.uid, "activity", `news_read_${id}`);
        const shareRef = doc(db, "users", user.uid, "activity", `news_share_${id}`);

        const [readSnap, shareSnap] = await Promise.all([getDoc(readRef), getDoc(shareRef)]);

        setAlreadyClaimedRead(readSnap.exists());
        setAlreadyClaimedShare(shareSnap.exists());
      } catch (e) {
        console.error("Failed to check claim status:", e);
        // don’t block UI
      }
    })();
  }, [user, id]);

  // 7-second timer (starts when post is loaded)
  useEffect(() => {
    if (loading) return;
    if (!post) return;

    setSecondsLeft(7);
    setTimerDone(false);

    let t = 7;
    const interval = setInterval(() => {
      t -= 1;
      setSecondsLeft(t);
      if (t <= 0) {
        setTimerDone(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, post?.title]); // restart when new post loads

  const rewardRead = post?.reward ?? 10;
  const rewardShare = post?.shareReward ?? 5;

  const paragraphs = useMemo(() => splitParagraphs(post?.content || ""), [post?.content]);

  async function addPointsAtomic(uid: string, amount: number) {
    // Atomic increment on user doc via transaction
    await runTransaction(db, async (tx) => {
      const uref = doc(db, "users", uid);
      const usnap = await tx.get(uref);
      const current = usnap.exists() ? (usnap.data() as any).points || 0 : 0;
      tx.update(uref, {
        points: Number(current) + Number(amount),
        lastVisit: serverTimestamp(),
      });
    });
  }

  async function handleClaimRead() {
    setStatus(null);
    setErr(null);

    if (!user) {
      setErr("Please log in to claim points.");
      router.push("/login");
      return;
    }
    if (!id) return;

    if (!timerDone) return;
    if (alreadyClaimedRead) return;

    setClaimingRead(true);
    try {
      const activityRef = doc(db, "users", user.uid, "activity", `news_read_${id}`);

      // Double-check on server (prevents double claim)
      const existing = await getDoc(activityRef);
      if (existing.exists()) {
        setAlreadyClaimedRead(true);
        setStatus("You already claimed the read reward for this post ✅");
        return;
      }

      // 1) Mark activity
      await setDoc(activityRef, {
        type: "news_read",
        newsId: id,
        points: rewardRead,
        createdAt: serverTimestamp(),
      });

      // 2) Add points
      await addPointsAtomic(user.uid, rewardRead);

      setAlreadyClaimedRead(true);
      setStatus(`+${rewardRead} KP claimed for reading! Galing mo Kabayan 🏆`);
    } catch (e) {
      console.error(e);
      setErr("Failed to claim points. Please try again.");
    } finally {
      setClaimingRead(false);
    }
  }

  function openFacebookShare(url: string) {
    const share = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(share, "_blank", "noopener,noreferrer,width=700,height=600");
  }

  async function handleShareFacebook() {
    setStatus(null);
    setErr(null);

    if (!user) {
      setErr("Please log in to earn share points.");
      router.push("/login");
      return;
    }
    if (!id) return;

    // We reward on click (we can’t truly verify FB share completion)
    if (alreadyClaimedShare) {
      openFacebookShare(shareUrl || "");
      return;
    }

    setClaimingShare(true);
    try {
      const activityRef = doc(db, "users", user.uid, "activity", `news_share_${id}`);

      const existing = await getDoc(activityRef);
      if (existing.exists()) {
        setAlreadyClaimedShare(true);
        openFacebookShare(shareUrl || "");
        setStatus("Share reward already claimed ✅");
        return;
      }

      // 1) Open share popup
      openFacebookShare(shareUrl || "");

      // 2) Save activity + points
      await setDoc(activityRef, {
        type: "news_share",
        newsId: id,
        platform: "facebook",
        points: rewardShare,
        createdAt: serverTimestamp(),
      });

      await addPointsAtomic(user.uid, rewardShare);

      setAlreadyClaimedShare(true);
      setStatus(`+${rewardShare} KP earned for sharing on Facebook! Salamat Kabayan 🇵🇭`);
    } catch (e) {
      console.error(e);
      setErr("Failed to reward share. Please try again.");
    } finally {
      setClaimingShare(false);
    }
  }

  if (loading) {
    return (
      <div className="kh-card">
        <p className="text-sm text-[var(--kh-text-secondary)]">Loading article…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="kh-card">
        <p className="text-sm text-red-600">{err}</p>
        <div className="mt-3">
          <Link href="/news" className="text-sm font-semibold text-[var(--kh-blue)] hover:underline">
            ← Back to News
          </Link>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
        >
          ← Back
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {post.tag ? (
            <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] font-semibold text-[var(--kh-text-secondary)]">
              {post.tag}
            </span>
          ) : null}

          <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[10px] font-black text-slate-900">
            +{rewardRead} KP read
          </span>

          <span className="rounded-full bg-[var(--kh-blue-soft)]/60 px-3 py-1 text-[10px] font-semibold text-[var(--kh-blue)]">
            +{rewardShare} KP share
          </span>
        </div>
      </div>

      {/* Cover */}
      {post.imageUrl ? (
        <div className="overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-[var(--kh-card-shadow)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-[220px] w-full object-cover md:h-[320px]"
          />
        </div>
      ) : null}

      {/* Title */}
      <header className="space-y-2">
        <p className="text-[11px] text-[var(--kh-text-muted)]">
          {formatDate(post.createdAt)}
        </p>
        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-4xl">
          {post.title}
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)] md:text-base">
          {post.summary}
        </p>
      </header>

      {/* Status / error */}
      {status && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {status}
        </p>
      )}
      {err && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </p>
      )}

      {/* Claim row */}
      <section className="kh-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--kh-text)]">
              Earn Kabayan Points from reading 🧠
            </p>
            {!timerDone ? (
              <p className="text-xs text-[var(--kh-text-secondary)]">
                Stay on this page for{" "}
                <span className="font-bold">{secondsLeft}s</span> to unlock the claim button.
              </p>
            ) : (
              <p className="text-xs text-[var(--kh-text-secondary)]">
                Claim is unlocked. You can claim read points + optionally share for extra KP.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClaimRead}
              disabled={!timerDone || claimingRead || alreadyClaimedRead}
              className="inline-flex items-center justify-center rounded-full bg-[var(--kh-yellow)] px-5 py-2.5 text-xs font-black text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105 disabled:opacity-60"
            >
              {alreadyClaimedRead
                ? "Read KP claimed ✅"
                : claimingRead
                ? "Claiming…"
                : `Claim +${rewardRead} KP`}
            </button>

            <button
              onClick={handleShareFacebook}
              disabled={!timerDone || claimingShare}
              className="inline-flex items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)] disabled:opacity-60"
            >
              {alreadyClaimedShare
                ? "Share again (FB) ↗"
                : claimingShare
                ? "Sharing…"
                : `Share on Facebook (+${rewardShare} KP)`}
            </button>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--kh-text-muted)]">
          Note: Facebook share reward is granted when you click Share (we can’t perfectly verify completion).
        </p>
      </section>

      {/* Article content */}
      <article className="kh-card">
        <div className="space-y-4 text-sm text-[var(--kh-text-secondary)] md:text-base">
          {paragraphs.map((p, idx) => (
            <p key={idx} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
