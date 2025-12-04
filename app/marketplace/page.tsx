// app/marketplace/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../lib/firebase";

type MarketplaceItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  tag?: string;
  price: number; // KP cost
  stock?: number; // remaining stock
};

const ADMIN_WHATSAPP = "966500000000"; // 👈 REPLACE with your real WhatsApp (no +, no spaces)
const ADMIN_EMAIL = "admin@kabayanhub.com"; // 👈 REPLACE with your real email

export default function MarketplacePage() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [redeemLoadingId, setRedeemLoadingId] = useState<string | null>(null);

  // for success popup
  const [redeemSuccess, setRedeemSuccess] = useState<{
    title: string;
    price: number;
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const data = snap.data() as any;
        setPoints(data?.points ?? 0);
      } else {
        setPoints(null);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const ref = collection(db, "marketplaceItems");
        const q = query(ref, orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);

        const list: MarketplaceItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            title: data.title,
            description: data.description,
            imageUrl: data.imageUrl || null,
            tag: data.tag,
            price: data.price ?? 50,
            stock: data.stock ?? null,
          });
        });

        setItems(list);
      } catch (err) {
        console.error("Failed to load marketplace items:", err);
        setStatus("Failed to load marketplace. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const ensureLoggedIn = () => {
    if (!user) {
      setStatus("Log in to redeem Kabayan Points in the marketplace.");
      router.push("/login");
      return false;
    }
    return true;
  };

  const handleRedeem = async (item: MarketplaceItem) => {
    if (!ensureLoggedIn() || !user) return;
    setStatus(null);

    setRedeemLoadingId(item.id);

    try {
      const userRef = doc(db, "users", user.uid);
      const itemRef = doc(db, "marketplaceItems", item.id);

      // Re-read fresh data
      const [userSnap, itemSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(itemRef),
      ]);

      if (!userSnap.exists() || !itemSnap.exists()) {
        setStatus("Item or user not found.");
        setRedeemLoadingId(null);
        return;
      }

      const userData = userSnap.data() as any;
      const itemData = itemSnap.data() as any;

      const currentPoints = userData.points ?? 0;
      const price = itemData.price ?? item.price ?? 50;
      const stock = itemData.stock ?? item.stock ?? null;

      if (stock !== null && stock <= 0) {
        setStatus("This item is already sold out.");
        setRedeemLoadingId(null);
        return;
      }

      if (currentPoints < price) {
        setStatus("Not enough Kabayan Points to redeem this item.");
        setRedeemLoadingId(null);
        return;
      }

      const newPoints = currentPoints - price;
      const newStock = stock !== null ? stock - 1 : stock;

      await Promise.all([
        updateDoc(userRef, {
          points: increment(-price),
          lastVisit: serverTimestamp(),
        }),
        updateDoc(itemRef, {
          ...(stock !== null ? { stock: newStock } : {}),
        }),
        addDoc(collection(db, "users", user.uid, "activity"), {
          type: "market_redeem",
          refId: item.id,
          title: item.title,
          amount: -price,
          createdAt: serverTimestamp(),
        }),
          addDoc(collection(db, "marketplacePurchases"), {
            userId: user.uid,
            userEmail: user.email || null,
            userDisplayName: user.email || null,
            itemId: item.id,
            itemTitle: item.title,
            price: price,
            status: "pending",          // 🆕 new field
            redeemedAt: null,           // 🆕 new field
            createdAt: serverTimestamp(),
        }),
      ]);

      setPoints(newPoints);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, stock: newStock }
            : it
        )
      );

      // show nice success popup
      setRedeemSuccess({ title: item.title, price });
      setStatus(null); // we don't need text status anymore, modal will handle
    } catch (err) {
      console.error("Failed to redeem item:", err);
      setStatus("Failed to redeem this item. Please try again.");
    } finally {
      setRedeemLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          Kabayan Marketplace
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Use your Kabayan Points to redeem digital perks, tools, and future
          rewards curated for OFWs. Limited stocks per item, so unahan na.
        </p>

        {points !== null && (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-3 py-1 text-[11px]">
            <span className="text-[var(--kh-text-muted)]">Your balance:</span>
            <span className="rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-[11px] font-semibold text-slate-900">
              {points} KP
            </span>
          </div>
        )}
      </header>

      {status && (
        <p className="text-[11px] text-emerald-600 md:text-xs">{status}</p>
      )}

      {loading && (
        <p className="text-sm text-[var(--kh-text-secondary)]">
          Loading marketplace…
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-[var(--kh-text-secondary)]">
          No marketplace items yet. Add some items from the admin panel.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const isSoldOut =
            item.stock !== null && item.stock !== undefined && item.stock <= 0;

          return (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]"
            >
              <div className="space-y-2">
                {item.imageUrl && (
                  <div className="mb-2 h-32 w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {item.tag && (
                  <span className="inline-flex rounded-full bg-[var(--kh-blue-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--kh-blue)]">
                    {item.tag}
                  </span>
                )}

                <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
                  {item.title}
                </h2>
                {item.description && (
                  <p className="text-xs text-[var(--kh-text-secondary)] md:text-sm">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="space-y-1">
                  <p className="text-[var(--kh-text-secondary)]">
                    Cost:{" "}
                    <span className="font-semibold text-[var(--kh-yellow)]">
                      {item.price} KP
                    </span>
                  </p>
                  {item.stock !== null && item.stock !== undefined && (
                    <p
                      className={`text-[10px] ${
                        isSoldOut
                          ? "text-red-500"
                          : "text-[var(--kh-text-muted)]"
                      }`}
                    >
                      Stock:{" "}
                      <span className="font-semibold">
                        {item.stock > 0 ? item.stock : "Sold out"}
                      </span>
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleRedeem(item)}
                  disabled={isSoldOut || redeemLoadingId === item.id}
                  className={`rounded-full px-4 py-1.5 text-[11px] font-semibold transition ${
                    isSoldOut
                      ? "cursor-not-allowed bg-[var(--kh-bg-subtle)] text-[var(--kh-text-muted)]"
                      : "bg-[var(--kh-blue)] text-white hover:brightness-110"
                  }`}
                >
                  {isSoldOut
                    ? "Sold out"
                    : redeemLoadingId === item.id
                    ? "Redeeming…"
                    : "Redeem"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* SUCCESS POPUP MODAL */}
      {redeemSuccess && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--kh-bg-card)] p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              Thanks for redeeming! 🎉
            </h2>
            <p className="mt-2 text-xs text-[var(--kh-text-secondary)]">
              You redeemed{" "}
              <span className="font-semibold">{redeemSuccess.title}</span> for{" "}
              <span className="font-semibold">
                {redeemSuccess.price} Kabayan Points
              </span>
              . If this item needs coordination, you can contact the Kabayan Hub
              admin below.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
                  `Hi Kabayan Hub, I redeemed "${redeemSuccess.title}" using my account and would like to claim it.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
              >
                WhatsApp admin
              </a>
              <a
                href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(
                  `Kabayan Hub redemption – ${redeemSuccess.title}`
                )}&body=${encodeURIComponent(
                  `Hi Kabayan Hub,\n\nI redeemed "${redeemSuccess.title}" and would like to claim the reward.\n\nSalamat!\n`
                )}`}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
              >
                Email admin
              </a>
            </div>

            <button
              onClick={() => setRedeemSuccess(null)}
              className="mt-3 w-full rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1.5 text-[11px] text-[var(--kh-text-muted)] hover:bg-[var(--kh-bg-card)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
