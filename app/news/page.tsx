// app/news/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

type NewsDoc = {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  createdAt?: any; // Firestore Timestamp
  tag?: string;

  // Optional (exists in your DB screenshot, but not required)
  reward?: number;
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
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const ref = collection(db, "news");
        const q = query(ref, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const list: NewsDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            title: d.title || "",
            summary: d.summary || "",
            content: d.content || "",
            imageUrl: d.imageUrl || "",
            createdAt: d.createdAt,
            tag: d.tag || "",
            reward: typeof d.reward === "number" ? d.reward : undefined,
          });
        });

        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("Failed to load news. Please refresh.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const featured = useMemo(() => items.slice(0, 1)[0], [items]);
  const rest = useMemo(() => items.slice(1), [items]);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/60 px-3 py-1 text-[11px] font-semibold text-[var(--kh-blue)]">
          📰 News & Updates
        </div>
        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Kabayan Updates
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Easy-to-read updates for OFWs in Saudi — no hassle, no heavy jargon.
          Tap a post to read full details like a blog.
        </p>
      </header>

      {err && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </p>
      )}

      {loading && (
        <div className="kh-card">
          <p className="text-sm text-[var(--kh-text-secondary)]">Loading news…</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="kh-card">
          <p className="text-sm text-[var(--kh-text-secondary)]">
            No news posts yet. Add some docs in your <code>news</code> collection.
          </p>
        </div>
      )}

      {/* Featured */}
      {!loading && featured && (
        <Link
          href={`/news/${featured.id}`}
          className="group block overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] shadow-[var(--kh-card-shadow)] transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="grid md:grid-cols-[1.1fr,0.9fr]">
            <div className="relative min-h-[220px] md:min-h-[320px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: featured.imageUrl
                    ? `url('${featured.imageUrl}')`
                    : "none",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" />

              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                {featured.tag && (
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-slate-900">
                    {featured.tag}
                  </span>
                )}
                {typeof featured.reward === "number" && (
                  <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[10px] font-black text-slate-900">
                    +{featured.reward} KP
                  </span>
                )}
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[11px] text-white/80">
                  {formatDate(featured.createdAt)}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white md:text-2xl">
                  {featured.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-white/90">
                  {featured.summary}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-5 md:p-6">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                  Featured
                </p>
                <p className="text-sm text-[var(--kh-text-secondary)]">
                  Read the full story with clean formatting, images, and a proper
                  blog layout.
                </p>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--kh-blue)]">
                Read full post
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Grid list */}
      {!loading && rest.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((n) => (
            <Link
              key={n.id}
              href={`/news/${n.id}`}
              className="group kh-card card-hover flex flex-col overflow-hidden"
            >
              <div className="relative overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]">
                <div
                  className="h-36 w-full bg-cover bg-center transition-transform duration-200 group-hover:scale-[1.03]"
                  style={{
                    backgroundImage: n.imageUrl ? `url('${n.imageUrl}')` : "none",
                  }}
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {n.tag && (
                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                      {n.tag}
                    </span>
                  )}
                  {typeof n.reward === "number" && (
                    <span className="rounded-full bg-[var(--kh-yellow)] px-2 py-0.5 text-[10px] font-black text-slate-900">
                      +{n.reward} KP
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex-1 space-y-2">
                <p className="text-[10px] text-[var(--kh-text-muted)]">
                  {formatDate(n.createdAt)}
                </p>
                <h3 className="line-clamp-2 text-sm font-semibold text-[var(--kh-text)]">
                  {n.title}
                </h3>
                <p className="line-clamp-3 text-xs text-[var(--kh-text-secondary)]">
                  {n.summary}
                </p>
              </div>

              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--kh-blue)]">
                Read
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
