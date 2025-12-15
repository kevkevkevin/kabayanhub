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

  // Admin edit stream
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [savingStream, setSavingStream] = useState(false);
  const [trimming, setTrimming] = useState(false);

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

  const embedUrl = useMemo(() => toEmbedUrl(stream.url), [stream.url]);

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
          <span className="kp-coin kp-coin-delay-2">🟡</span>
          <span className="font-semibold uppercase tracking-wide">
            Tambayan
          </span>
          <span className="text-[10px] text-[var(--kh-text-muted)]">
            live + chat
          </span>
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

      {/* LAYOUT UPDATE: 60/40 Split
         1. Use 'md:grid-cols-5' (5 columns total)
      */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-5 items-start">
        
        {/* COLUMN 1: VIDEO 
           md:col-span-3 -> Takes 3 out of 5 columns (60%) 
        */}
        <div className="kh-card card-hover md:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                {stream.title || "Tambayan Live"}
              </h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                Admin sets the live link. Works with YouTube watch links too.
              </p>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-black">
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

          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-4 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <h3 className="text-sm font-semibold text-[var(--kh-text)]">
                Admin: Set stream link
              </h3>
              <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
                Paste a YouTube link (watch or embed) or any iframe-friendly URL.
              </p>

              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Title
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="Tambayan Live"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                    Stream URL
                  </label>
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                    Tip: YouTube watch links auto-convert to embed.
                  </p>
                </div>

                <button
                  onClick={saveStream}
                  disabled={savingStream}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
                >
                  {savingStream ? "Saving…" : "Save stream"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 2: CHAT 
           md:col-span-2 -> Takes 2 out of 5 columns (40%)
        */}
        <div className="kh-card card-hover flex flex-col h-[600px] md:h-auto md:min-h-[600px] md:col-span-2"> 
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                Chat room
              </h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                You are: <span className="font-semibold">{username}</span>{" "}
                {user?.email ? (
                  <span className="ml-2 text-[10px] text-[var(--kh-text-muted)]">
                    ({user.email})
                  </span>
                ) : null}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={trimChatTo100}
                disabled={trimming}
                className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-card)] disabled:opacity-60"
                title="Delete oldest messages so only last 100 remain"
              >
                {trimming ? "Trimming…" : "Trim to 100"}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="mt-3 flex-1 overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]">
            <div className="h-full overflow-y-auto p-3 space-y-2">
              {loadingChat && (
                <p className="text-xs text-[var(--kh-text-secondary)]">
                  Loading chat…
                </p>
              )}

              {!loadingChat && messages.length === 0 && (
                <p className="text-xs text-[var(--kh-text-secondary)]">
                  Walang chat pa. Be the first to say hi 👋
                </p>
              )}

              {messages.map((m) => {
                const mine = user?.uid && m.uid === user.uid;
                const bubble = mine
                  ? "bg-[var(--kh-yellow-soft)] border-[var(--kh-border)]"
                  : "bg-[var(--kh-bg-card)] border-[var(--kh-border)]";

                const sticker = m.stickerId
                  ? stickerMap.get(m.stickerId)
                  : null;

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border px-3 py-2 ${bubble}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[var(--kh-text)]">
                        {m.username || "Kabayan"}
                        {mine && (
                          <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            you
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-[var(--kh-text-muted)]">
                        {m.createdAt?.toDate
                          ? m.createdAt
                              .toDate()
                              .toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                          : ""}
                      </span>
                    </div>

                    {m.type === "text" && (
                      <p className="mt-1 text-sm text-[var(--kh-text)] whitespace-pre-wrap break-words">
                        {m.text}
                      </p>
                    )}

                    {m.type === "sticker" && (
                      <div className="mt-2">
                        {sticker ? (
                          <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--kh-bg)]/40 px-2 py-2">
                            <img
                              src={sticker.imageUrl}
                              alt={sticker.name}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                            <span className="text-xs text-[var(--kh-text-secondary)]">
                              {sticker.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--kh-text-secondary)]">
                            Sticker sent 🎉
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input + stickers */}
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  user ? "Type a message..." : "Log in to chat…"
                }
                disabled={!user || sending}
                maxLength={220}
                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)] disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendText();
                  }
                }}
              />
              <button
                onClick={sendText}
                disabled={!user || sending}
                className="rounded-xl bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                Send
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[var(--kh-text)]">
                  Stickers
                </p>
                <span className="text-[10px] text-[var(--kh-text-muted)]">
                  {stickers.length} available
                </span>
              </div>

              {stickers.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--kh-text-secondary)]">
                  No stickers yet.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {stickers.map((s) => (
                    <button
                      key={s.id}
                      disabled={!user || sending}
                      onClick={() => sendSticker(s.id)}
                      className="group rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-1 hover:bg-[var(--kh-bg)] disabled:opacity-60"
                      title={s.name}
                    >
                      <img
                        src={s.imageUrl}
                        alt={s.name}
                        className="h-10 w-10 rounded-lg object-cover transition group-hover:scale-[1.03]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
