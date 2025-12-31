"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";

// Optional image upload (Firebase Storage)
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../../../lib/firebase";

type Supermarket = {
  id: string;
  name: string;
  city?: string;
  imageUrl?: string;
};

type Product = {
  id: string;
  supermarketId: string;
  supermarketName?: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  inStock: boolean;
  createdAt?: any;
  updatedAt?: any;
};

const CATEGORIES = [
  "Noodles",
  "Snacks",
  "Canned Goods",
  "Frozen",
  "Drinks",
  "Spices & Sauces",
  "Rice & Grains",
  "Personal Care",
  "Others",
];

export default function AdminMarketProductsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [adminUid, setAdminUid] = useState<string | null>(null);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [inStock, setInStock] = useState(true);

  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Product>>({});

  const selectedSupermarket = useMemo(
    () => supermarkets.find((s) => s.id === selectedSupermarketId) || null,
    [supermarkets, selectedSupermarketId]
  );

  // 1) Admin gate
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const role = snap.exists() ? (snap.data() as any).role : null;

        if (role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setAdminUid(u.uid);
      } catch (e) {
        console.error(e);
        router.push("/dashboard");
        return;
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  // 2) Load supermarkets
  useEffect(() => {
    if (!adminUid) return;

    (async () => {
      setError(null);
      try {
        const refCol = collection(db, "marketSupermarkets");
        const q = query(refCol, orderBy("name", "asc"), limit(300));
        const snap = await getDocs(q);

        const list: Supermarket[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            name: data.name || "Unnamed",
            city: data.city || "",
            imageUrl: data.imageUrl || "",
          });
        });

        setSupermarkets(list);

        // auto select first supermarket
        if (!selectedSupermarketId && list.length > 0) {
          setSelectedSupermarketId(list[0].id);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load supermarkets.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUid]);

  // 3) Load products for selected supermarket
  useEffect(() => {
    if (!adminUid) return;
    if (!selectedSupermarketId) return;

    loadProducts(selectedSupermarketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUid, selectedSupermarketId]);

  const loadProducts = async (supermarketId: string) => {
    setLoadingProducts(true);
    setError(null);

    try {
      const refCol = collection(db, "marketProducts");

      // NOTE: This requires index sometimes when you add more filters.
      const q = query(
        refCol,
        where("supermarketId", "==", supermarketId),
        orderBy("createdAt", "desc"),
        limit(500)
      );

      const snap = await getDocs(q);

      const list: Product[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          supermarketId: data.supermarketId,
          supermarketName: data.supermarketName || "",
          name: data.name || "",
          price: Number(data.price || 0),
          category: data.category || "Others",
          imageUrl: data.imageUrl || "",
          description: data.description || "",
          inStock: data.inStock !== false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      setProducts(list);
    } catch (e: any) {
      console.error(e);
      if (String(e?.message || "").toLowerCase().includes("requires an index")) {
        setError(
          "This query needs a Firestore index. Click the index link in the console error, create it, then refresh."
        );
      } else {
        setError("Failed to load products.");
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setStatus(null);

    try {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `market/products/${selectedSupermarketId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
      setStatus("Image uploaded ✅");
    } catch (e) {
      console.error(e);
      setError("Failed to upload image. You can paste an Image URL instead.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (!selectedSupermarketId) {
      setError("Please select a supermarket first.");
      return;
    }
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    const p = parseFloat(price || "0");
    if (!p || p <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const refCol = collection(db, "marketProducts");

      const supermarketName =
        selectedSupermarket?.name ||
        supermarkets.find((s) => s.id === selectedSupermarketId)?.name ||
        "";

      const docRef = await addDoc(refCol, {
        supermarketId: selectedSupermarketId,
        supermarketName,
        name: name.trim(),
        price: p,
        category: category || "Others",
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        inStock,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setStatus("Product added ✅");
      setName("");
      setPrice("");
      setDescription("");
      setImageUrl("");
      setInStock(true);
      setCategory(CATEGORIES[0]);

      // optimistic update
      setProducts((prev) => [
        {
          id: docRef.id,
          supermarketId: selectedSupermarketId,
          supermarketName,
          name: name.trim(),
          price: p,
          category: category || "Others",
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          inStock,
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
      setError("Failed to add product.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditDraft({
      name: p.name,
      price: p.price,
      category: p.category,
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      inStock: p.inStock,
    });
    setStatus(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async (productId: string) => {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const refDoc = doc(db, "products", productId);

      const patch: any = {
        updatedAt: serverTimestamp(),
      };

      if (typeof editDraft.name === "string") patch.name = editDraft.name.trim();
      if (typeof editDraft.category === "string") patch.category = editDraft.category;
      if (typeof editDraft.description === "string")
        patch.description = editDraft.description.trim() || null;
      if (typeof editDraft.imageUrl === "string")
        patch.imageUrl = editDraft.imageUrl.trim() || null;
      if (typeof editDraft.inStock === "boolean") patch.inStock = editDraft.inStock;

      if (typeof editDraft.price !== "undefined") {
        const p = Number(editDraft.price);
        patch.price = isNaN(p) ? 0 : p;
      }

      await updateDoc(refDoc, patch);

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                name: (editDraft.name as string) ?? p.name,
                category: (editDraft.category as string) ?? p.category,
                description: (editDraft.description as string) ?? p.description,
                imageUrl: (editDraft.imageUrl as string) ?? p.imageUrl,
                inStock: (editDraft.inStock as boolean) ?? p.inStock,
                price: typeof editDraft.price !== "undefined" ? Number(editDraft.price) : p.price,
              }
            : p
        )
      );

      setStatus("Updated ✅");
      cancelEdit();
    } catch (e) {
      console.error(e);
      setError("Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (productId: string) => {
    if (!confirm("Delete this product?")) return;

    setError(null);
    setStatus(null);

    try {
      await deleteDoc(doc(db, "products", productId));
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setStatus("Deleted ✅");
    } catch (e) {
      console.error(e);
      setError("Failed to delete product.");
    }
  };

  if (checking) {
    return (
      <div className="kh-card">
        <p className="text-sm text-[var(--kh-text-secondary)]">Checking admin access…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/40 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-2">🛒</span>
          <span className="font-semibold uppercase tracking-wide">Admin · Market Products</span>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Add products to supermarkets
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Pick a supermarket, add products, then your public “Shop now” pages can filter correctly.
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

      {/* Controls */}
      <section className="kh-card card-hover space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Select supermarket
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={selectedSupermarketId}
              onChange={(e) => setSelectedSupermarketId(e.target.value)}
            >
              {supermarkets.length === 0 && <option value="">No supermarkets found</option>}
              {supermarkets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.city ? `• ${s.city}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
              Tip: product documents will store this supermarketId so “Shop now” can filter.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/market/supermarkets")}
            className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
          >
            Manage supermarkets →
          </button>
        </div>
      </section>

      {/* Add product */}
      <section className="kh-card card-hover">
        <h2 className="text-sm font-semibold text-[var(--kh-text)]">Add a product</h2>
        <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
          Upload an image or paste a URL. Both are okay.
        </p>

        <form onSubmit={handleAddProduct} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Product name *
            </label>
            <input
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lucky Me Pancit Canton"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Price (SAR) *
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 12.50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Category
            </label>
            <select
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Stock
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInStock(true)}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${
                  inStock
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                }`}
              >
                In stock
              </button>
              <button
                type="button"
                onClick={() => setInStock(false)}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${
                  !inStock
                    ? "border-red-500 bg-red-500/10 text-red-700"
                    : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                }`}
              >
                Out of stock
              </button>
            </div>
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Description (optional)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description…"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Upload image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              disabled={uploading}
            />
            <p className="text-[10px] text-[var(--kh-text-muted)]">
              {uploading ? "Uploading…" : "Uses Firebase Storage"}
            </p>
          </div>

          {/* Or paste image URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Or paste Image URL
            </label>
            <input
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {imageUrl && (
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
                <p className="text-[11px] font-semibold text-[var(--kh-text)]">Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="preview"
                  className="mt-2 h-40 w-full rounded-xl object-cover"
                />
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add product"}
            </button>
          </div>
        </form>
      </section>

      {/* Product list */}
      <section className="kh-card card-hover">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              Products in {selectedSupermarket?.name || "…"}
            </h2>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Tip: “Shop now” works because products have supermarketId.
            </p>
          </div>
          <span className="hidden rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)] md:inline-flex">
            {loadingProducts ? "Loading…" : `${products.length} items`}
          </span>
        </div>

        {loadingProducts && (
          <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">Loading products…</p>
        )}

        {!loadingProducts && products.length === 0 && (
          <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
            No products yet. Add your first product above ✅
          </p>
        )}

        {!loadingProducts && products.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {products.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3"
                >
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl || "/placeholder.png"}
                      alt={p.name}
                      className="h-16 w-16 rounded-xl object-cover border border-[var(--kh-border)] bg-[var(--kh-bg)]"
                    />

                    <div className="flex-1">
                      {!isEditing ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--kh-text)]">
                              {p.name}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                p.inStock
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-red-500/10 text-red-700"
                              }`}
                            >
                              {p.inStock ? "In stock" : "Out"}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
                            {p.category} • SAR {p.price.toLocaleString()}
                          </p>

                          {p.description && (
                            <p className="mt-2 text-xs text-[var(--kh-text-secondary)]">
                              {p.description}
                            </p>
                          )}

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => startEdit(p)}
                              className="flex-1 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeProduct(p.id)}
                              className="flex-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-600 hover:text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-2">
                            <input
                              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                              value={(editDraft.name as string) ?? ""}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, name: e.target.value }))
                              }
                              placeholder="Name"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                                value={String(editDraft.price ?? "")}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, price: e.target.value === "" ? undefined : Number(e.target.value), }))
                                }
                                placeholder="Price"
                              />
                              <select
                                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                                value={(editDraft.category as string) ?? "Others"}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, category: e.target.value }))
                                }
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <input
                              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                              value={(editDraft.imageUrl as string) ?? ""}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, imageUrl: e.target.value }))
                              }
                              placeholder="Image URL"
                            />

                            <textarea
                              rows={2}
                              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                              value={(editDraft.description as string) ?? ""}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, description: e.target.value }))
                              }
                              placeholder="Description"
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft((d) => ({ ...d, inStock: true }))
                                }
                                className={`flex-1 rounded-full border px-3 py-2 text-[11px] font-semibold ${
                                  editDraft.inStock
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                                    : "border-[var(--kh-border)] text-[var(--kh-text-secondary)]"
                                }`}
                              >
                                In stock
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft((d) => ({ ...d, inStock: false }))
                                }
                                className={`flex-1 rounded-full border px-3 py-2 text-[11px] font-semibold ${
                                  editDraft.inStock === false
                                    ? "border-red-500 bg-red-500/10 text-red-700"
                                    : "border-[var(--kh-border)] text-[var(--kh-text-secondary)]"
                                }`}
                              >
                                Out
                              </button>
                            </div>

                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => saveEdit(p.id)}
                                disabled={saving}
                                className="flex-1 rounded-full bg-[var(--kh-blue)] px-3 py-2 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="flex-1 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--kh-text)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
