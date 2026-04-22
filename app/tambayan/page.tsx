// app/tambayan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type Sticker = {
  id: string;
  name: string;
  imageUrl: string;
  enabled: boolean;
  order: number;
};

type ChatMessage = {
  id: string;
  uid: string;
  username: string;
  type: "text" | "sticker";
  text?: string | null;
  stickerId?: string | null;
  createdAt?: any;
};

type StreamConfig = {
  title: string;
  url: string;
};

type TambayanConfig = {
  marqueeText: string;
  adImage1: string;
  adImage2: string;
  earningPointsEnabled: boolean;
};

function looksLikeLink(s: string) {
  const t = (s || "").toLowerCase();
  return (
    t.includes("http://") ||
    t.includes("https://") ||
    t.includes("www.") ||
    /\b\S+\.(com|net|org|io|app|co|me|sa|ph)\b/i.test(t)
  );
}

function toEmbedUrl(url: string) {
  if (!url) return "";
  const u = url.trim();

  // YouTube watch -> embed
  // https://www.youtube.com/watch?v=XXXX
  // https://youtu.be/XXXX
  try {
    const parsed = new URL(u);
    if (parsed.hostname.includes("youtube.com")) {
      const vid = parsed.searchParams.get("v");
      if (vid) return `https://www.youtube.com/embed/${vid}`;
      // already embed?
      if (parsed.pathname.startsWith("/embed/")) return u;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const vid = parsed.pathname.replace("/", "");
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    }
    // Twitch example (needs parent param in production):
    // if (parsed.hostname.includes("twitch.tv")) return `https://player.twitch.tv/?channel=...&parent=YOUR_DOMAIN`;

    // If already an embed link (or any iframe-friendly URL), just return it
    return u;
  } catch {
    return u;
  }
}

export default function TambayanPage() {
  const [user, setUser] = useState<any>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Stream config
  const [stream, setStream] = useState<StreamConfig>({
    title: "Tambayan Live",
    url: "",
  });

  // Tambayan config (marquee + ads)
  const [tambayanConfig, setTambayanConfig] = useState<TambayanConfig>({
    marqueeText: "Welcome to Tambayan! 🎉 Share your thoughts and chika with the community.",
    adImage1: "",
    adImage2: "",
    earningPointsEnabled: false,
  });

  // Admin edit stream
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [savingStream, setSavingStream] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Admin tambayan config editing
  const [editMarqueeText, setEditMarqueeText] = useState("");
  const [editAdImage1, setEditAdImage1] = useState("");
  const [editAdImage2, setEditAdImage2] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Admin sticker management
  const [stickerName, setStickerName] = useState("");
  const [stickerImageUrl, setStickerImageUrl] = useState("");
  const [addingStickerLoading, setAddingStickerLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auth + load user role + username
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setUserDoc(null);
      setIsAdmin(false);

      if (!u) return;

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserDoc(data);
          setIsAdmin(data?.role === "admin");
        }
      } catch (e) {
        console.error("Failed loading user doc", e);
      }
    });

    return () => unsub();
  }, []);

  const username = useMemo(() => {
    if (!user) return "Guest";
    // Prefer username field if you added it
    const u = userDoc?.username || userDoc?.signupUsername || userDoc?.handle;
    if (u && typeof u === "string" && u.trim().length > 0) return u.trim();
    // fallback displayName
    if (user?.displayName) return user.displayName;
    // fallback email prefix
    if (user?.email) return String(user.email).split("@")[0];
    return "Kabayan";
  }, [user, userDoc]);

  // Load stickers
  useEffect(() => {
    const q = query(collection(db, "tambayanStickers"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Sticker[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            name: data.name || d.id,
            imageUrl: data.imageUrl || "",
            enabled: !!data.enabled,
            order: data.order ?? 999,
          });
        });
        setStickers(list.filter((s) => s.enabled && s.imageUrl));
      },
      (err) => console.error("Stickers snapshot error:", err)
    );
    return () => unsub();
  }, []);

  // Load stream config
  useEffect(() => {
    const ref = doc(db, "tambayanConfig", "stream");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const next = {
          title: data.title || "Tambayan Live",
          url: data.url || "",
        };
        setStream(next);
        setEditTitle(next.title);
        setEditUrl(next.url);
      },
      (err) => console.error("Stream snapshot error:", err)
    );
    return () => unsub();
  }, []);

  // Load tambayan config (marquee + ads)
  useEffect(() => {
    const ref = doc(db, "tambayanConfig", "display");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const config = {
          marqueeText: data.marqueeText || "Welcome to Tambayan! 🎉 Share your thoughts and chika with the community.",
          adImage1: data.adImage1 || "",
          adImage2: data.adImage2 || "",
          earningPointsEnabled: data.earningPointsEnabled || false,
        };
        setTambayanConfig(config);
        // Initialize edit state for admins
        setEditMarqueeText(config.marqueeText);
        setEditAdImage1(config.adImage1);
        setEditAdImage2(config.adImage2);
      },
      (err) => console.error("Tambayan config snapshot error:", err)
    );
    return () => unsub();
  }, []);

  // Load last 100 chat messages (realtime)
  useEffect(() => {
    setLoadingChat(true);
    const q = query(
      collection(db, "tambayanChat"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            uid: data.uid,
            username: data.username || "Kabayan",
            type: data.type,
            text: data.text ?? null,
            stickerId: data.stickerId ?? null,
            createdAt: data.createdAt,
          });
        });

        // We queried desc; show asc
        setMessages(list.reverse());
        setLoadingChat(false);
      },
      (err) => {
        console.error("Chat snapshot error:", err);
        setError("Failed to load chat. Check permissions/rules.");
        setLoadingChat(false);
      }
    );

    return () => unsub();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-delete messages older than 10 minutes + reward logic
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      setMessages((prevMessages) => {
        const filtered = prevMessages.filter((msg) => {
          if (!msg.createdAt || !msg.createdAt.toDate) return true;
          const msgTime = msg.createdAt.toDate();
          return msgTime > tenMinutesAgo;
        });

        // Reward a random user if earning is enabled and there are messages to expire
        if (
          tambayanConfig.earningPointsEnabled &&
          prevMessages.length > 0 &&
          filtered.length < prevMessages.length
        ) {
          // Get unique users from expired messages
          const expiredMessages = prevMessages.filter((msg) => {
            if (!msg.createdAt || !msg.createdAt.toDate) return false;
            const msgTime = msg.createdAt.toDate();
            return msgTime <= tenMinutesAgo;
          });

          const uniqueUsers = Array.from(
            new Set(expiredMessages.map((m) => m.uid))
          );

          if (uniqueUsers.length > 0) {
            // Pick random user
            const randomUid =
              uniqueUsers[Math.floor(Math.random() * uniqueUsers.length)];
            const winnerMsg = expiredMessages.find((m) => m.uid === randomUid);

            if (randomUid && winnerMsg) {
              rewardUser(randomUid, winnerMsg.username);
            }
          }
        }

        return filtered;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(cleanupInterval);
  }, [tambayanConfig.earningPointsEnabled]);

  const rewardUser = async (uid: string, username: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const currentPoints = userSnap.data()?.points || 0;
        await updateDoc(userRef, {
          points: currentPoints + 50,
        });

        setStatus(`🎉 ${username} won 50 KP! Chat activity reward!`);
        setTimeout(() => setStatus(null), 5000);
      }
    } catch (e) {
      console.error("Failed to reward user:", e);
    }
  };

  const stickerMap = useMemo(() => {
    const m = new Map<string, Sticker>();
    stickers.forEach((s) => m.set(s.id, s));
    return m;
  }, [stickers]);

  const sendText = async () => {
    if (!user) {
      setError("Please log in to chat.");
      return;
    }
    setError(null);
    setStatus(null);

    const t = text.trim();
    if (!t) return;

    if (looksLikeLink(t)) {
      setError("No links muna, Kabayan 😅 (Text only, or use stickers.)");
      return;
    }

    if (t.length > 220) {
      setError("Max 220 characters lang, Kabayan.");
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, "tambayanChat"), {
        uid: user.uid,
        username,
        type: "text",
        text: t,
        stickerId: null,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      console.error("Send text failed:", e);
      setError("Failed to send. Check permissions.");
    } finally {
      setSending(false);
    }
  };

  const sendSticker = async (stickerId: string) => {
    if (!user) {
      setError("Please log in to chat.");
      return;
    }
    setError(null);
    setStatus(null);

    setSending(true);
    try {
      await addDoc(collection(db, "tambayanChat"), {
        uid: user.uid,
        username,
        type: "sticker",
        text: null,
        stickerId,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Send sticker failed:", e);
      setError("Failed to send sticker. Check permissions.");
    } finally {
      setSending(false);
    }
  };

  const saveStream = async () => {
    if (!isAdmin) return;
    setSavingStream(true);
    setError(null);
    setStatus(null);

    try {
      const ref = doc(db, "tambayanConfig", "stream");
      await setDoc(
        ref,
        {
          title: editTitle.trim() || "Tambayan Live",
          url: editUrl.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus("Stream updated ✅");
    } catch (e) {
      console.error("Save stream failed:", e);
      setError("Failed to update stream. Check admin role/rules.");
    } finally {
      setSavingStream(false);
    }
  };

  // Admin-only: delete oldest so only last 100 remain
  const trimChatTo100 = async () => {
    if (!isAdmin) return;
    setTrimming(true);
    setError(null);
    setStatus(null);

    try {
      const qAsc = query(
        collection(db, "tambayanChat"),
        orderBy("createdAt", "asc"),
        limit(200)
      );
      const snap = await getDocs(qAsc);
      const docs = snap.docs;

      if (docs.length <= 100) {
        setStatus("Chat already within 100 messages ✅");
        return;
      }

      const toDelete = docs.slice(0, docs.length - 100);
      for (const d of toDelete) {
        await deleteDoc(doc(db, "tambayanChat", d.id));
      }
      setStatus(`Trimmed ${toDelete.length} old messages ✅`);
    } catch (e) {
      console.error("Trim failed:", e);
      setError("Failed to trim. Check permissions (admin delete needed).");
    } finally {
      setTrimming(false);
    }
  };

  // Admin-only: Clear ALL chat messages
  const clearAllChat = async () => {
    if (!isAdmin) return;
    if (!window.confirm("⚠️ Are you sure? This will delete ALL messages. This action cannot be undone.")) {
      return;
    }

    setClearing(true);
    setError(null);
    setStatus(null);

    try {
      const q = query(collection(db, "tambayanChat"));
      const snap = await getDocs(q);
      const docs = snap.docs;

      let deleted = 0;
      for (const d of docs) {
        await deleteDoc(doc(db, "tambayanChat", d.id));
        deleted++;
      }
      setStatus(`🗑️ Cleared ${deleted} messages ✅`);
    } catch (e) {
      console.error("Clear failed:", e);
      setError("Failed to clear chat. Check permissions (admin delete needed).");
    } finally {
      setClearing(false);
    }
  };

  // Admin-only: Add new sticker
  const addNewSticker = async () => {
    if (!isAdmin) return;

    const name = stickerName.trim();
    const imageUrl = stickerImageUrl.trim();

    if (!name || !imageUrl) {
      setError("Please fill in sticker name and image URL.");
      return;
    }

    setAddingStickerLoading(true);
    setError(null);
    setStatus(null);

    try {
      const maxOrder = stickers.length > 0 ? Math.max(...stickers.map(s => s.order)) : 0;
      await addDoc(collection(db, "tambayanStickers"), {
        name,
        imageUrl,
        enabled: true,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      });
      setStatus("Sticker added ✅");
      setStickerName("");
      setStickerImageUrl("");
    } catch (e) {
      console.error("Add sticker failed:", e);
      setError("Failed to add sticker. Check permissions.");
    } finally {
      setAddingStickerLoading(false);
    }
  };

  // Admin-only: Save tambayan config (marquee + ads)
  const saveTambayanConfig = async () => {
    if (!isAdmin) return;
    setSavingConfig(true);
    setError(null);
    setStatus(null);

    try {
      const ref = doc(db, "tambayanConfig", "display");
      await setDoc(
        ref,
        {
          marqueeText: editMarqueeText.trim() || "Welcome to Tambayan! 🎉 Share your thoughts and chika with the community.",
          adImage1: editAdImage1 || "",
          adImage2: editAdImage2 || "",
          earningPointsEnabled: tambayanConfig.earningPointsEnabled,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus("Tambayan config updated ✅");
    } catch (e) {
      console.error("Save config failed:", e);
      setError("Failed to update config. Check permissions.");
    } finally {
      setSavingConfig(false);
    }
  };

  const embedUrl = useMemo(() => toEmbedUrl(stream.url), [stream.url]);

  return (
  <div className="space-y-6 md:space-y-8 page-fade">
    {/* Header */}
    <header className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
        <span className="kp-coin kp-coin-delay-2">🟡</span>
        <span className="font-semibold uppercase tracking-wide">Tambayan</span>
        <span className="text-[10px] text-[var(--kh-text-muted)]">live + chat</span>
      </div>

      <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
        Tambayan Live 🎥💬
      </h1>
      <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
        Watch the live stream on the left, then chika on the right.
      </p>
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

    {/* LAYOUT: 60/40 Split */}
    <section className="grid gap-4 grid-cols-1 md:grid-cols-5 items-start">
      
      {/* COLUMN 1: VIDEO & ADMIN (60%) */}
      <div className="kh-card card-hover md:col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            {stream.title || "Tambayan Live"}
          </h2>
          <p className="text-[11px] text-[var(--kh-text-muted)]">
            Admin sets the live link. Works with YouTube watch links too.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="aspect-video w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="aspect-video w-full flex items-center justify-center text-sm text-white/70">
              No stream set yet.
            </div>
          )}
        </div>

        {/* Marquee Style */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .marquee-text {
            animation: marquee 15s linear infinite;
            white-space: nowrap;
          }
        `}</style>
        
        {/* Announcement Marquee */}
        <div className="overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
          <div className="text-[10px] font-semibold text-[var(--kh-text-secondary)] mb-2">📢 Announcement</div>
          <div className="overflow-hidden rounded-lg bg-[var(--kh-bg)] h-10 flex items-center">
            <div className="marquee-text text-sm font-medium text-[var(--kh-text)]">
              {tambayanConfig.marqueeText}
              <span className="ml-8">•</span>
              <span className="ml-8">{tambayanConfig.marqueeText}</span>
            </div>
          </div>
        </div>

        {/* Ads Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tambayanConfig.adImage1 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--kh-border)] h-32 sm:h-40">
              <img src={tambayanConfig.adImage1} alt="Ad 1" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          ) : null}
          {tambayanConfig.adImage2 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--kh-border)] h-32 sm:h-40">
              <img src={tambayanConfig.adImage2} alt="Ad 2" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          ) : null}
        </div>

        {/* ADMIN CONTROLS SECTION */}
        {isAdmin && (
          <div className="space-y-4">
            {/* Set Stream Link */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <h3 className="text-sm font-semibold text-[var(--kh-text)]">Admin: Set stream link</h3>
              <div className="mt-3 grid gap-3">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Title"
                />
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Stream URL"
                />
                <button 
                  onClick={saveStream} 
                  disabled={savingStream}
                  className="rounded-full bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  {savingStream ? "Saving…" : "Save stream"}
                </button>
              </div>
            </div>

            {/* Admin: Edit Marquee & Ads */}
            <div className="mt-4 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <h3 className="text-sm font-semibold text-[var(--kh-text)]">
                Admin: Edit marquee & ads
              </h3>
              <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
                Update the scrolling marquee text and advertisement images.
              </p>

              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Marquee Text
                  </label>
                  <textarea
                    value={editMarqueeText}
                    onChange={(e) => setEditMarqueeText(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="Welcome message..."
                  />
                  <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                    {editMarqueeText.length}/200 characters
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Ad Image 1 URL
                  </label>
                  <input
                    value={editAdImage1}
                    onChange={(e) => setEditAdImage1(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://example.com/ad1.jpg"
                  />
                  {editAdImage1 && (
                    <div className="mt-2 rounded-lg border border-[var(--kh-border)] overflow-hidden">
                      <img
                        src={editAdImage1}
                        alt="Ad preview"
                        className="w-full h-20 object-cover"
                        onError={() => setError("Failed to load ad image")}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Ad Image 2 URL
                  </label>
                  <input
                    value={editAdImage2}
                    onChange={(e) => setEditAdImage2(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://example.com/ad2.jpg"
                  />
                  {editAdImage2 && (
                    <div className="mt-2 rounded-lg border border-[var(--kh-border)] overflow-hidden">
                      <img
                        src={editAdImage2}
                        alt="Ad preview"
                        className="w-full h-20 object-cover"
                        onError={() => setError("Failed to load ad image")}
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={saveTambayanConfig}
                  disabled={savingConfig}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
                >
                  {savingConfig ? "Saving…" : "💾 Save config"}
                </button>
              </div>
            </div>

            {/* Admin: Add stickers */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <h3 className="text-sm font-semibold text-[var(--kh-text)]">Admin: Add stickers</h3>
              <div className="mt-3 grid gap-3">
                <input
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Sticker Name"
                />
                <input
                  value={stickerImageUrl}
                  onChange={(e) => setStickerImageUrl(e.target.value)}
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Image URL"
                />
                <button 
                  onClick={addNewSticker} 
                  disabled={addingStickerLoading}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  {addingStickerLoading ? "Adding…" : "✨ Add sticker"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COLUMN 2: CHAT ROOM (40%) */}
      <div className="kh-card card-hover flex flex-col h-[600px] md:h-auto md:min-h-[700px] md:col-span-2 overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">Chat room</h2>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              You are: <span className="font-semibold">{username}</span>
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={clearAllChat} className="rounded-full bg-red-50 px-3 py-1 text-[10px] text-red-600 font-bold">🗑️ Clear</button>
            </div>
          )}
        </div>

        {/* Messages Container */}
        <div className="mt-3 flex-1 overflow-y-auto rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3 space-y-3">
          {loadingChat ? (
            <p className="text-xs text-[var(--kh-text-secondary)] text-center mt-4">Loading chat…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-[var(--kh-text-secondary)] text-center mt-4">No messages yet. Say hi! 👋</p>
          ) : (
            messages.map((m) => {
              const mine = user?.uid === m.uid;
              return (
                <div key={m.id} className={`rounded-2xl border px-3 py-2 ${mine ? "bg-[var(--kh-yellow-soft)] ml-4" : "bg-[var(--kh-bg-card)] mr-4"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-[var(--kh-text)]">{m.username}</p>
                    <span className="text-[9px] text-[var(--kh-text-muted)]">
                      {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  </div>
                  {m.type === "text" ? (
                    <p className="text-sm text-[var(--kh-text)] mt-1 break-words">{m.text}</p>
                  ) : (
                    <div className="mt-2">
                      {m.stickerId && stickerMap.get(m.stickerId) && (
                        <img src={stickerMap.get(m.stickerId)!.imageUrl} className="h-12 w-12 rounded-lg object-cover" alt="sticker" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Chat Input & Sticker Tray */}
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={user ? "Type a message..." : "Login to chat"}
              disabled={!user}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              className="flex-1 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
            />
            <button 
              onClick={sendText} 
              disabled={!user || sending}
              className="rounded-xl bg-[var(--kh-blue)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>

          {/* Sticker Tray */}
          <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
            <p className="text-[10px] font-bold text-[var(--kh-text-muted)] uppercase mb-2">Stickers</p>
            <div className="grid grid-cols-6 gap-2">
              {stickers.map((s) => (
                <button 
                  key={s.id} 
                  onClick={() => sendSticker(s.id)}
                  disabled={!user}
                  className="hover:scale-110 transition-transform disabled:opacity-50"
                >
                  <img src={s.imageUrl} className="h-10 w-10 rounded-lg object-cover shadow-sm" alt={s.name} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
);
}
