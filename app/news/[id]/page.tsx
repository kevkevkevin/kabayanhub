// app/news/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

// 1. Import Sanitizer (Optional but recommended)
// If you don't want to install 'dompurify', you can skip this, 
// but it is safer to sanitize HTML from the DB.
// import DOMPurify from "dompurify"; 

type NewsPost = {
  title: string;
  summary: string;
  content: string; // This now contains HTML string
  imageUrl?: string;
  createdAt?: any;
  tag?: string;
  reward?: number;
  shareReward?: number;
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

  // Check claim status
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const readRef = doc(db, "users", user.uid, "activity", `news_read_${id}`);
        const shareRef = doc(db, "users", user.uid, "activity", `news_share_${id}`);
        const [readSnap, shareSnap] = await Promise.all([getDoc(readRef), getDoc(shareRef)]);
        setAlreadyClaimedRead(readSnap.exists());
        setAlreadyClaimedShare(shareSnap.exists());
      } catch (e) {
        console.error("Failed to check claim status:", e);
      }
    })();
  }, [user, id]);

  // Timer logic
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
  }, [loading, post?.title]);

  const rewardRead = post?.reward ?? 10;
  const rewardShare = post?.shareReward ?? 5;

  async function addPointsAtomic(uid: string, amount: number) {
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
    if (!id || !timerDone || alreadyClaimedRead) return;

    setClaimingRead(true);
    try {
      const activityRef = doc(db, "users", user.uid, "activity", `news_read_${id}`);
      const existing = await getDoc(activityRef);
      if (existing.exists()) {
        setAlreadyClaimedRead(true);
        setStatus("You already claimed the read reward for this post ✅");
        return;
      }
      await setDoc(activityRef, {
        type: "news_read",
        newsId: id,
        points: rewardRead,
        createdAt: serverTimestamp(),
      });
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
      openFacebookShare(shareUrl || "");
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
    <div className="space-y-6 md:space-y-8 pb-20">
      
      {/* --- UPDATED CSS FOR PERFECT TEXT WRAPPING --- */}
        <style jsx global>{`
        /* 1. Base Text Settings */
        .prose {
            color: var(--kh-text-secondary);
            font-size: 1rem;
            line-height: 1.75;
            
            /* ✨ THE FIX: */
            overflow-wrap: break-word;  /* Breaks long URLs if needed */
            word-break: normal;         /* Keeps words like "Digital" together! */
            white-space: normal;        /* standard wrapping */
        }

        /* 2. Spacing for paragraphs & headings */
        .prose p { margin-bottom: 1.5rem; }
        .prose h1, .prose h2, .prose h3, .prose h4 {
            color: var(--kh-text);
            font-weight: 700;
            margin-top: 2rem;
            margin-bottom: 0.75rem;
            line-height: 1.3;
        }
        .prose h1 { font-size: 1.75rem; }
        .prose h2 { font-size: 1.5rem; }
        .prose h3 { font-size: 1.25rem; }

        /* 3. Lists */
        .prose ul, .prose ol {
            margin-bottom: 1.5rem;
            padding-left: 1.5rem;
        }
        .prose ul { list-style-type: disc; }
        .prose ol { list-style-type: decimal; }
        .prose li { margin-bottom: 0.5rem; }

        /* 4. Table Fixes */
        .prose table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            font-size: 0.9em;
            overflow-x: auto;
            display: block;
        }
        
        @media (min-width: 640px) {
            .prose table { display: table; } 
        }

        .prose th, .prose td {
            border: 1px solid var(--kh-border);
            padding: 0.75rem 1rem;
            text-align: left;
            vertical-align: top;
        }

        .prose th {
            background-color: var(--kh-bg-subtle);
            color: var(--kh-text);
            font-weight: 700;
        }
        
        .prose td {
            background-color: transparent;
        }

        /* 5. Images & Media */
        .prose img {
            max-width: 100%;
            height: auto;
            border-radius: 1rem;
            margin: 2rem auto;
            display: block;
            box-shadow: var(--kh-card-shadow);
        }

        /* 6. Links & Quotes */
        .prose a {
            color: var(--kh-blue);
            text-decoration: underline;
            font-weight: 500;
        }
        .prose blockquote {
            border-left: 4px solid var(--kh-yellow);
            padding-left: 1rem;
            margin-left: 0;
            margin-bottom: 1.5rem;
            font-style: italic;
            color: var(--kh-text-muted);
            background: var(--kh-bg-subtle);
            padding: 1rem;
            border-radius: 0 1rem 1rem 0;
        }
        `}</style>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
        >
          ← Back
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {post.tag && (
            <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] font-semibold text-[var(--kh-text-secondary)]">
              {post.tag}
            </span>
          )}
          <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[10px] font-black text-slate-900">
            +{rewardRead} KP read
          </span>
          <span className="rounded-full bg-[var(--kh-blue-soft)]/60 px-3 py-1 text-[10px] font-semibold text-[var(--kh-blue)]">
            +{rewardShare} KP share
          </span>
        </div>
      </div>

      {/* Cover */}
      {post.imageUrl && (
        <div className="overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-[var(--kh-card-shadow)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-[220px] w-full object-cover md:h-[320px]"
          />
        </div>
      )}

      {/* Title */}
      <header className="space-y-3">
        <p className="text-[11px] text-[var(--kh-text-muted)] font-medium uppercase tracking-wide">
          Published {formatDate(post.createdAt)}
        </p>
        <h1 className="text-2xl font-bold text-[var(--kh-text)] md:text-4xl md:leading-tight">
          {post.title}
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)] md:text-base leading-relaxed border-l-4 border-[var(--kh-yellow)] pl-4 italic">
          {post.summary}
        </p>
      </header>

      {/* Status / error */}
      {status && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm flex items-center gap-2">
           <span>🎉</span> {status}
        </div>
      )}
      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
           ⚠️ {err}
        </div>
      )}

      {/* Claim row */}
      <section className="kh-card border-[var(--kh-border-strong)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold text-[var(--kh-text)]">
              Earn Kabayan Points 🧠
            </p>
            {!timerDone ? (
              <p className="text-xs text-[var(--kh-text-secondary)]">
                Reading check... please wait <span className="font-bold text-[var(--kh-blue)]">{secondsLeft}s</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-600 font-medium">
                Claim unlocked! Get your rewards below.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleClaimRead}
              disabled={!timerDone || claimingRead || alreadyClaimedRead}
              className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-black shadow-md transition-all ${
                alreadyClaimedRead
                  ? "bg-emerald-100 text-emerald-700 cursor-default"
                  : "bg-[var(--kh-yellow)] text-slate-900 hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {alreadyClaimedRead
                ? "Read Reward Claimed ✅"
                : claimingRead
                ? "Claiming..."
                : `Claim +${rewardRead} KP`}
            </button>

            <button
              onClick={handleShareFacebook}
              disabled={!timerDone || claimingShare}
              className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-xs font-bold transition-all ${
                 alreadyClaimedShare
                  ? "bg-blue-50 border-blue-100 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 active:scale-95 disabled:opacity-50"
              }`}
            >
              {alreadyClaimedShare
                ? "Shared on FB ✅"
                : claimingShare
                ? "Sharing..."
                : `Share to FB (+${rewardShare} KP)`}
            </button>
          </div>
        </div>
      </section>

      {/* Article content (HTML) */}
      <article className="kh-card min-h-[300px]">
        {/* This is the key fix: 
           dangerouslySetInnerHTML renders the HTML string directly.
           The 'prose' class applies the custom styles we defined above.
        */}
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }} 
        />
      </article>

    </div>
  );
}