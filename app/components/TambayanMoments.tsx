"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type Moment = {
  id: string;
  uid: string;
  username: string;
  text: string;
  createdAt?: any;
  expiresAt?: any;
};

function containsLink(text: string) {
  const t = (text || "").toLowerCase();
  return (
    t.includes("http://") ||
    t.includes("https://") ||
    t.includes("www.") ||
    t.includes(".com") ||
    t.includes(".net") ||
    t.includes(".org") ||
    t.includes(".io") ||
    t.includes(".app") ||
    t.includes(".co") ||
    t.includes(".me") ||
    t.includes(".sa") ||
    t.includes(".ph")
  );
}

export default function TambayanMoments() {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string>("Kabayan");
  const [isAdmin, setIsAdmin] = useState(false);

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Expiry: 7 days (change if you want)
  const EXPIRY_DAYS = 7;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setIsAdmin(false);
      setUsername("Kabayan");

      if (!u) return;

      // Load username + admin role from /users/{uid}
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setUsername(data.username || data.displayName || "Kabayan");
          setIsAdmin(data.role === "admin");
        } else {
          setUsername(u.displayName || "Kabayan");
        }
      } catch {
        setUsername(u.displayName || "Kabayan");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Only show non-expired
    const now = Timestamp.now();

    const q = query(
      collection(db, "moments"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "asc"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Moment[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            uid: data.uid,
            username: data.username || "Kabayan",
            text: data.text || "",
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
          });
        });
        setMoments(list);
        setLoading(false);
      },
      (err) => {
        console.error("moments snapshot error:", err);
        setError("Failed to load moments. Check your rules / connection.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const timeLeftLabel = (expiresAt: any) => {
    try {
      const exp = expiresAt?.toDate ? expiresAt.toDate() : null;
      if (!exp) return "—";
      const ms = exp.getTime() - Date.now();
      const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      if (days <= 0) return `${remH}h left`;
      return `${days}d ${remH}h left`;
    } catch {
      return "—";
    }
  };

  const handlePost = async () => {
    setStatus(null);
    setError(null);

    if (!user) {
      setError("Please login to post a moment.");
      return;
    }

    const clean = text.trim();
    if (clean.length < 1) {
      setError("Type something muna, Kabayan 😅");
      return;
    }
    if (clean.length > 220) {
      setError("Max 220 characters lang for Moments.");
      return;
    }
    if (containsLink(clean)) {
      setError("Links are not allowed sa Moments (anti-spam).");
      return;
    }

    setPosting(true);
    try {
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      await addDoc(collection(db, "moments"), {
        uid: user.uid,
        username: username || "Kabayan",
        text: clean,
        createdAt: serverTimestamp(),
        expiresAt,
      });

      setText("");
      setStatus("Moment posted! Salamat, Kabayan 💛");
    } catch (e: any) {
      console.error("post moment error:", e);
      if (e?.code === "permission-denied") {
        setError("Missing or insufficient permissions (check rules).");
      } else {
        setError("Failed to post moment. Try again.");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (m: Moment) => {
    setStatus(null);
    setError(null);

    if (!user) return;
    const canDelete = isAdmin || m.uid === user.uid;
    if (!canDelete) {
      setError("You can only delete your own moment.");
      return;
    }

    try {
      await deleteDoc(doc(db, "moments", m.id));
      setStatus("Moment deleted.");
    } catch (e: any) {
      console.error("delete moment error:", e);
      setError("Failed to delete moment.");
    }
  };

  const emptyState = useMemo(() => !loading && moments.length === 0, [loading, moments]);

  return (
    <div className="grid gap-4 md:grid-cols-[0.95fr,1.05fr]">
      {/* Post card */}
      <div className="kh-card card-hover">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--kh-text)]">
              Post a Moment ✨
            </p>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Short kwento lang. Auto-expire after {EXPIRY_DAYS} days.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--kh-text)]">
            No links 🚫
          </span>
        </div>

        {status && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {status}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={
              user
                ? "Share a quick win, tip, or kwento… (max 220 chars)"
                : "Login to post a Moment 🙂"
            }
            disabled={!user || posting}
            className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)] disabled:opacity-60"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--kh-text-muted)]">
              {text.trim().length}/220
            </span>
            <button
              onClick={handlePost}
              disabled={!user || posting}
              className="inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
            >
              {posting ? "Posting…" : "Post Moment"}
            </button>
          </div>
        </div>
      </div>

      {/* Feed card */}
      <div className="kh-card card-hover">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--kh-text)]">
              Latest Moments
            </p>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Real-time tambayan vibes.
            </p>
          </div>
          <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)]">
            {moments.length} live
          </span>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
            Loading moments…
          </p>
        )}

        {emptyState && (
          <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
            Wala pang moments. Ikaw ang una, Kabayan 😎
          </p>
        )}

        {!loading && moments.length > 0 && (
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {moments.map((m) => {
              const mine = user && m.uid === user.uid;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[var(--kh-text)] truncate">
                        {m.username}
                        {mine ? " (you)" : ""}
                      </p>
                      <p className="mt-1 text-sm text-[var(--kh-text)] whitespace-pre-wrap break-words">
                        {m.text}
                      </p>
                      <p className="mt-2 text-[10px] text-[var(--kh-text-muted)]">
                        ⏳ {timeLeftLabel(m.expiresAt)}
                      </p>
                    </div>

                    {(isAdmin || mine) && (
                      <button
                        onClick={() => handleDelete(m)}
                        className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-[10px] text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
