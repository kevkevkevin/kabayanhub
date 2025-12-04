"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type Tab = "news" | "videos" | "marketplace" | "purchases";

type NewsItem = {
  id: string;
  title: string;
  tag?: string;
  summary?: string;
  content?: string;
  imageUrl?: string | null;
  reward?: number;
  shareReward?: number;
};

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

type MarketplaceItem = {
  id: string;
  title: string;
  tag?: string;
  description?: string;
  imageUrl?: string | null;
  price: number;
  stock?: number | null;
};

type PurchaseRecord = {
  id: string;
  itemId: string;
  itemTitle: string;
  userId: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  price?: number;
  createdAt?: any;
  status?: "pending" | "redeemed";
};

export default function AdminPage() {
  const router = useRouter();

  // Admin access guard
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("news");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Data lists
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [marketItems, setMarketItems] = useState<MarketplaceItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  // Editing state
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);

  // For marking purchase redeemed
  const [updatingPurchaseId, setUpdatingPurchaseId] = useState<string | null>(
    null
  );

  // Forms
  const [newsForm, setNewsForm] = useState({
    title: "",
    tag: "",
    summary: "",
    content: "",
    imageUrl: "",
    reward: "10",
    shareReward: "5",
  });

  const [videoForm, setVideoForm] = useState({
    title: "",
    tag: "",
    description: "",
    youtubeId: "",
    url: "",
    thumbnailUrl: "",
    reward: "15",
    shareReward: "5",
  });

  const [marketForm, setMarketForm] = useState({
    title: "",
    tag: "",
    description: "",
    imageUrl: "",
    price: "50",
    stock: "10",
  });

  /* ───────────── Admin access check ───────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAccessError("You must be logged in to view the admin panel.");
        setLoadingUser(false);
        router.push("/login");
        return;
      }

      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setAccessError("Your account is not configured for admin access.");
          setLoadingUser(false);
          return;
        }

        const data = snap.data() as any;

        if (data.role !== "admin") {
          setAccessError(
            "You do not have admin access. If you think this is a mistake, contact the Kabayan Hub team."
          );
          setLoadingUser(false);
          return;
        }

        setUser({ ...u, role: data.role });
        setLoadingUser(false);
      } catch (err) {
        console.error("Failed to verify admin role:", err);
        setAccessError("Failed to verify admin access.");
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, [router]);

  /* ───────────── Load admin data ───────────── */
  useEffect(() => {
    if (!user) return;

    const loadAll = async () => {
      try {
        setError(null);

        const [newsSnap, videoSnap, marketSnap, purchaseSnap] =
          await Promise.all([
            getDocs(
              query(
                collection(db, "news"),
                orderBy("createdAt", "desc"),
                limit(50)
              )
            ),
            getDocs(
              query(
                collection(db, "videos"),
                orderBy("createdAt", "desc"),
                limit(50)
              )
            ),
            getDocs(
              query(
                collection(db, "marketplaceItems"),
                orderBy("createdAt", "desc"),
                limit(50)
              )
            ),
            getDocs(
              query(
                collection(db, "marketplacePurchases"),
                orderBy("createdAt", "desc"),
                limit(200)
              )
            ),
          ]);

        const n: NewsItem[] = [];
        newsSnap.forEach((d) => {
          const data = d.data() as any;
          n.push({
            id: d.id,
            title: data.title,
            tag: data.tag,
            summary: data.summary,
            content: data.content,
            imageUrl: data.imageUrl || null,
            reward: data.reward ?? 10,
            shareReward: data.shareReward ?? 5,
          });
        });
        setNewsItems(n);

        const v: VideoItem[] = [];
        videoSnap.forEach((d) => {
          const data = d.data() as any;
          v.push({
            id: d.id,
            title: data.title,
            tag: data.tag,
            description: data.description,
            youtubeId: data.youtubeId || data.videoId || null,
            url: data.url || data.videoUrl || null,
            thumbnailUrl: data.thumbnailUrl || null,
            reward: data.reward ?? 15,
            shareReward: data.shareReward ?? 5,
          });
        });
        setVideoItems(v);

        const m: MarketplaceItem[] = [];
        marketSnap.forEach((d) => {
          const data = d.data() as any;
          m.push({
            id: d.id,
            title: data.title,
            tag: data.tag,
            description: data.description,
            imageUrl: data.imageUrl || null,
            price: data.price ?? 50,
            stock: data.stock ?? null,
          });
        });
        setMarketItems(m);

        const p: PurchaseRecord[] = [];
        purchaseSnap.forEach((d) => {
          const data = d.data() as any;
          p.push({
            id: d.id,
            itemId: data.itemId,
            itemTitle: data.itemTitle || "Unknown item",
            userId: data.userId,
            userEmail: data.userEmail || null,
            userDisplayName: data.userDisplayName || null,
            price: data.price,
            createdAt: data.createdAt,
            status: (data.status as "pending" | "redeemed") || "pending",
          });
        });
        setPurchases(p);
      } catch (err) {
        console.error("Failed to load admin data:", err);
        setError(
          "Failed to load admin data. Check your permissions or connection."
        );
      }
    };

    loadAll();
  }, [user]);

  /* ───────────── Reset helpers ───────────── */
  const resetNewsForm = () => {
    setEditingNewsId(null);
    setNewsForm({
      title: "",
      tag: "",
      summary: "",
      content: "",
      imageUrl: "",
      reward: "10",
      shareReward: "5",
    });
  };

  const resetVideoForm = () => {
    setEditingVideoId(null);
    setVideoForm({
      title: "",
      tag: "",
      description: "",
      youtubeId: "",
      url: "",
      thumbnailUrl: "",
      reward: "15",
      shareReward: "5",
    });
  };

  const resetMarketForm = () => {
    setEditingMarketId(null);
    setMarketForm({
      title: "",
      tag: "",
      description: "",
      imageUrl: "",
      price: "50",
      stock: "10",
    });
  };

  /* ───────────── Submit handlers ───────────── */
  const handleNewsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatus(null);
    setError(null);

    try {
      const reward = parseInt(newsForm.reward || "10", 10);
      const shareReward = parseInt(newsForm.shareReward || "5", 10);

      if (editingNewsId) {
        const ref = doc(db, "news", editingNewsId);
        await updateDoc(ref, {
          title: newsForm.title,
          tag: newsForm.tag || null,
          summary: newsForm.summary || null,
          content: newsForm.content || null,
          imageUrl: newsForm.imageUrl || null,
          reward,
          shareReward,
          updatedAt: serverTimestamp(),
        });
        setStatus("News article updated.");
        setNewsItems((prev) =>
          prev.map((item) =>
            item.id === editingNewsId
              ? {
                  ...item,
                  title: newsForm.title,
                  tag: newsForm.tag || undefined,
                  summary: newsForm.summary || undefined,
                  content: newsForm.content || undefined,
                  imageUrl: newsForm.imageUrl || null,
                  reward,
                  shareReward,
                }
              : item
          )
        );
      } else {
        const ref = await addDoc(collection(db, "news"), {
          title: newsForm.title,
          tag: newsForm.tag || null,
          summary: newsForm.summary || null,
          content: newsForm.content || null,
          imageUrl: newsForm.imageUrl || null,
          reward,
          shareReward,
          createdAt: serverTimestamp(),
        });
        setStatus("News article added.");
        setNewsItems((prev) => [
          {
            id: ref.id,
            title: newsForm.title,
            tag: newsForm.tag || undefined,
            summary: newsForm.summary || undefined,
            content: newsForm.content || undefined,
            imageUrl: newsForm.imageUrl || null,
            reward,
            shareReward,
          },
          ...prev,
        ]);
      }

      resetNewsForm();
    } catch (err: any) {
      console.error("Failed to save news:", err);
      if (err?.code === "permission-denied") {
        setError("Permission denied. Make sure your account has admin access.");
      } else {
        setError("Failed to save news. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVideoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatus(null);
    setError(null);

    try {
      const reward = parseInt(videoForm.reward || "15", 10);
      const shareReward = parseInt(videoForm.shareReward || "5", 10);

      if (editingVideoId) {
        const ref = doc(db, "videos", editingVideoId);
        await updateDoc(ref, {
          title: videoForm.title,
          tag: videoForm.tag || null,
          description: videoForm.description || null,
          youtubeId: videoForm.youtubeId || null,
          url: videoForm.url || null,
          thumbnailUrl: videoForm.thumbnailUrl || null,
          reward,
          shareReward,
          updatedAt: serverTimestamp(),
        });
        setStatus("Tutorial updated.");
        setVideoItems((prev) =>
          prev.map((item) =>
            item.id === editingVideoId
              ? {
                  ...item,
                  title: videoForm.title,
                  tag: videoForm.tag || undefined,
                  description: videoForm.description || undefined,
                  youtubeId: videoForm.youtubeId || null,
                  url: videoForm.url || null,
                  thumbnailUrl: videoForm.thumbnailUrl || null,
                  reward,
                  shareReward,
                }
              : item
          )
        );
      } else {
        const ref = await addDoc(collection(db, "videos"), {
          title: videoForm.title,
          tag: videoForm.tag || null,
          description: videoForm.description || null,
          youtubeId: videoForm.youtubeId || null,
          url: videoForm.url || null,
          thumbnailUrl: videoForm.thumbnailUrl || null,
          reward,
          shareReward,
          createdAt: serverTimestamp(),
        });
        setStatus("Tutorial added.");
        setVideoItems((prev) => [
          {
            id: ref.id,
            title: videoForm.title,
            tag: videoForm.tag || undefined,
            description: videoForm.description || undefined,
            youtubeId: videoForm.youtubeId || null,
            url: videoForm.url || null,
            thumbnailUrl: videoForm.thumbnailUrl || null,
            reward,
            shareReward,
          },
          ...prev,
        ]);
      }

      resetVideoForm();
    } catch (err: any) {
      console.error("Failed to save tutorial:", err);
      if (err?.code === "permission-denied") {
        setError("Permission denied. Make sure your account has admin access.");
      } else {
        setError("Failed to save tutorial. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMarketSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatus(null);
    setError(null);

    try {
      const price = parseInt(marketForm.price || "50", 10);
      const stock =
        marketForm.stock.trim() === "" ? null : parseInt(marketForm.stock, 10);

      if (editingMarketId) {
        const ref = doc(db, "marketplaceItems", editingMarketId);
        await updateDoc(ref, {
          title: marketForm.title,
          tag: marketForm.tag || null,
          description: marketForm.description || null,
          imageUrl: marketForm.imageUrl || null,
          price,
          stock,
          updatedAt: serverTimestamp(),
        });
        setStatus("Marketplace item updated.");
        setMarketItems((prev) =>
          prev.map((item) =>
            item.id === editingMarketId
              ? {
                  ...item,
                  title: marketForm.title,
                  tag: marketForm.tag || undefined,
                  description: marketForm.description || undefined,
                  imageUrl: marketForm.imageUrl || null,
                  price,
                  stock,
                }
              : item
          )
        );
      } else {
        const ref = await addDoc(collection(db, "marketplaceItems"), {
          title: marketForm.title,
          tag: marketForm.tag || null,
          description: marketForm.description || null,
          imageUrl: marketForm.imageUrl || null,
          price,
          stock,
          createdAt: serverTimestamp(),
        });
        setStatus("Marketplace item added.");
        setMarketItems((prev) => [
          {
            id: ref.id,
            title: marketForm.title,
            tag: marketForm.tag || undefined,
            description: marketForm.description || undefined,
            imageUrl: marketForm.imageUrl || null,
            price,
            stock,
          },
          ...prev,
        ]);
      }

      resetMarketForm();
    } catch (err: any) {
      console.error("Failed to save marketplace item:", err);
      if (err?.code === "permission-denied") {
        setError("Permission denied. Make sure your account has admin access.");
      } else {
        setError("Failed to save marketplace item. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  /* ───────────── Mark purchase as redeemed ───────────── */
  const handleMarkPurchaseRedeemed = async (purchaseId: string) => {
    try {
      setUpdatingPurchaseId(purchaseId);
      setError(null);
      setStatus(null);

      const ref = doc(db, "marketplacePurchases", purchaseId);
      await updateDoc(ref, {
        status: "redeemed",
        redeemedAt: serverTimestamp(),
      });

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === purchaseId ? { ...p, status: "redeemed" } : p
        )
      );
      setStatus("Marked as redeemed ✅");
    } catch (err: any) {
      console.error("Failed to mark redeemed:", err);
      if (err?.code === "permission-denied") {
        setError(
          "Permission denied when updating purchase. Check Firestore rules for marketplacePurchases."
        );
      } else {
        setError("Failed to update purchase status. Please try again.");
      }
    } finally {
      setUpdatingPurchaseId(null);
    }
  };

  /* ───────────── Load item into form on "Edit" ───────────── */
  const loadNewsToForm = (item: NewsItem) => {
    setActiveTab("news");
    setEditingNewsId(item.id);
    setNewsForm({
      title: item.title || "",
      tag: item.tag || "",
      summary: item.summary || "",
      content: item.content || "",
      imageUrl: item.imageUrl || "",
      reward: String(item.reward ?? 10),
      shareReward: String(item.shareReward ?? 5),
    });
    setStatus(`Editing news: ${item.title}`);
  };

  const loadVideoToForm = (item: VideoItem) => {
    setActiveTab("videos");
    setEditingVideoId(item.id);
    setVideoForm({
      title: item.title || "",
      tag: item.tag || "",
      description: item.description || "",
      youtubeId: item.youtubeId || "",
      url: item.url || "",
      thumbnailUrl: item.thumbnailUrl || "",
      reward: String(item.reward ?? 15),
      shareReward: String(item.shareReward ?? 5),
    });
    setStatus(`Editing tutorial: ${item.title}`);
  };

  const loadMarketToForm = (item: MarketplaceItem) => {
    setActiveTab("marketplace");
    setEditingMarketId(item.id);
    setMarketForm({
      title: item.title || "",
      tag: item.tag || "",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      price: String(item.price ?? 50),
      stock:
        item.stock === null || item.stock === undefined
          ? ""
          : String(item.stock),
    });
    setStatus(`Editing marketplace item: ${item.title}`);
  };

  /* ───────────── Access guard renders ───────────── */
  if (loadingUser) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center text-sm text-[var(--kh-text-muted)]">
        Checking admin permissions…
      </div>
    );
  }

  if (!loadingUser && accessError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-300 bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            ❌
          </div>
          <h2 className="text-lg font-semibold text-red-700">Access denied</h2>
          <p className="mt-2 text-sm text-gray-600">{accessError}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 w-full rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Go back to homepage
          </button>
        </div>
      </div>
    );
  }

  /* ───────────── Helper: group purchases by item ───────────── */
  const purchasesByItem: Record<string, PurchaseRecord[]> =
    purchases.reduce((acc, p) => {
      const key = p.itemTitle || "Unknown item";
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {} as Record<string, PurchaseRecord[]>);

  /* ───────────── Main Admin UI ───────────── */
  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          Admin Control Center
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Manage news, tutorials, marketplace items, and see who redeemed what
          on Kabayan Hub.
        </p>
        {user && (
          <p className="text-[11px] text-[var(--kh-text-muted)]">
            Signed in as:{" "}
            <span className="font-medium">
              {user.email || user.displayName || user.uid}
            </span>
          </p>
        )}
      </header>

      {status && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="inline-flex overflow-hidden rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] text-[11px]">
        {(["news", "videos", "marketplace", "purchases"] as Tab[]).map(
          (tab) => {
            const label =
              tab === "news"
                ? "News"
                : tab === "videos"
                ? "Tutorials"
                : tab === "marketplace"
                ? "Marketplace"
                : "Purchases";
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 transition ${
                  isActive
                    ? "bg-[var(--kh-blue)] text-white"
                    : "text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                }`}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      {/* NEWS TAB */}
      {activeTab === "news" && (
        <section className="grid gap-4 md:grid-cols-[1.1fr,1fr]">
          {/* Form */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                {editingNewsId ? "Edit news article" : "Add news article"}
              </h2>
              {editingNewsId && (
                <button
                  type="button"
                  onClick={resetNewsForm}
                  className="text-[10px] text-[var(--kh-text-muted)] underline-offset-2 hover:underline"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleNewsSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Title
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={newsForm.title}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Tag (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="e.g. Visa, Money tips"
                    value={newsForm.tag}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, tag: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Header image URL (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://… or /news/..."
                    value={newsForm.imageUrl}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, imageUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Summary (short preview)
                </label>
                <textarea
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  rows={2}
                  value={newsForm.summary}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, summary: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Full content (optional, Markdown allowed)
                </label>
                <textarea
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs font-mono text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  rows={6}
                  placeholder={`Use Markdown: paragraphs, line breaks, and image links.

Example:

**New rule for exit/re-entry visas**

Starting this month, OFWs must ensure:
- Passport validity: 6 months
- Active Iqama

![Sample image](/news/visa-update.png)`}
                  value={newsForm.content}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, content: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Read reward (KP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={newsForm.reward}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, reward: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Share reward (KP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={newsForm.shareReward}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, shareReward: e.target.value })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                {busy
                  ? "Saving…"
                  : editingNewsId
                  ? "Save changes"
                  : "Add news article"}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] text-xs">
            <h2 className="mb-2 text-sm font-semibold text-[var(--kh-text)]">
              Recent news ({newsItems.length})
            </h2>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {newsItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-[11px] font-medium text-[var(--kh-text)]">
                      {item.title}
                    </p>
                    {item.tag && (
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        Tag: {item.tag}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadNewsToForm(item)}
                    className="rounded-full border border-[var(--kh-border)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-card)]"
                  >
                    Edit
                  </button>
                </div>
              ))}
              {newsItems.length === 0 && (
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  No news yet. Add your first article on the left.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* VIDEOS TAB */}
      {activeTab === "videos" && (
        <section className="grid gap-4 md:grid-cols-[1.1fr,1fr]">
          {/* Form */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                {editingVideoId ? "Edit tutorial" : "Add tutorial"}
              </h2>
              {editingVideoId && (
                <button
                  type="button"
                  onClick={resetVideoForm}
                  className="text-[10px] text-[var(--kh-text-muted)] underline-offset-2 hover:underline"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleVideoSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Title
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={videoForm.title}
                  onChange={(e) =>
                    setVideoForm({ ...videoForm, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Tag (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="e.g. Freelance, Skills"
                    value={videoForm.tag}
                    onChange={(e) =>
                      setVideoForm({ ...videoForm, tag: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Thumbnail URL (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://… or /videos/..."
                    value={videoForm.thumbnailUrl}
                    onChange={(e) =>
                      setVideoForm({
                        ...videoForm,
                        thumbnailUrl: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  rows={2}
                  value={videoForm.description}
                  onChange={(e) =>
                    setVideoForm({
                      ...videoForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    YouTube ID (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="e.g. dQw4w9WgXcQ"
                    value={videoForm.youtubeId}
                    onChange={(e) =>
                      setVideoForm({
                        ...videoForm,
                        youtubeId: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Full video URL (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoForm.url}
                    onChange={(e) =>
                      setVideoForm({ ...videoForm, url: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Watch reward (KP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={videoForm.reward}
                    onChange={(e) =>
                      setVideoForm({ ...videoForm, reward: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Share reward (KP)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={videoForm.shareReward}
                    onChange={(e) =>
                      setVideoForm({
                        ...videoForm,
                        shareReward: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                {busy
                  ? "Saving…"
                  : editingVideoId
                  ? "Save changes"
                  : "Add tutorial"}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] text-xs">
            <h2 className="mb-2 text-sm font-semibold text-[var(--kh-text)]">
              Recent tutorials ({videoItems.length})
            </h2>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {videoItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-[11px] font-medium text-[var(--kh-text)]">
                      {item.title}
                    </p>
                    {item.tag && (
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        Tag: {item.tag}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadVideoToForm(item)}
                    className="rounded-full border border-[var(--kh-border)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-card)]"
                  >
                    Edit
                  </button>
                </div>
              ))}
              {videoItems.length === 0 && (
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  No tutorials yet. Add your first video on the left.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* MARKETPLACE TAB */}
      {activeTab === "marketplace" && (
        <section className="grid gap-4 md:grid-cols-[1.1fr,1fr]">
          {/* Form */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                {editingMarketId ? "Edit marketplace item" : "Add marketplace item"}
              </h2>
              {editingMarketId && (
                <button
                  type="button"
                  onClick={resetMarketForm}
                  className="text-[10px] text-[var(--kh-text-muted)] underline-offset-2 hover:underline"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleMarketSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Title
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={marketForm.title}
                  onChange={(e) =>
                    setMarketForm({ ...marketForm, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Tag (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="e.g. Early access, Tool"
                    value={marketForm.tag}
                    onChange={(e) =>
                      setMarketForm({ ...marketForm, tag: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Image URL (optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://… or /market/..."
                    value={marketForm.imageUrl}
                    onChange={(e) =>
                      setMarketForm({
                        ...marketForm,
                        imageUrl: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  rows={2}
                  value={marketForm.description}
                  onChange={(e) =>
                    setMarketForm({
                      ...marketForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Price (Kabayan Points)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={marketForm.price}
                    onChange={(e) =>
                      setMarketForm({ ...marketForm, price: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Stock (leave blank = unlimited)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    value={marketForm.stock}
                    onChange={(e) =>
                      setMarketForm({ ...marketForm, stock: e.target.value })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                {busy
                  ? "Saving…"
                  : editingMarketId
                  ? "Save changes"
                  : "Add marketplace item"}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] text-xs">
            <h2 className="mb-2 text-sm font-semibold text-[var(--kh-text)]">
              Marketplace items ({marketItems.length})
            </h2>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {marketItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-[11px] font-medium text-[var(--kh-text)]">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-[var(--kh-text-muted)]">
                      {item.price} KP
                      {item.stock !== null && item.stock !== undefined && (
                        <> · Stock: {item.stock}</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadMarketToForm(item)}
                    className="rounded-full border border-[var(--kh-border)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)] hover:border-[var(--kh-border-strong)] hover:bg-[var(--kh-bg-card)]"
                  >
                    Edit
                  </button>
                </div>
              ))}
              {marketItems.length === 0 && (
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  No marketplace items yet. Add your first reward on the left.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* PURCHASES TAB */}
      {activeTab === "purchases" && (
        <section className="grid gap-4 md:grid-cols-[1.1fr,1fr]">
          {/* Grouped by product */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] text-xs">
            <h2 className="mb-2 text-sm font-semibold text-[var(--kh-text)]">
              Purchases by product
            </h2>
            {Object.keys(purchasesByItem).length === 0 && (
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                No purchases yet. When Kabayans redeem from the marketplace,
                they will show up here.
              </p>
            )}
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {Object.entries(purchasesByItem).map(([itemTitle, list]) => (
                <div
                  key={itemTitle}
                  className="rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[var(--kh-text)]">
                      {itemTitle}
                    </p>
                    <span className="rounded-full bg-[var(--kh-yellow-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--kh-text)]">
                      {list.length} Kabayan{list.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="space-y-0.5 text-[10px] text-[var(--kh-text-secondary)]">
                    {list.map((p) => (
                      <li key={p.id}>
                        {p.userDisplayName || p.userEmail || p.userId}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Recent purchase log with status + Mark redeemed */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] text-xs">
            <h2 className="mb-2 text-sm font-semibold text-[var(--kh-text)]">
              Recent purchases ({purchases.length})
            </h2>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {purchases.map((p) => {
                let created: Date | null = null;
                if (p.createdAt && p.createdAt.toDate) {
                  created = p.createdAt.toDate();
                }
                const isRedeemed = p.status === "redeemed";

                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 md:flex-row md:items-center"
                  >
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-medium text-[var(--kh-text)]">
                        {p.itemTitle}{" "}
                        <span className="text-[10px] text-[var(--kh-text-muted)]">
                          — {p.userDisplayName || p.userEmail || p.userId}
                        </span>
                      </p>
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        Price: {p.price ?? "?"} KP
                        {created && (
                          <>
                            {" "}
                            ·{" "}
                            {created.toLocaleDateString()}{" "}
                            {created.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-2 md:mt-0">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold ${
                          isRedeemed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isRedeemed ? "Redeemed" : "Pending"}
                      </span>

                      {!isRedeemed && (
                        <button
                          type="button"
                          onClick={() => handleMarkPurchaseRedeemed(p.id)}
                          disabled={updatingPurchaseId === p.id}
                          className="rounded-full bg-[var(--kh-blue)] px-3 py-1 text-[10px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {updatingPurchaseId === p.id
                            ? "Saving…"
                            : "Mark redeemed"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {purchases.length === 0 && (
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  No purchases logged yet.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
