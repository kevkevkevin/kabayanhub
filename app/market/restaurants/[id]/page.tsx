"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

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
  phone?: string;
  hours?: string; // e.g. "10:00 AM - 2:00 AM"
  mapUrl?: string; // optional direct map link
  instagram?: string; // optional url
  facebook?: string; // optional url
  description?: string;
  createdAt?: any;
};

function sanitizePhone(raw?: string) {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

function makeGoogleMapsSearchUrl(r: Restaurant) {
  // If admin provides a direct mapUrl, use it.
  if (r.mapUrl) return r.mapUrl;

  // Otherwise build a search query.
  const q = [r.name, r.area, r.address, r.city, "Saudi Arabia"]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<Restaurant | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const ref = doc(db, "marketRestaurants", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (mounted) {
            setR(null);
            setError("Restaurant not found.");
          }
          return;
        }

        const data = snap.data() as any;
        const item: Restaurant = {
          id: snap.id,
          name: data.name || "Untitled",
          city: data.city || "",
          area: data.area || "",
          address: data.address || "",
          imageUrl: data.imageUrl || "",
          categories: Array.isArray(data.categories) ? data.categories : [],
          priceLevel:
            typeof data.priceLevel === "number" ? data.priceLevel : undefined,
          isFeatured: !!data.isFeatured,
          phone: data.phone || "",
          hours: data.hours || "",
          mapUrl: data.mapUrl || "",
          instagram: data.instagram || "",
          facebook: data.facebook || "",
          description: data.description || "",
          createdAt: data.createdAt,
        };

        if (mounted) setR(item);
      } catch (e) {
        console.error("Failed to load restaurant:", e);
        if (mounted)
          setError("Failed to load this restaurant. Please refresh.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const mapsUrl = useMemo(() => (r ? makeGoogleMapsSearchUrl(r) : ""), [r]);
  const tel = useMemo(() => sanitizePhone(r?.phone), [r?.phone]);

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <div className="kh-card">
          <div className="h-56 w-full animate-pulse rounded-3xl bg-[var(--kh-bg-subtle)]" />
          <div className="mt-4 h-7 w-2/3 animate-pulse rounded bg-[var(--kh-bg-subtle)]" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[var(--kh-bg-subtle)]" />
          <div className="mt-5 grid gap-2 md:grid-cols-3">
            <div className="h-10 animate-pulse rounded-2xl bg-[var(--kh-bg-subtle)]" />
            <div className="h-10 animate-pulse rounded-2xl bg-[var(--kh-bg-subtle)]" />
            <div className="h-10 animate-pulse rounded-2xl bg-[var(--kh-bg-subtle)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !r) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <div className="kh-card">
          <p className="text-sm font-semibold text-[var(--kh-text)]">
            {error || "Restaurant not found."}
          </p>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Baka na-delete or mali yung link. Balik tayo sa list.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
            >
              ← Go back
            </button>
            <Link
              href="/market/restaurants"
              className="rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110"
            >
              Back to Restaurants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const priceLabel =
    r.priceLevel && r.priceLevel >= 1 && r.priceLevel <= 3
      ? "💸".repeat(r.priceLevel)
      : null;

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Top nav row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
        >
          ← Back
        </button>

        <Link
          href="/market/restaurants"
          className="text-xs font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
        >
          View all restaurants →
        </Link>
      </div>

      {/* Main card */}
      <section className="kh-card card-hover">
        {/* Cover */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]">
          {r.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imageUrl}
              alt={r.name}
              className="h-60 w-full object-cover md:h-72"
              loading="lazy"
            />
          ) : (
            <div className="flex h-60 w-full items-center justify-center text-sm text-[var(--kh-text-muted)] md:h-72">
              No image yet
            </div>
          )}

          {/* Badges */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow">
              📍 {r.city || "—"}
            </span>
            {r.isFeatured && (
              <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[11px] font-black text-slate-900 shadow">
                ⭐ Featured
              </span>
            )}
            {priceLabel && (
              <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-white shadow">
                {priceLabel}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
              {r.name}
            </h1>
            <p className="text-sm text-[var(--kh-text-secondary)]">
              {r.area ? `${r.area} · ` : ""}
              {r.address ? r.address : "Tap buttons below for directions."}
            </p>
          </div>

          {/* Categories */}
          {(r.categories || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.categories!.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1 text-[11px] text-[var(--kh-text-secondary)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {r.description && (
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                About
              </p>
              <p className="mt-1 text-sm text-[var(--kh-text-secondary)] leading-relaxed">
                {r.description}
              </p>
            </div>
          )}

          {/* Info grid */}
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCard
              title="Hours"
              value={r.hours || "Not added yet"}
              icon="🕒"
            />
            <InfoCard
              title="Phone"
              value={r.phone || "Not added yet"}
              icon="📞"
            />
            <InfoCard
              title="Location"
              value={r.area || r.city || "—"}
              icon="📍"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110"
            >
              🗺️ Open in Maps
            </a>

            {tel && (
              <a
                href={`tel:${tel}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text)] hover:brightness-105"
              >
                📞 Call
              </a>
            )}

            {r.instagram && (
              <a
                href={r.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text)] hover:brightness-105"
              >
                📷 Instagram
              </a>
            )}

            {r.facebook && (
              <a
                href={r.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text)] hover:brightness-105"
              >
                👍 Facebook
              </a>
            )}
          </div>

          {/* Tiny footer note */}
          <p className="text-[11px] text-[var(--kh-text-muted)]">
            Tip: If details are missing, admin can update this restaurant doc in
            Firestore (phone, hours, mapUrl, etc.).
          </p>
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
        {icon} {title}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--kh-text)]">
        {value}
      </p>
    </div>
  );
}
