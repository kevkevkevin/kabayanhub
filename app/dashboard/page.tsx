// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  limit,
  updateDoc,
  addDoc,
  increment,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type ActivityItem = {
  id: string;
  type: string;
  amount: number;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

type RankInfo = {
  title: string;
  color: string;
  min: number;
  max?: number;
};

type LeaderEntry = {
  id: string;
  name: string;
  points: number;
};

type RedeemedItem = {
  id: string;
  itemId: string;
  itemTitle: string;
  price?: number | null;
  status?: string | null; // "pending" | "redeemed" | etc.
  createdAt?: any;
};

const RANKS: RankInfo[] = [
  { title: "Bagong Salta", color: "#94A3B8", min: 0, max: 100 },
  { title: "Bronze Kabayan", color: "#B45309", min: 100, max: 300 },
  { title: "Silver Kabayan", color: "#4B5563", min: 300, max: 800 },
  { title: "Gold Kabayan", color: "#FCD116", min: 800, max: 2000 },
  { title: "Diamond OFW", color: "#7DD3FC", min: 2000, max: 5000 },
  { title: "Legendary Kabayan", color: "#F97373", min: 5000 },
];

const DAILY_CHECKIN_POINTS = 5;

function getRank(points: number): {
  current: RankInfo;
  next?: RankInfo;
  progress: number;
} {
  let current = RANKS[0];
  let next: RankInfo | undefined;

  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i];
    const aboveMin = points >= r.min;
    const belowMax = r.max === undefined || points < r.max;

    if (aboveMin && belowMax) {
      current = r;
      next = RANKS[i + 1];
      break;
    }
  }

  if (!next) {
    return { current, next: undefined, progress: 100 };
  }

  const range = (next.min ?? points) - current.min;
  const within = Math.min(Math.max(points - current.min, 0), range);
  const pct = range === 0 ? 0 : (within / range) * 100;

  return { current, next, progress: pct };
}

function formatActivityType(t: string): string {
  switch (t) {
    case "daily_checkin":
      return "Daily check-in";
    case "news_read":
      return "Read news";
    case "news_share":
      return "Shared news";
    case "video_watched":
      return "Watched tutorial";
    case "video_share":
      return "Shared tutorial";
    case "market_redeem":
      return "Redeemed from marketplace";
    case "arabic_quiz":
      return "Arabic quiz";
    default:
      return t.replace(/_/g, " ");
  }
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [lastVisit, setLastVisit] = useState<Date | null>(null);
  const [lastDailyCheckin, setLastDailyCheckin] = useState<Date | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [redeemedItems, setRedeemedItems] = useState<RedeemedItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);

      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setDisplayName(u.email ?? "Kabayan");
          setEmail(u.email || "");
          setPoints(0);
          setLastVisit(null);
          setLastDailyCheckin(null);
        } else {
          const data = snap.data() as any;
          setDisplayName(
            data.username || data.displayName || u.email || "Kabayan"
          );
          setEmail(data.email || u.email || "");
          setPoints(data.points ?? 0);
          setLastVisit(
            data.lastVisit && data.lastVisit.toDate
              ? data.lastVisit.toDate()
              : null
          );
          setLastDailyCheckin(
            data.lastDailyCheckin && data.lastDailyCheckin.toDate
              ? data.lastDailyCheckin.toDate()
              : null
          );
        }

        // Recent activity
        const actRef = collection(db, "users", u.uid, "activity");
        const actQ = query(actRef, orderBy("createdAt", "desc"), limit(10));
        const actSnap = await getDocs(actQ);

        const items: ActivityItem[] = [];
        actSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          items.push({
            id: docSnap.id,
            type: d.type,
            amount: d.amount ?? 0,
            createdAt: d.createdAt ?? null,
          });
        });
        setActivity(items);

        // Leaderboard (top 10)
        const usersRef = collection(db, "users");
        const lbQ = query(usersRef, orderBy("points", "desc"), limit(10));
        const lbSnap = await getDocs(lbQ);

        const lb: LeaderEntry[] = [];
        lbSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          lb.push({
            id: docSnap.id,
            name: d.username || d.displayName || d.email || "Kabayan",
            points: d.points ?? 0,
          });
        });
        setLeaderboard(lb);

        // My redeemed marketplace items
        const purchasesRef = collection(db, "marketplacePurchases");
        const purchasesQ = query(
          purchasesRef,
          where("userId", "==", u.uid),
          orderBy("createdAt", "desc"),
          limit(15)
        );
        const purchasesSnap = await getDocs(purchasesQ);

        const redeemed: RedeemedItem[] = [];
        purchasesSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          redeemed.push({
            id: docSnap.id,
            itemId: d.itemId,
            itemTitle: d.itemTitle || "Unknown item",
            price: d.price ?? null,
            status: d.status || "pending",
            createdAt: d.createdAt,
          });
        });
        setRedeemedItems(redeemed);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Failed to load your Kabayan stats. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (!user && loading) {
    return (
      <p className="text-sm text-[var(--kh-text-secondary)]">
        Loading your Kabayan stats…
      </p>
    );
  }

  const rank = getRank(points);
  const currentRank = rank.current;
  const nextRank = rank.next;
  const pointsToNext =
    nextRank && points < nextRank.min ? nextRank.min - points : 0;

  const hasCheckedInToday = isSameDay(lastDailyCheckin, new Date());

  const handleDailyCheckin = async () => {
    if (!user) return;
    setStatus(null);

    if (hasCheckedInToday) {
      setStatus("You already did your daily check-in today. Balik bukas ulit 🫶");
      return;
    }

    setCheckinLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setError("User record not found. Please log out and log in again.");
        setCheckinLoading(false);
        return;
      }

      const data = snap.data() as any;
      const currentPoints = data.points ?? 0;
      const now = new Date();

      await Promise.all([
        updateDoc(userRef, {
          points: increment(DAILY_CHECKIN_POINTS),
          lastVisit: serverTimestamp(),
          lastDailyCheckin: serverTimestamp(),
        }),
        addDoc(collection(db, "users", user.uid, "activity"), {
          type: "daily_checkin",
          amount: DAILY_CHECKIN_POINTS,
          createdAt: serverTimestamp(),
        }),
      ]);

      setPoints(currentPoints + DAILY_CHECKIN_POINTS);
      setLastDailyCheckin(now);
      setStatus(`+${DAILY_CHECKIN_POINTS} KP from your daily Kabayan check-in! 🎉`);

      // Optimistically prepend activity
      setActivity((prev) => [
        {
          id: `local-checkin-${Date.now()}`,
          type: "daily_checkin",
          amount: DAILY_CHECKIN_POINTS,
          createdAt: null,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("Daily check-in failed:", err);
      setError("Daily check-in failed. Please try again.");
    } finally {
      setCheckinLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
          Hey,{" "}
          <span className="text-[var(--kh-yellow)]">
            {displayName || "Kabayan"}
          </span>
        </h1>
        {email && (
          <p className="text-[11px] text-[var(--kh-text-muted)]">
            Signed in as{" "}
            <span className="font-medium text-[var(--kh-text-secondary)]">
              {email}
            </span>
          </p>
        )}
        <p className="text-sm text-[var(--kh-text-secondary)]">
          This is your Kabayan Hub profile. Check your rank, points, and recent
          activity. Tuloy lang sa pag-ipon ng Kabayan Points. 🇵🇭
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

      {/* Top summary row */}
      <section className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
        {/* Rank + progress */}
        <div className="relative rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] overflow-hidden">
          {/* Tiny KP coin confetti */}
          <div className="pointer-events-none absolute -top-3 right-6 flex gap-1 text-[11px] opacity-60">
            <span>🪙</span>
            <span>🪙</span>
            <span>🪙</span>
          </div>

          <div className="flex items-center justify-between gap-3 relative">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                Kabayan Rank
              </p>
              <p
                className="mt-1 text-lg font-semibold"
                style={{ color: currentRank.color }}
              >
                {currentRank.title}
              </p>
              {nextRank ? (
                <p className="mt-1 text-[11px] text-[var(--kh-text-secondary)]">
                  {pointsToNext > 0 ? (
                    <>
                      {pointsToNext} KP more to reach{" "}
                      <span className="font-semibold">{nextRank.title}</span>.
                    </>
                  ) : (
                    <>You&apos;re close to the next rank!</>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--kh-text-secondary)]">
                  You are at the highest Kabayan rank. Respect! 🫡
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-right text-[11px]">
              <p className="text-[var(--kh-text-muted)]">Kabayan Points</p>
              <p className="mt-1 inline-flex items-baseline gap-1 rounded-full bg-[var(--kh-yellow)] px-3 py-1 text-sm font-bold text-slate-900">
                {points}
                <span className="text-[10px] font-semibold">KP</span>
              </p>
              {lastVisit && (
                <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                  Last active: {lastVisit.toLocaleDateString()}{" "}
                  {lastVisit.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--kh-text-muted)]">
              <span>Progress to next rank</span>
              <span>{Math.round(rank.progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg-subtle)]">
              <div
                className="h-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)] transition-[width]"
                style={{ width: `${rank.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Daily check-in + tips */}
        <div className="grid gap-3 md:grid-rows-2">
          {/* Daily check-in card with streak hint */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              Daily Kabayan check-in
            </p>
            <p className="mt-1">
              Hit this once a day para may guaranteed{" "}
              <span className="font-semibold">
                +{DAILY_CHECKIN_POINTS} Kabayan Points
              </span>{" "}
              kahit busy ka.
            </p>
            {lastDailyCheckin && (
              <p className="mt-1 text-[10px] text-emerald-800">
                Last check-in:{" "}
                {lastDailyCheckin.toLocaleDateString()}{" "}
                {lastDailyCheckin.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}

            <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-800">
              <span>🔥</span>
              <span>
                Tip: do check-in + 1 news + 1 tutorial daily para may mini
                &quot;streak&quot; routine ka.
              </span>
            </div>

            <button
              onClick={handleDailyCheckin}
              disabled={checkinLoading || hasCheckedInToday}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
            >
              {hasCheckedInToday
                ? "Checked in for today ✅"
                : checkinLoading
                ? "Checking in…"
                : "Check in & earn KP"}
            </button>
          </div>

          {/* Quick tips */}
          <div className="grid gap-3 md:grid-cols-2 md:grid-rows-1">
            <div className="rounded-2xl border border-blue-100 bg-[var(--kh-blue-soft)] px-4 py-3 text-xs text-[var(--kh-blue)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide">
                Daily routine
              </p>
              <p className="mt-1">
                1) Daily check-in. 2) Read at least one news. 3) Watch one
                tutorial or do the Arabic quiz.
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-[var(--kh-yellow-soft)] px-4 py-3 text-xs text-[var(--kh-text)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide">
                Pro tip
              </p>
              <p className="mt-1">
                Share articles &amp; tutorials with friends. Easy extra KP while
                helping other Kabayans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity (full width) */}
      <section className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              Recent Kabayan activity
            </h2>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              The last things you did that earned (or spent) Kabayan Points.
            </p>
          </div>
          <span className="hidden rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)] md:inline-flex">
            Showing last {activity.length} actions
          </span>
        </div>

        {activity.length === 0 && (
          <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
            Walang activity pa. Try visiting the news, tutorials, mini-games, or
            doing a daily check-in to start earning KP.
          </p>
        )}

        {activity.length > 0 && (
          <div className="mt-3 space-y-2 text-xs">
            {activity.map((a) => {
              const created =
                a.createdAt && (a.createdAt as any).toDate
                  ? (a.createdAt as any).toDate()
                  : null;

              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--kh-text)]">
                      {formatActivityType(a.type)}
                    </span>
                    {created && (
                      <span className="text-[10px] text-[var(--kh-text-muted)]">
                        {created.toLocaleDateString()}{" "}
                        {created.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-semibold ${
                        a.amount >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {a.amount >= 0 ? "+" : ""}
                      {a.amount} KP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom row: My redeemed items + leaderboard */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* My redeemed items */}
        <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            My redeemed items
          </h2>
          <p className="text-[11px] text-[var(--kh-text-muted)]">
            Items you redeemed from the Kabayan Marketplace. Status updates are
            managed by the admin.
          </p>

          {redeemedItems.length === 0 && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
              Wala ka pang na-redeem. Check the marketplace and try claiming a
              reward using your Kabayan Points.
            </p>
          )}

          {redeemedItems.length > 0 && (
            <div className="mt-3 space-y-2 text-xs">
              {redeemedItems.map((item) => {
                let created: Date | null = null;
                if (item.createdAt && item.createdAt.toDate) {
                  created = item.createdAt.toDate();
                }

                const statusLabel = (item.status || "pending").toLowerCase();
                const isDone =
                  statusLabel === "redeemed" || statusLabel === "completed";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                  >
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-medium text-[var(--kh-text)]">
                        {item.itemTitle}
                      </p>
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        {item.price != null ? `${item.price} KP` : "—"}{" "}
                        {created && (
                          <>
                            {" · "}
                            {created.toLocaleDateString()}{" "}
                            {created.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                        isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isDone ? "Redeemed" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global leaderboard */}
        <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                Kabayan leaderboard
              </h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                Top Kabayans by total Kabayan Points. Grind para umakyat dito. 💪
              </p>
            </div>
          </div>

          {leaderboard.length === 0 && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
              No leaderboard data yet. Earn some points and you&apos;ll start to
              see names here.
            </p>
          )}

          {leaderboard.length > 0 && (
            <div className="mt-3 overflow-x-auto text-xs">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-[var(--kh-text-muted)]">
                    <th className="pb-2 pr-3">Rank</th>
                    <th className="pb-2 pr-3">Kabayan</th>
                    <th className="pb-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => {
                    const isMe = user && entry.id === user.uid;
                    const rankNumber = index + 1;
                    const medal =
                      rankNumber === 1
                        ? "🥇"
                        : rankNumber === 2
                        ? "🥈"
                        : rankNumber === 3
                        ? "🥉"
                        : " ";

                    return (
                      <tr
                        key={entry.id}
                        className={`border-t border-[var(--kh-border)] ${
                          isMe ? "bg-[var(--kh-yellow-soft)]/80" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 text-[11px] text-[var(--kh-text-secondary)]">
                          {medal} {rankNumber}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-[var(--kh-text)]">
                          {entry.name}
                          {isMe && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Ikaw ito
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-[11px] font-semibold text-[var(--kh-text)]">
                          {entry.points} KP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
