"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";

type Restaurant = {
  id: string;
  name: string;
  city: string;
  area?: string;
  address?: string;
  imageUrl?: string;
  categories?: string[];
  priceLevel?: number; // 1-3
  isFeatured?: boolean;
  phone?: string;
  hours?: string;
  mapUrl?: string;
  instagram?: string;
  facebook?: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
};

const CITY_OPTIONS = ["Riyadh", "Jeddah", "Al Khobar", "Dammam", "Makkah", "Madinah"];

function normalizeCategories(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export default function AdminRestaurantsPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Restaurant[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("All");

  // modal state
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [city, setCity] = useState(CITY_OPTIONS[0]);
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoriesCsv, setCategoriesCsv] = useState("Filipino, BBQ");
  const [priceLevel, setPriceLevel] = useState<number>(2);
  const [isFeaturedField, setIsFeaturedField] = useState(false);
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setCity(CITY_OPTIONS[0]);
    setArea("");
    setAddress("");
    setImageUrl("");
    setCategoriesCsv("Filipino, BBQ");
    setPriceLevel(2);
    setIsFeaturedField(false);
    setPhone("");
    setHours("");
    setMapUrl("");
    setInstagram("");
    setFacebook("");
    setDescription("");
    setEditingId(null);
  };

  // Auth + admin check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        // check role from /users/{uid}
        const userSnap = await (await import("firebase/firestore")).getDoc(
          doc(db, "users", u.uid)
        );
        const role = userSnap.exists() ? (userSnap.data() as any).role : null;
        const ok = role === "admin";
        setIsAdmin(ok);
        if (!ok) router.push("/dashboard");
      } catch (e) {
        console.error(e);
        router.push("/dashboard");
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = collection(db, "marketRestaurants");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const list: Restaurant[] = [];
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
          phone: data.phone || "",
          hours: data.hours || "",
          mapUrl: data.mapUrl || "",
          instagram: data.instagram || "",
          facebook: data.facebook || "",
          description: data.description || "",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      setItems(list);
    } catch (e) {
      console.error("Failed to load restaurants:", e);
      setError("Failed to load restaurants. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((r) => {
      const matchCity = cityFilter === "All" ? true : r.city === cityFilter;
      const matchSearch =
        !s ||
        r.name.toLowerCase().includes(s) ||
        (r.area || "").toLowerCase().includes(s) ||
        (r.address || "").toLowerCase().includes(s) ||
        (r.categories || []).join(",").toLowerCase().includes(s);
      return matchCity && matchSearch;
    });
  }, [items, search, cityFilter]);

  const openCreate = () => {
    setMode("create");
    resetForm();
    setOpen(true);
  };

  const openEdit = (r: Restaurant) => {
    setMode("edit");
    setEditingId(r.id);
    setName(r.name || "");
    setCity(r.city || CITY_OPTIONS[0]);
    setArea(r.area || "");
    setAddress(r.address || "");
    setImageUrl(r.imageUrl || "");
    setCategoriesCsv((r.categories || []).join(", "));
    setPriceLevel(r.priceLevel ?? 2);
    setIsFeaturedField(!!r.isFeatured);
    setPhone(r.phone || "");
    setHours(r.hours || "");
    setMapUrl(r.mapUrl || "");
    setInstagram(r.instagram || "");
    setFacebook(r.facebook || "");
    setDescription(r.description || "");
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!city.trim()) {
      setError("City is required.");
      return;
    }

    const payload = {
      name: name.trim(),
      city: city.trim(),
      area: area.trim() || null,
      address: address.trim() || null,
      imageUrl: imageUrl.trim() || null,
      categories: normalizeCategories(categoriesCsv),
      priceLevel: Number(priceLevel) || 2,
      isFeatured: !!isFeaturedField,
      phone: phone.trim() || null,
      hours: hours.trim() || null,
      mapUrl: mapUrl.trim() || null,
      instagram: instagram.trim() || null,
      facebook: facebook.trim() || null,
      description: description.trim() || null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (mode === "create") {
        await addDoc(collection(db, "marketRestaurants"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatus("Restaurant added ✅");
      } else {
        if (!editingId) return;
        await updateDoc(doc(db, "marketRestaurants", editingId), payload);
        setStatus("Restaurant updated ✅");
      }

      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      console.error("Save failed:", e);
      setError("Save failed. Check your Firestore rules (admin) and try again.");
    }
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete this restaurant? This cannot be undone.");
    if (!ok) return;

    setStatus(null);
    setError(null);

    try {
      await deleteDoc(doc(db, "marketRestaurants", id));
      setStatus("Restaurant deleted 🗑️");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
      setError("Delete failed. Make sure you're admin + rules allow delete.");
    }
  };

  if (authLoading) {
    return (
      <div className="page-fade">
        <p className="text-sm text-[var(--kh-text-secondary)]">Checking admin…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="kh-card card-hover">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
              Admin · Kabayan Market
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
              Restaurants Manager 🍽️
            </h1>
            <p className="mt-1 text-sm text-[var(--kh-text-secondary)]">
              Add / edit restaurants, set city filters, and keep it updated for Kabayans.
            </p>
          </div>

          <button
            onClick={openCreate}
            className="rounded-full bg-[var(--kh-yellow)] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105"
          >
            + Add Restaurant
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr,220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, area, category…"
            className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2.5 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          />
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2.5 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
          >
            <option value="All">All Cities</option>
            {CITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
      </header>

      {/* List */}
      <section className="kh-card card-hover">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            Restaurants ({filtered.length})
          </h2>
          <button
            onClick={load}
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-[var(--kh-text-secondary)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--kh-text-secondary)]">
            No restaurants found. Add your first one 🔥
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--kh-text)] truncate">
                      {r.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--kh-text-muted)]">
                      📍 {r.city}
                      {r.area ? ` · ${r.area}` : ""}
                      {r.isFeatured ? " · ⭐ Featured" : ""}
                    </p>

                    {(r.categories || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.categories!.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg)] px-2 py-0.5 text-[10px] text-[var(--kh-text-secondary)]"
                          >
                            {c}
                          </span>
                        ))}
                        {r.categories!.length > 4 && (
                          <span className="text-[10px] text-[var(--kh-text-muted)]">
                            +{r.categories!.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt={r.name}
                    className="mt-3 h-40 w-full rounded-2xl object-cover border border-[var(--kh-border)]"
                    loading="lazy"
                  />
                ) : (
                  <div className="mt-3 flex h-40 w-full items-center justify-center rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] text-xs text-[var(--kh-text-muted)]">
                    No image
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-5 shadow-[var(--kh-card-shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                  {mode === "create" ? "Create restaurant" : "Edit restaurant"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--kh-text)]">
                  {mode === "create" ? "Add a new spot" : "Update details"}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1.5 text-xs text-[var(--kh-text-secondary)]"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 grid gap-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Restaurant name *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="kh-input"
                    placeholder="e.g. Jollibee Riyadh Park"
                  />
                </Field>

                <Field label="City *">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="kh-input"
                  >
                    {CITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Area (optional)">
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="kh-input"
                    placeholder="e.g. Olaya / Malaz / Al Rawdah"
                  />
                </Field>

                <Field label="Hours (optional)">
                  <input
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="kh-input"
                    placeholder="e.g. 10 AM - 2 AM"
                  />
                </Field>
              </div>

              <Field label="Address (optional)">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="kh-input"
                  placeholder="Street, mall, landmark..."
                />
              </Field>

              <Field label="Image URL (optional)">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="kh-input"
                  placeholder="https://..."
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Categories (comma separated)">
                  <input
                    value={categoriesCsv}
                    onChange={(e) => setCategoriesCsv(e.target.value)}
                    className="kh-input"
                    placeholder="Filipino, BBQ, Seafood"
                  />
                  <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
                    Example: Filipino, BBQ, Halo-halo
                  </p>
                </Field>

                <Field label="Price level (1-3)">
                  <select
                    value={priceLevel}
                    onChange={(e) => setPriceLevel(Number(e.target.value))}
                    className="kh-input"
                  >
                    <option value={1}>1 (Affordable)</option>
                    <option value={2}>2 (Mid)</option>
                    <option value={3}>3 (Premium)</option>
                  </select>

                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--kh-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={isFeaturedField}
                      onChange={(e) => setIsFeaturedField(e.target.checked)}
                    />
                    Featured ⭐
                  </label>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Phone (optional)">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="kh-input"
                    placeholder="+966..."
                  />
                </Field>

                <Field label="Google Maps link (optional)">
                  <input
                    value={mapUrl}
                    onChange={(e) => setMapUrl(e.target.value)}
                    className="kh-input"
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Instagram URL (optional)">
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="kh-input"
                    placeholder="https://instagram.com/..."
                  />
                </Field>

                <Field label="Facebook URL (optional)">
                  <input
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    className="kh-input"
                    placeholder="https://facebook.com/..."
                  />
                </Field>
              </div>

              <Field label="Description (optional)">
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="kh-input"
                  placeholder="Short description..."
                />
              </Field>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-[var(--kh-yellow)] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105"
                >
                  {mode === "create" ? "Create" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--kh-text-secondary)] hover:brightness-105"
                >
                  Cancel
                </button>
              </div>
            </form>

            {imageUrl && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[var(--kh-text-muted)]">
                  Preview
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="mt-2 h-44 w-full rounded-2xl object-cover border border-[var(--kh-border)]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* local styles helpers */}
      <style jsx global>{`
        .kh-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid var(--kh-border);
          background: var(--kh-bg);
          padding: 10px 12px;
          color: var(--kh-text);
          outline: none;
          font-size: 14px;
        }
        .kh-input:focus {
          border-color: var(--kh-blue);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  );
}
