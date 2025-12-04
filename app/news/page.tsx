// app/news/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  where,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import { db, auth } from "../../lib/firebase";

type NewsItem = {
  id: string;
  title: string;
  tag?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  reward?: number;
  shareReward?: number;
};

export default function NewsPage() {
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const data = snap.data() as any;
        setPoints(data?.points ?? 0);
      } else {
        setPoints(null);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const ref = collection(db, "news");
        const q = query(ref, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const items: NewsItem[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          items.push({
            id: docSnap.id,
            title: d.title,
            tag: d.tag,
            summary: d.summary,
            content: d.content,
            imageUrl: d.imageUrl || null,
            reward: d.reward ?? 10,
            shareReward: d.shareReward ?? 5,
          });
        });

        setNews(items);
      } catch (err) {
        console.error("Failed to load news:", err);
        setStatus("Failed to load news. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Reading progress: when modal opens, start an 8s progress
  useEffect(() => {
    if (!showModal || !selectedNews) {
      setProgress(0);
      setProgressComplete(false);
      return;
    }

    setProgress(0);
    setProgressComplete(false);

    const duration = 8000; // 8 seconds
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct < 100) {
        frame = requestAnimationFrame(tick);
      } else {
        setProgressComplete(true);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [showModal, selectedNews?.id]);

  const ensureLoggedIn = () => {
    if (!user) {
      setStatus("Log in to earn Kabayan Points from news.");
      router.push("/login");
      return false;
    }
    return true;
  };

  // Generic helper to give KP & log activity (only once per news item per type)
  const givePointsForNews = async (
    item: NewsItem,
    type: "news_read" | "news_share",
    amount: number
  ) => {
    if (!ensureLoggedIn() || !user) return;

    setStatus(null);

    try {
      const userRef = doc(db, "users", user.uid);

      // Check if already claimed for this news + type
      const activityRef = collection(db, "users", user.uid, "activity");
      const q = query(
        activityRef,
        where("type", "==", type),
        where("refId", "==", item.id)
      );
      const activitySnap = await getDocs(q);

      if (!activitySnap.empty) {
        setStatus("You already claimed KP for this news.");
        return;
      }

      // Get current points
      const userSnap = await getDoc(userRef);
      const currentPoints = (userSnap.data() as any)?.points ?? 0;

      await Promise.all([
        addDoc(activityRef, {
          type,
          refId: item.id,
          amount,
          createdAt: serverTimestamp(),
        }),
        updateDoc(userRef, {
          points: increment(amount),
          lastVisit: serverTimestamp(),
        }),
      ]);

      setPoints(currentPoints + amount);
      setStatus(
        `+${amount} KP from ${
          type === "news_read" ? "reading this article" : "sharing this news"
        }!`
      );
    } catch (err) {
      console.error("Failed to give points:", err);
      setStatus("Failed to give points. Please try again.");
    }
  };

  const handleClaimRead = async () => {
    if (!selectedNews) return;
    if (!progressComplete) return;
    setClaimLoading(true);
    await givePointsForNews(
      selectedNews,
      "news_read",
      selectedNews.reward ?? 10
    );
    setClaimLoading(false);
  };

  const handleShare = async (item: NewsItem) => {
    await givePointsForNews(item, "news_share", item.shareReward ?? 5);

    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/news`
          : "https://kabayanhub.app/news";

      const text = `Kabayan news for OFWs in Saudi: ${item.title} 🇸🇦🇵🇭`;

      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text,
          url,
        });
      } else {
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}&url=${encodeURIComponent(url)}`;
        window.open(shareUrl, "_blank");
      }
    } catch (err) {
      console.log("Share cancelled or failed", err);
    }
  };

  const openModal = (item: NewsItem) => {
    setSelectedNews(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedNews(null);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          News &amp; Updates
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Curated news and reminders for Kabayans in Saudi Arabia. Read to stay
          updated, and earn Kabayan Points along the way.
        </p>

        {points !== null && (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-3 py-1 text-[11px]">
            <span className="text-[var(--kh-text-muted)]">Your balance:</span>
            <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[11px] font-semibold text-slate-900">
              {points} KP
            </span>
          </div>
        )}
      </header>

      {status && (
        <p className="text-[11px] text-emerald-600 md:text-xs">{status}</p>
      )}

      {loading && (
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Loading news…
        </p>
      )}

      {!loading && news.length === 0 && (
        <p className="text-sm text-[var(--kh-text-secondary)]">
          No news yet. Check again later or add items in the admin panel.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {news.map((item) => {
          const preview =
            item.summary ||
            (item.content ? item.content.slice(0, 140) + "..." : "");

          return (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]"
            >
              <div className="space-y-2">
                {item.imageUrl && (
                  <div className="mb-2 h-32 w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {item.tag && (
                  <span className="inline-flex rounded-full bg-[var(--kh-blue-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--kh-blue)]">
                    {item.tag}
                  </span>
                )}
                <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
                  {item.title}
                </h2>
                {preview && (
                  <p className="text-xs text-[var(--kh-text-secondary)] md:text-sm">
                    {preview}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kh-bg-subtle)] px-2 py-1 text-[10px] text-[var(--kh-text-muted)]">
                    🧠 Read:{" "}
                    <span className="font-semibold text-[var(--kh-yellow)]">
                      +{item.reward ?? 10} KP
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kh-bg-subtle)] px-2 py-1 text-[10px] text-[var(--kh-text-muted)]">
                    📤 Share:{" "}
                    <span className="font-semibold text-[#F97373]">
                      +{item.shareReward ?? 5} KP
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openModal(item)}
                    className="rounded-full bg-[var(--kh-blue)] px-3 py-1 text-[11px] font-semibold text-white hover:brightness-110 transition"
                  >
                    Read article
                  </button>
                  <button
                    onClick={() => handleShare(item)}
                    className="rounded-full border border-[var(--kh-border)] px-3 py-1 text-[11px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-subtle)] hover:text-[var(--kh-text)] transition"
                  >
                    Share &amp; earn
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && selectedNews && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-200 rounded-2xl border border-[var(--kh-border-strong)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-2 py-1 text-[11px] text-[var(--kh-text-muted)] hover:bg-[var(--kh-bg-card)]"
            >
              ✕
            </button>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--kh-text-muted)]">
                <span>Reading progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--kh-bg-subtle)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {!progressComplete && (
                <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                  Stay on this article to unlock your Kabayan Points.
                </p>
              )}
            </div>

            {/* Content */}
            <div className="space-y-3">
              {selectedNews.imageUrl && (
                <div className="mb-2 h-50 w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                  <img
                    src={selectedNews.imageUrl}
                    alt={selectedNews.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {selectedNews.tag && (
                <span className="inline-flex rounded-full bg-[var(--kh-blue-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--kh-blue)]">
                  {selectedNews.tag}
                </span>
              )}
              <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
                {selectedNews.title}
              </h2>

              <div className="mt-2 max-h-[260px] overflow-y-auto text-xs text-[var(--kh-text-secondary)] md:text-sm">
                {selectedNews.content ? (
                  <div className="space-y-2">
                    <ReactMarkdown>{selectedNews.content}</ReactMarkdown>
                  </div>
                ) : selectedNews.summary ? (
                  <p>{selectedNews.summary}</p>
                ) : (
                  <p>No content provided for this article.</p>
                )}
              </div>
            </div>

            {/* Claim button */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <p className="text-[var(--kh-text-secondary)]">
                Reward:{" "}
                <span className="font-semibold text-[var(--kh-yellow)]">
                  +{selectedNews.reward ?? 10} KP
                </span>{" "}
                for reading this article.
              </p>
              <button
                onClick={handleClaimRead}
                disabled={!progressComplete || claimLoading}
                className="rounded-full bg-[var(--kh-yellow)] px-4 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm shadow-yellow-400/40 disabled:opacity-60"
              >
                {claimLoading
                  ? "Claiming…"
                  : progressComplete
                  ? "Claim KP for reading"
                  : "Keep reading…"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
