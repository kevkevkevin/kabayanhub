// app/videos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { db, auth } from "../../lib/firebase";

type VideoItem = {
  id: string;
  title: string;
  tag?: string;
  description?: string;
  youtubeId?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  reward?: number;
  shareReward?: number;
};

function extractYoutubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const pathParts = u.pathname.split("/");
      const last = pathParts[pathParts.length - 1];
      return last || null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function VideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
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
    const fetchVideos = async () => {
      try {
        const ref = collection(db, "videos");
        const q = query(ref, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const items: VideoItem[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const rawYoutubeId = d.youtubeId || d.videoId || null;
          const rawUrl = d.url || d.videoUrl || null;
          const finalId = rawYoutubeId || extractYoutubeIdFromUrl(rawUrl);
          const thumb =
            d.thumbnailUrl ||
            (finalId
              ? `https://img.youtube.com/vi/${finalId}/hqdefault.jpg`
              : null);

          items.push({
            id: docSnap.id,
            title: d.title,
            tag: d.tag,
            description: d.description,
            youtubeId: finalId,
            url: rawUrl,
            thumbnailUrl: thumb,
            reward: d.reward ?? 15,
            shareReward: d.shareReward ?? 5,
          });
        });

        setVideos(items);
      } catch (err) {
        console.error("Failed to load videos:", err);
        setStatus("Failed to load tutorials. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Watching progress: when modal opens, start a timed progress (e.g. 12s)
  useEffect(() => {
    if (!showModal || !selectedVideo) {
      setProgress(0);
      setProgressComplete(false);
      return;
    }

    setProgress(0);
    setProgressComplete(false);

    const duration = 12000; // 12 seconds
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
  }, [showModal, selectedVideo?.id]);

  const ensureLoggedIn = () => {
    if (!user) {
      setStatus("Log in to earn Kabayan Points from tutorials.");
      router.push("/login");
      return false;
    }
    return true;
  };

  const givePointsForVideo = async (
    item: VideoItem,
    type: "video_watched" | "video_share",
    amount: number
  ) => {
    if (!ensureLoggedIn() || !user) return;

    setStatus(null);

    try {
      const userRef = doc(db, "users", user.uid);

      const activityRef = collection(db, "users", user.uid, "activity");
      const q = query(
        activityRef,
        where("type", "==", type),
        where("refId", "==", item.id)
      );
      const activitySnap = await getDocs(q);

      if (!activitySnap.empty) {
        setStatus("You already claimed KP for this tutorial.");
        return;
      }

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
          type === "video_watched"
            ? "watching this tutorial"
            : "sharing this tutorial"
        }!`
      );
    } catch (err) {
      console.error("Failed to give points:", err);
      setStatus("Failed to give points. Please try again.");
    }
  };

  const handleClaimWatch = async () => {
    if (!selectedVideo) return;
    if (!progressComplete) return;
    setClaimLoading(true);
    await givePointsForVideo(
      selectedVideo,
      "video_watched",
      selectedVideo.reward ?? 15
    );
    setClaimLoading(false);
  };

  const handleShare = async (item: VideoItem) => {
    await givePointsForVideo(item, "video_share", item.shareReward ?? 5);

    try {
      const url =
        item.url ||
        (item.youtubeId
          ? `https://www.youtube.com/watch?v=${item.youtubeId}`
          : typeof window !== "undefined"
          ? window.location.href
          : undefined);

      const text = `Kabayan tutorial: ${item.title} 🇵🇭`;

      if (navigator.share && url) {
        await navigator.share({
          title: item.title,
          text,
          url,
        });
      } else if (url) {
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}&url=${encodeURIComponent(url)}`;
        window.open(shareUrl, "_blank");
      }
    } catch (err) {
      console.log("Share cancelled or failed", err);
    }
  };

  const openModal = (item: VideoItem) => {
    setSelectedVideo(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedVideo(null);
  };

  const selectedEmbedUrl = useMemo(() => {
    if (!selectedVideo) return null;
    const id = selectedVideo.youtubeId;
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  }, [selectedVideo]);

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          Learn &amp; Tutorials
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Short, practical videos about earning online, managing money, and
          building skills as an OFW in Saudi. Watch, apply, and earn Kabayan
          Points.
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
          Loading tutorials…
        </p>
      )}

      {!loading && videos.length === 0 && (
        <p className="text-sm text-[var(--kh-text-secondary)]">
          No tutorials yet. Check again later or add items in the admin panel.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {videos.map((item) => (
          <article
            key={item.id}
            className="flex flex-col justify-between rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]"
          >
            <div className="space-y-2">
              {item.thumbnailUrl && (
                <div className="mb-2 h-40 w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                  <img
                    src={item.thumbnailUrl}
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
              {item.description && (
                <p className="text-xs text-[var(--kh-text-secondary)] md:text-sm">
                  {item.description}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kh-bg-subtle)] px-2 py-1 text-[10px] text-[var(--kh-text-muted)]">
                  🎥 Watch:{" "}
                  <span className="font-semibold text-[var(--kh-yellow)]">
                    +{item.reward ?? 15} KP
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
                  Watch tutorial
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
        ))}
      </div>

      {/* Modal */}
      {showModal && selectedVideo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[var(--kh-border-strong)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
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
                <span>Watching progress</span>
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
                  Stay on this tutorial to unlock your Kabayan Points.
                </p>
              )}
            </div>

            {/* Video + info */}
            <div className="space-y-3">
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                {selectedEmbedUrl ? (
                  <iframe
                    src={selectedEmbedUrl}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--kh-text-muted)]">
                    No YouTube ID or URL for this video.
                  </div>
                )}
              </div>

              <div className="space-y-1 pr-6 text-xs md:text-sm">
                {selectedVideo.tag && (
                  <span className="inline-flex rounded-full bg-[var(--kh-blue-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--kh-blue)]">
                    {selectedVideo.tag}
                  </span>
                )}
                <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
                  {selectedVideo.title}
                </h2>
                {selectedVideo.description && (
                  <p className="text-[var(--kh-text-secondary)]">
                    {selectedVideo.description}
                  </p>
                )}
              </div>
            </div>

            {/* Claim button */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <p className="text-[var(--kh-text-secondary)]">
                Reward:{" "}
                <span className="font-semibold text-[var(--kh-yellow)]">
                  +{selectedVideo.reward ?? 15} KP
                </span>{" "}
                for watching this tutorial.
              </p>
              <button
                onClick={handleClaimWatch}
                disabled={!progressComplete || claimLoading}
                className="rounded-full bg-[var(--kh-yellow)] px-4 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm shadow-yellow-400/40 disabled:opacity-60"
              >
                {claimLoading
                  ? "Claiming…"
                  : progressComplete
                  ? "Claim KP for watching"
                  : "Keep watching…"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
