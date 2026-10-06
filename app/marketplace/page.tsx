// app/marketplace/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { auth,db } from "../../lib/backend";
import { onAuthStateChanged } from "../../lib/backend/auth";
import {
collection,
doc,
getDoc,
getDocs,
limit,
orderBy,
query
} from "../../lib/backend/db";
import { redeemItem } from "../../lib/backend/rewards";

type MarketplaceItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  tag?: string;
  price: number; // KP cost
  stock?: number | null; // null means unlimited stock
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
      const result = await redeemItem(item.id);
      const newPoints = result.points;
      const newStock = result.stock;
      const price = result.price;

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
        <p className="kh-eyebrow">A LITTLE SOMETHING FOR YOUR EVERYDAY</p>
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          Your points. Your possibilities.
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
      <nav className="kh-market-links" aria-label="Explore the market">
        <Link href="/market/jobs">Find a job <span aria-hidden="true">↗</span></Link>
        <Link href="/market/restaurants">Pinoy restaurants <span aria-hidden="true">↗</span></Link>
        <Link href="/market/supermarkets">Supermarkets <span aria-hidden="true">↗</span></Link>
      </nav>

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
          New rewards are on their way. Check back soon to see what’s available.
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
                  <div className="mb-2 aspect-square w-full overflow-hidden rounded-xl bg-[var(--kh-bg-subtle)]">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      width={1080}
                      height={1080}
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
