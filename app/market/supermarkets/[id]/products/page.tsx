"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../../../../../lib/firebase";

type MarketProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  category?: string;
  supermarketId: string;
  createdAt?: any;
  isAvailable?: boolean;
};

export default function SupermarketProductsPage() {
  const params = useParams();
  const supermarketId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Pull products for this supermarket (latest first)
        const ref = collection(db, "marketProducts");
        const q = query(
          ref,
          where("supermarketId", "==", supermarketId),
          orderBy("createdAt", "desc"),
          limit(200)
        );

        const snap = await getDocs(q);
        const list: MarketProduct[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "",
            price: Number(data.price || 0),
            imageUrl: data.imageUrl || "",
            category: data.category || "",
            supermarketId: data.supermarketId,
            createdAt: data.createdAt,
            isAvailable: data.isAvailable ?? true,
          };
        });

        setProducts(list);
      } catch (e: any) {
        console.error(e);
        // If you see "requires an index", click the link Firebase gives and create it.
        setError("Failed to load products. If it says 'requires an index', create the index and refresh.");
      } finally {
        setLoading(false);
      }
    };

    if (supermarketId) load();
  }, [supermarketId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["all", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = category === "all" ? true : (p.category || "") === category;
      const okSearch = s ? (p.name || "").toLowerCase().includes(s) : true;
      return okCat && okSearch;
    });
  }, [products, search, category]);

  const currency = "SAR "; // (later we can add PHP/SR toggle like budget tracker)

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Top bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <Link
            href={`/market/supermarkets/${supermarketId}`}
            className="text-xs font-semibold text-[var(--kh-blue)] hover:underline"
          >
            ← Back to supermarket
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
            Products 🛒
          </h1>
          <p className="text-sm text-[var(--kh-text-secondary)]">
            Filter products from this supermarket.
          </p>
        </div>

        {/* Filters */}
        <div className="kh-card card-hover flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product…"
            className="w-full md:w-64 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full md:w-48 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Grid */}
      <div className="kh-card card-hover">
        {loading ? (
          <p className="text-sm text-[var(--kh-text-secondary)]">
            Loading products…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--kh-text-secondary)]">
            No products found for your filters.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)]">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--kh-text-muted)]">
                      No image
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--kh-text)]">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-[var(--kh-text-muted)]">
                      {p.category || "Uncategorized"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-[var(--kh-text)]">
                      {currency}{p.price.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[var(--kh-text-muted)]">
                      {p.isAvailable === false ? "Unavailable" : "Available"}
                    </p>
                  </div>
                </div>

                {/* For now: no checkout, just view/list */}
                <button
                  disabled
                  className="mt-3 w-full rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] opacity-70"
                >
                  Add to cart (soon)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
