"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

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

const CITY_OPTIONS = ["All", "Riyadh", "Jeddah", "Al Khobar", "Dammam", "Makkah", "Madinah"];

// tiny label for price
function priceLabel(lvl?: number) {
  if (!lvl) return "—";
  if (lvl === 1) return "Affordable";
  if (lvl === 2) return "Mid";
  return "Premium";
}

export default function SupermarketsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Supermarket[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [city, setCity] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const ref = collection(db, "marketSupermarkets");

      // We keep this query simple (no composite index required)
      // We fetch recent docs then filter client-side for search.
      let q = query(ref, orderBy("createdAt", "desc"), limit(200));

      // Optional Firestore filters that won't require a composite index if you keep it simple.
      // If you later combine where + orderBy on different fields, Firestore might ask for an index.
      if (city !== "All") {
        q = query(ref, where("city", "==", city), orderBy("createdAt", "desc"), limit(200));
      }

      const snap = await getDocs(q);
      const list: Supermarket[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
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
      });

      setItems(list);
    } catch (e) {
      console.error("Failed to load supermarkets:", e);
      setError("Failed to load supermarkets. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((r) => {
      if (showFeaturedOnly && !r.isFeatured) return false;

      const haystack = [
        r.name,
        r.city,
        r.area || "",
        r.address || "",
        (r.categories || []).join(", "),
      ]
        .join(" ")
        .toLowerCase();

      return !s || haystack.includes(s);
    });
  }, [items, search, showFeaturedOnly]);

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="kh-card card-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/50 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
              <span className="kp-coin kp-coin-delay-2">🛒</span>
              <span className="font-semibold uppercase tracking-wide">
                Kabayan Market
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
              Pinoy Supermarkets
            </h1>
            <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
              Hanap ng patis, tuyo, Lucky Me, sinigang mix? Here’s the list of
              Pinoy-friendly supermarkets in Saudi — filter by city, then tap to
              see details + map.
            </p>
          </div>

          <Link
            href="/market"
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
          >
            ← Back to Market
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-2 md:grid-cols-[220px,1fr,220px]">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2.5 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          >
            {CITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Cities" : c}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store, area, category… (e.g. Frozen, Snacks)"
            className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2.5 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          />

          <label className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2.5 text-sm text-[var(--kh-text-secondary)]">
            <span className="text-sm">Featured only</span>
            <input
              type="checkbox"
              checked={showFeaturedOnly}
              onChange={(e) => setShowFeaturedOnly(e.target.checked)}
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </header>

      {/* Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            Results ({loading ? "…" : filtered.length})
          </h2>
          <button
            onClick={load}
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="kh-card">
            <p className="text-sm text-[var(--kh-text-secondary)]">
              Loading supermarkets…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="kh-card">
            <p className="text-sm text-[var(--kh-text-secondary)]">
              Walang match. Try another city or keyword.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/market/supermarkets/${r.id}`}
                className="kh-card card-hover block overflow-hidden"
              >
                <div className="relative">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="h-40 w-full rounded-2xl object-cover border border-[var(--kh-border)]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] text-xs text-[var(--kh-text-muted)]">
                      No image yet
                    </div>
                  )}

                  {/* top pills */}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                      📍 {r.city}
                    </span>
                    {r.isFeatured && (
                      <span className="rounded-full bg-[var(--kh-yellow)] px-2 py-1 text-[10px] font-bold text-slate-900">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-sm font-semibold text-[var(--kh-text)] line-clamp-1">
                    {r.name}
                  </p>

                  <p className="mt-0.5 text-[11px] text-[var(--kh-text-muted)] line-clamp-1">
                    {r.area ? `${r.area} · ` : ""}
                    {r.address ? r.address : "Tap to view details"}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(r.categories || []).slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--kh-text-secondary)]"
                        >
                          {c}
                        </span>
                      ))}
                      {(r.categories || []).length > 3 && (
                        <span className="text-[10px] text-[var(--kh-text-muted)]">
                          +{(r.categories || []).length - 3} more
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-semibold text-[var(--kh-text-secondary)]">
                      {priceLabel(r.priceLevel)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
