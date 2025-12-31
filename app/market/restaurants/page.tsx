"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type City = "All" | "Riyadh" | "Jeddah" | "Alkhobar";

type Restaurant = {
  id: string;
  name: string;
  city: string;
  area?: string;
  address?: string;
  imageUrl?: string;
  categories?: string[];
  priceLevel?: number; // 1-3 optional
  isFeatured?: boolean;
  createdAt?: any; // Firestore Timestamp
};

const CITIES: City[] = ["All", "Riyadh", "Jeddah", "Alkhobar"];

export default function MarketRestaurantsPage() {
  const [city, setCity] = useState<City>("All");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch restaurants whenever city changes
  useEffect(() => {
    let isMounted = true;

    async function fetchRestaurants() {
      setLoading(true);
      setError(null);

      try {
        const ref = collection(db, "marketRestaurants");

        // ✅ Avoid composite index requirement:
        // - "All": orderBy(createdAt desc) is safe
        // - Specific city: just where(city==...), then sort client-side
        const q =
          city === "All"
            ? query(ref, orderBy("createdAt", "desc"), limit(200))
            : query(ref, where("city", "==", city), limit(200));

        const snap = await getDocs(q);

        const list: Restaurant[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "Untitled",
            city: data.city || "",
            area: data.area || "",
            address: data.address || "",
            imageUrl: data.imageUrl || "",
            categories: Array.isArray(data.categories) ? data.categories : [],
            priceLevel:
              typeof data.priceLevel === "number" ? data.priceLevel : undefined,
            isFeatured: !!data.isFeatured,
            createdAt: data.createdAt,
          };
        });

        // Client-side sorting for city filter
        if (city !== "All") {
          list.sort((a, b) => {
            const aSec = a.createdAt?.seconds ?? 0;
            const bSec = b.createdAt?.seconds ?? 0;
            return bSec - aSec;
          });
        }

        if (isMounted) setItems(list);
      } catch (err) {
        console.error("Failed to load restaurants:", err);
        if (isMounted)
          setError(
            "Failed to load restaurants. Check Firestore rules or refresh the page."
          );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchRestaurants();
    return () => {
      isMounted = false;
    };
  }, [city]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;

    return items.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const area = (r.area || "").toLowerCase();
      const city = (r.city || "").toLowerCase();
      const cats = (r.categories || []).join(" ").toLowerCase();
      return (
        name.includes(s) ||
        area.includes(s) ||
        city.includes(s) ||
        cats.includes(s)
      );
    });
  }, [items, search]);

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/50 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-2">🍽️</span>
          <span className="font-semibold uppercase tracking-wide">
            Kabayan Market · Restaurants
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Pinoy restaurants near you 😋
        </h1>

        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Browse Filipino-friendly restos by city. Tip: search “sisig”, “ihaw”,
          “karinderya”, or area like “Olaya”.
        </p>
      </header>

      {/* Controls */}
      <section className="kh-card card-hover">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* City Pills */}
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => {
              const active = c === city;
              return (
                <button
                  key={c}
                  onClick={() => setCity(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[var(--kh-blue)] bg-[var(--kh-blue-soft)] text-[var(--kh-blue)]"
                      : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                  }`}
                >
                  {c === "All" ? "All Cities" : c}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="w-full md:w-[360px]">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Search
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2">
              <span className="text-[var(--kh-text-muted)]">🔎</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, area, category…"
                className="w-full bg-transparent text-sm text-[var(--kh-text)] outline-none placeholder:text-[var(--kh-text-muted)]"
              />
              {search.trim() && (
                <button
                  onClick={() => setSearch("")}
                  className="rounded-full border border-[var(--kh-border)] px-2 py-1 text-[10px] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--kh-text-muted)]">
          <span>
            Showing <b className="text-[var(--kh-text)]">{filtered.length}</b>{" "}
            result(s)
            {city !== "All" ? ` in ${city}` : ""}.
          </span>

          <Link
            href="/market"
            className="font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
          >
            ← Back to Kabayan Market
          </Link>
        </div>
      </section>

      {/* Status */}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {loading && (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kh-card">
              <div className="h-36 w-full animate-pulse rounded-2xl bg-[var(--kh-bg-subtle)]" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--kh-bg-subtle)]" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[var(--kh-bg-subtle)]" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="kh-card">
          <p className="text-sm font-semibold text-[var(--kh-text)]">
            No restaurants found 🥲
          </p>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Try changing city, or search something simpler like “sisig” or
            “karinderya”.
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <section className="grid gap-3 md:grid-cols-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/market/restaurants/${r.id}`}
              className="kh-card card-hover block"
            >
              {/* Cover */}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt={r.name}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center text-[11px] text-[var(--kh-text-muted)]">
                    No image yet
                  </div>
                )}

                {/* Pills */}
                <div className="absolute left-2 top-2 flex gap-2">
                  <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-900">
                    📍 {r.city || "—"}
                  </span>
                  {r.isFeatured && (
                    <span className="rounded-full bg-[var(--kh-yellow)] px-2 py-1 text-[10px] font-black text-slate-900">
                      ⭐ Featured
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--kh-text)]">
                    {r.name}
                  </p>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    {r.area ? `${r.area} · ` : ""}
                    {r.address ? r.address : "Tap to view details"}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {(r.categories || []).slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-2 py-1 text-[10px] text-[var(--kh-text-secondary)]"
                    >
                      {c}
                    </span>
                  ))}
                  {(r.categories || []).length > 3 && (
                    <span className="rounded-full px-2 py-1 text-[10px] text-[var(--kh-text-muted)]">
                      +{(r.categories || []).length - 3} more
                    </span>
                  )}
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-[var(--kh-text-muted)]">
                    {r.priceLevel
                      ? "💸".repeat(Math.max(1, Math.min(3, r.priceLevel)))
                      : "🍴"}
                  </span>
                  <span className="font-semibold text-[var(--kh-blue)]">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
