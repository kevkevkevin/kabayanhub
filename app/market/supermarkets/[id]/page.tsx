"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

type Supermarket = {
  id: string;
  name: string;
  city: string;
  area?: string;
  address?: string;
  imageUrl?: string;
  categories?: string[];
  priceLevel?: number; // 1-3
  isFeatured?: boolean;
  hours?: string;
  phone?: string;
  mapUrl?: string;
  instagram?: string;
  facebook?: string;
  description?: string;
  createdAt?: any;
};

function priceLabel(lvl?: number) {
  if (!lvl) return "—";
  if (lvl === 1) return "Affordable";
  if (lvl === 2) return "Mid";
  return "Premium";
}

export default function SupermarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Supermarket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const snap = await getDoc(doc(db, "marketSupermarkets", id));
      if (!snap.exists()) {
        setError("Supermarket not found.");
        setItem(null);
        return;
      }

      const data = snap.data() as any;
      setItem({
        id: snap.id,
        name: data.name || "",
        city: data.city || "",
        area: data.area || "",
        address: data.address || "",
        imageUrl: data.imageUrl || "",
        categories: Array.isArray(data.categories) ? data.categories : [],
        priceLevel: typeof data.priceLevel === "number" ? data.priceLevel : undefined,
        isFeatured: !!data.isFeatured,
        hours: data.hours || "",
        phone: data.phone || "",
        mapUrl: data.mapUrl || "",
        instagram: data.instagram || "",
        facebook: data.facebook || "",
        description: data.description || "",
        createdAt: data.createdAt,
      });
    } catch (e) {
      console.error("Failed to load supermarket:", e);
      setError("Failed to load supermarket. Please refresh.");
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const quickFacts = useMemo(() => {
    if (!item) return [];
    const facts: { label: string; value: string }[] = [];

    facts.push({ label: "City", value: item.city });
    if (item.area) facts.push({ label: "Area", value: item.area });
    facts.push({ label: "Price", value: priceLabel(item.priceLevel) });
    if (item.hours) facts.push({ label: "Hours", value: item.hours });
    if (item.phone) facts.push({ label: "Phone", value: item.phone });

    return facts;
  }, [item]);

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Top nav row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/market/supermarkets"
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
          >
            ← Back to Supermarkets
          </Link>

          <button
            onClick={() => router.push("/market")}
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
          >
            Market Home
          </button>
        </div>

        {item?.isFeatured && (
          <span className="rounded-full bg-[var(--kh-yellow)] px-4 py-2 text-xs font-bold text-slate-900 shadow-[var(--kh-card-shadow)]">
            ⭐ Featured Kabayan Find
          </span>
        )}
      </div>

      {loading ? (
        <div className="kh-card">
          <p className="text-sm text-[var(--kh-text-secondary)]">Loading…</p>
        </div>
      ) : error ? (
        <div className="kh-card">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : !item ? (
        <div className="kh-card">
          <p className="text-sm text-[var(--kh-text-secondary)]">
            Nothing to show.
          </p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="kh-card card-hover overflow-hidden">
            <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--kh-blue-soft)]/50 px-3 py-1 text-[10px] font-semibold text-[var(--kh-blue)]">
                    🛒 Supermarket
                  </span>
                  <span className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)]">
                    📍 {item.city}
                  </span>
                  {item.area && (
                    <span className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-secondary)]">
                      {item.area}
                    </span>
                  )}
                </div>

                <h1 className="mt-2 text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
                  {item.name}
                </h1>

                {item.description ? (
                  <p className="mt-2 text-sm text-[var(--kh-text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--kh-text-secondary)]">
                    Pinoy goods spot — tap the map button to navigate.
                  </p>
                )}

                {item.address && (
                  <div className="mt-3 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3 text-sm">
                    <p className="text-[11px] font-semibold text-[var(--kh-text-muted)]">
                      Address
                    </p>
                    <p className="mt-1 text-[var(--kh-text)]">{item.address}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.mapUrl && (
                    <a
                      href={item.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[var(--kh-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Open in Maps ↗
                    </a>
                  )}

                  {item.instagram && (
                    <a
                      href={item.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text)] hover:brightness-105"
                    >
                      Instagram ↗
                    </a>
                  )}

                  {item.facebook && (
                    <a
                      href={item.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text)] hover:brightness-105"
                    >
                      Facebook ↗
                    </a>
                  )}
                </div>
              </div>

              {/* image */}
              <div>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-64 w-full rounded-3xl object-cover border border-[var(--kh-border)]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-sm text-[var(--kh-text-muted)]">
                    No image yet
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Quick facts */}
          <section className="grid gap-3 md:grid-cols-3">
            {quickFacts.map((f) => (
              <div key={f.label} className="kh-card card-hover">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                  {f.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--kh-text)]">
                  {f.value}
                </p>
              </div>
            ))}
          </section>

          <Link
        href={`/market/supermarkets/${id}/products`}
        className="inline-flex items-center justify-center rounded-full bg-[var(--kh-yellow)] px-5 py-2.5 text-sm font-bold text-slate-900 shadow hover:brightness-105 transition"
        >
        🛒 Shop now
        </Link>


          {/* Categories */}
          <section className="kh-card card-hover">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                  Categories
                </h2>
                <p className="text-[11px] text-[var(--kh-text-muted)]">
                  What you can usually find here.
                </p>
              </div>
              <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)]">
                {item.categories?.length || 0} tags
              </span>
            </div>

            {(item.categories || []).length === 0 ? (
              <p className="mt-3 text-sm text-[var(--kh-text-secondary)]">
                No categories added yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.categories || []).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1 text-xs text-[var(--kh-text-secondary)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Kabayan tip / fun */}
          <section className="kh-card card-hover">
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              Kabayan Tip 🇵🇭
            </h2>
            <p className="mt-1 text-sm text-[var(--kh-text-secondary)]">
              If you’re buying frozen / meat, bring an insulated bag (“ice bag”)
              para hindi mabilis matunaw sa biyahe. Sulit yan, promise.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
