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

type PurchaseItem = {
  id: string;
  itemTitle: string;
  price: number;
  status?: "pending" | "redeemed";
  createdAt?: any;
  redeemedAt?: any;
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
  const [points, setPoints] = useState<number>(0);
  const [lastVisit, setLastVisit] = useState<Date | null>(null);
  const [lastDailyCheckin, setLastDailyCheckin] = useState<Date | null>(null);
  const [streak, setStreak] = useState<number>(0);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // ---------- LOAD USER + DASHBOARD DATA ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);
      setLoading(true);
      setError(null);

      try {
        // 1) user profile
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setDisplayName(u.email ?? "Kabayan");
          setPoints(0);
          setLastVisit(null);
          setLastDailyCheckin(null);
          setStreak(0);
        } else {
          const data = snap.data() as any;
          setDisplayName(data.displayName || u.email || "Kabayan");
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
          setStreak(data.dailyStreak ?? 0);
        }

        // 2) recent activity
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

        // 3) leaderboard
        const usersRef = collection(db, "users");
        const lbQ = query(usersRef, orderBy("points", "desc"), limit(10));
        const lbSnap = await getDocs(lbQ);

        const lb: LeaderEntry[] = [];
        lbSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          lb.push({
            id: docSnap.id,
            name: d.displayName || d.email || "Kabayan",
            points: d.points ?? 0,
          });
        });
        setLeaderboard(lb);

        // 4) purchases for this user
        setLoadingPurchases(true);
        const purRef = collection(db, "marketplacePurchases");
        const purQ = query(
          purRef,
          where("userId", "==", u.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const purSnap = await getDocs(purQ);

        const purList: PurchaseItem[] = [];
        purSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          purList.push({
            id: docSnap.id,
            itemTitle: d.itemTitle,
            price: d.price ?? 0,
            status: d.status ?? "pending",
            createdAt: d.createdAt ?? null,
            redeemedAt: d.redeemedAt ?? null,
          });
        });
        setPurchases(purList);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Failed to load your Kabayan stats. Please refresh.");
      } finally {
        setLoading(false);
        setLoadingPurchases(false);
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

      // streak logic (simple: if last checkin was yesterday -> +1, else 1)
      const now = new Date();
      let newStreak = 1;
      if (data.lastDailyCheckin && data.lastDailyCheckin.toDate) {
        const last = data.lastDailyCheckin.toDate() as Date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (isSameDay(last, yesterday)) {
          newStreak = (data.dailyStreak ?? 0) + 1;
        }
      }

      await Promise.all([
        updateDoc(userRef, {
          points: increment(DAILY_CHECKIN_POINTS),
          lastVisit: serverTimestamp(),
          lastDailyCheckin: serverTimestamp(),
          dailyStreak: newStreak,
        }),
        addDoc(collection(db, "users", user.uid, "activity"), {
          type: "daily_checkin",
          amount: DAILY_CHECKIN_POINTS,
          createdAt: serverTimestamp(),
        }),
      ]);

      setPoints(currentPoints + DAILY_CHECKIN_POINTS);
      setLastDailyCheckin(now);
      setStreak(newStreak);
      setStatus(
        `+${DAILY_CHECKIN_POINTS} KP from your daily Kabayan check-in! 🎉`
      );

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
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--kh-text)]">
              Hey,{" "}
              <span className="text-[var(--kh-yellow)]">{displayName}</span>
            </h1>
            <p className="text-sm text-[var(--kh-text-secondary)]">
              This is your Kabayan Hub profile. Check your rank, points, and
              recent activity. Tuloy lang sa pag-ipon ng Kabayan Points. 🇵🇭
            </p>
          </div>

          {/* tiny KP coin confetti */}
          <div className="hidden flex-col items-end gap-1 text-[10px] text-[var(--kh-text-muted)] md:flex">
            <div className="relative h-8 w-16">
              <span className="absolute left-1 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--kh-yellow)] text-[9px] font-bold text-slate-900 shadow">
                KP
              </span>
              <span className="absolute right-0 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--kh-blue-soft)] text-[8px] font-semibold text-[var(--kh-blue)]">
                +5
              </span>
              <span className="absolute left-6 bottom-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--kh-red-soft)] text-[8px] font-semibold text-[var(--kh-red)]">
                +15
              </span>
            </div>
            <span>Consistent ka ba? Check your streak below.</span>
          </div>
        </div>
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
        <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
          <div className="flex items-center justify-between gap-3">
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

        {/* Quick tips + daily check-in stacked */}
        <div className="grid gap-3 md:grid-rows-2">
          {/* Daily check-in card */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <div className="flex items-center justify-between gap-2">
              <div>
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
              </div>
              <div className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-emerald-50">
                Streak: {streak} day{streak === 1 ? "" : "s"}
              </div>
            </div>
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
                tutorial. Small steps, malaking ipon over time.
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-[var(--kh-yellow-soft)] px-4 py-3 text-xs text-[var(--kh-text)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide">
                Pro tip
              </p>
              <p className="mt-1">
                Share articles &amp; tutorials with friends. It&apos;s an easy
                way to stack extra KP while helping other Kabayans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Redeemed items + leaderboard side by side */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* My redeemed items */}
        <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                Your redeemed items
              </h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                A quick list of what you&apos;ve claimed from the Kabayan
                marketplace.
              </p>
            </div>
            {purchases.length > 0 && (
              <span className="rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--kh-text)]">
                {purchases.length} item{purchases.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingPurchases && (
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Loading your redemptions…
            </p>
          )}

          {!loadingPurchases && purchases.length === 0 && (
            <p className="text-xs text-[var(--kh-text-secondary)]">
              You haven&apos;t redeemed anything yet. Visit the marketplace to
              use your Kabayan Points.
            </p>
          )}

          {!loadingPurchases && purchases.length > 0 && (
            <ul className="mt-2 space-y-2 text-xs">
              {purchases.map((p) => {
                let dateText = "";
                if (p.createdAt && p.createdAt.toDate) {
                  const d = p.createdAt.toDate() as Date;
                  dateText =
                    d.toLocaleDateString() +
                    " · " +
                    d.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                }

                const isRedeemed = p.status === "redeemed";

                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-[var(--kh-text)]">
                        {p.itemTitle}
                      </p>
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        Spent {p.price ?? "?"} KP
                        {dateText ? " · " + dateText : ""}
                      </p>
                    </div>
                    <span
                      className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isRedeemed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isRedeemed ? "Redeemed" : "Pending"}
                    </span>
                  </li>
                );
              })}
            </ul>
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

      {/* Recent activity – full width at the bottom */}
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
            Walang activity pa. Try visiting the news, tutorials, or doing a
            daily check-in to start earning KP.
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
    </div>
  );
}
