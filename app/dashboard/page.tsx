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

// --- TYPES ---
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
  price?: number;
  status?: "pending" | "redeemed";
  createdAt?: any;
};

// --- CONSTANTS ---
const RANKS: RankInfo[] = [
  { title: "Bagong Salta", color: "#64748B", min: 0, max: 100 }, // Slate-500
  { title: "Bronze Kabayan", color: "#D97706", min: 100, max: 300 }, // Amber-600
  { title: "Silver Kabayan", color: "#475569", min: 300, max: 800 }, // Slate-600
  { title: "Gold Kabayan", color: "#CA8A04", min: 800, max: 2000 }, // Yellow-600
  { title: "Diamond OFW", color: "#0284C7", min: 2000, max: 5000 }, // Sky-600
  { title: "Legendary Kabayan", color: "#DC2626", min: 5000 }, // Red-600
];

const DAILY_CHECKIN_POINTS = 5;

// --- HELPERS ---
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
    case "daily_checkin": return "Daily check-in";
    case "news_read": return "Read news";
    case "news_share": return "Shared news";
    case "video_watched": return "Watched tutorial";
    case "video_share": return "Shared tutorial";
    case "market_redeem": return "Redeemed reward";
    default: return t.replace(/_/g, " ");
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

// --- COMPONENT ---
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // User Data
  const [displayName, setDisplayName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [lastVisit, setLastVisit] = useState<Date | null>(null);
  const [lastDailyCheckin, setLastDailyCheckin] = useState<Date | null>(null);
  
  // Lists
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [redeemedItems, setRedeemedItems] = useState<RedeemedItem[]>([]);

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  /* ─────────── Load user + stats ─────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setEmail(u.email ?? "");

      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setDisplayName(u.displayName ?? "");
          setUsername("");
          setPoints(0);
          setLastVisit(null);
          setLastDailyCheckin(null);
        } else {
          const data = snap.data() as any;
          setDisplayName(data.displayName || u.displayName || "");
          setUsername(data.username || "");
          setPoints(data.points ?? 0);
          setLastVisit(data.lastVisit?.toDate ? data.lastVisit.toDate() : null);
          setLastDailyCheckin(data.lastDailyCheckin?.toDate ? data.lastDailyCheckin.toDate() : null);
        }

        // Recent activity
        const actRef = collection(db, "users", u.uid, "activity");
        const actQ = query(actRef, orderBy("createdAt", "desc"), limit(20));
        const actSnap = await getDocs(actQ);
        const items: ActivityItem[] = [];
        actSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          items.push({ id: docSnap.id, type: d.type, amount: d.amount ?? 0, createdAt: d.createdAt ?? null });
        });
        setActivity(items);

        // Leaderboard
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

        // Redeemed items
        const redRef = collection(db, "marketplacePurchases");
        const redQ = query(redRef, where("userId", "==", u.uid), orderBy("createdAt", "desc"), limit(50));
        const redSnap = await getDocs(redQ);
        const list: RedeemedItem[] = [];
        redSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            itemId: d.itemId,
            itemTitle: d.itemTitle || "Unknown item",
            price: d.price,
            status: d.status || "pending",
            createdAt: d.createdAt,
          });
        });
        setRedeemedItems(list);
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
      <div className="flex h-64 w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const rank = getRank(points);
  const currentRank = rank.current;
  const nextRank = rank.next;
  const pointsToNext = nextRank && points < nextRank.min ? nextRank.min - points : 0;
  const hasCheckedInToday = isSameDay(lastDailyCheckin, new Date());
  const greetingName = username || displayName || email || "Kabayan";
  const avatarInitial = (username?.[0] || displayName?.[0] || email?.[0] || "K").toUpperCase();

  // Badges
  const learningCount = activity.filter((a) => ["news_read", "news_share", "video_watched", "video_share"].includes(a.type)).length;
  const redeemCount = activity.filter((a) => a.type === "market_redeem").length;

  const visibleActivity = showAllActivity ? activity : activity.slice(0, 5);

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
      setPoints((prev) => prev + DAILY_CHECKIN_POINTS);
      setLastDailyCheckin(new Date());
      setStatus(`+${DAILY_CHECKIN_POINTS} KP from your daily Kabayan check-in! 🎉`);
      setActivity((prev) => [
        { id: `local-${Date.now()}`, type: "daily_checkin", amount: DAILY_CHECKIN_POINTS, createdAt: null },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
      setError("Daily check-in failed. Please try again.");
    } finally {
      setCheckinLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 pt-4">
      
      {/* ───────── HEADER SECTION ───────── */}
      {/* Strong dark blue gradient for header only. White text. */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-blue-900 to-indigo-900 p-6 md:p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-5">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-3xl font-bold shadow-inner">
                {avatarInitial}
              </div>
              <div>
                 <p className="text-blue-200 text-sm font-medium mb-1 uppercase tracking-wider">Welcome back</p>
                 <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">{greetingName}</h1>
                 <p className="text-xs text-blue-100/80 mt-1 max-w-sm">
                   Stay active and keep earning!
                 </p>
              </div>
           </div>

           <div className="flex flex-col items-center md:items-end">
              <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold mb-1">Current Balance</span>
              <div className="flex items-center gap-2 bg-black/20 rounded-2xl px-4 py-2 border border-white/10">
                 <span className="text-4xl md:text-5xl font-black text-[#FCD116] drop-shadow-md">
                   {points}
                 </span>
                 <span className="text-xs font-bold bg-[#FCD116] text-slate-900 px-2 py-1 rounded-md">KP</span>
              </div>
           </div>
        </div>
      </section>

      {/* ───────── ALERTS ───────── */}
      {status && (
        <div className="animate-bounce-in rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm font-bold text-emerald-600 shadow-md flex items-center gap-3">
          <span className="text-2xl">🎉</span> {status}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-bold text-red-600 shadow-md">
          ⚠️ {error}
        </div>
      )}

      {/* ───────── MAIN ACTION GRID ───────── */}
      <section className="grid gap-6 md:grid-cols-12">
        
        {/* Left: RANK CARD (White Card / Dark Text) */}
        <div className="md:col-span-7 flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
          <div>
            <div className="flex justify-between items-start mb-6">
               <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Rank</h2>
                  {/* Color text matches rank color */}
                  <h3 className="text-2xl font-black mt-1" style={{ color: currentRank.color }}>
                    {currentRank.title}
                  </h3>
               </div>
               <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-sm">
                 🏆
               </div>
            </div>
            
            <div className="space-y-3">
               <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Progress to {nextRank?.title || "Max Level"}</span>
                  <span>{Math.round(rank.progress)}%</span>
               </div>
               {/* Progress Bar background needs to be light grey, not dark */}
               <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden inner-shadow">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                    style={{ width: `${rank.progress}%` }}
                  />
               </div>
               <p className="text-xs text-right text-slate-400 font-medium">
                 {pointsToNext > 0 ? `${pointsToNext} KP to go!` : "Max rank achieved!"}
               </p>
            </div>
          </div>
        </div>

        {/* Right: DAILY CHECK-IN (Colored Card / White Text) */}
        {/* Use a vibrant gradient background here to make it stand out as a button */}
        <div className="group relative md:col-span-5 flex flex-col justify-center items-center text-center rounded-[2rem] bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-xl shadow-emerald-500/20 overflow-hidden">
           {/* Decorative circles */}
           <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
           
           <h2 className="relative z-10 text-lg font-bold text-white mb-1">Daily Check-in</h2>
           <p className="relative z-10 text-xs text-emerald-100 mb-5 font-medium">Get your free +{DAILY_CHECKIN_POINTS} KP now!</p>
           
           <button
             onClick={handleDailyCheckin}
             disabled={checkinLoading || hasCheckedInToday}
             className={`relative z-10 w-full py-3.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${
               hasCheckedInToday 
                 ? "bg-emerald-800/30 text-emerald-100 cursor-default border border-white/10"
                 : "bg-white text-emerald-600 hover:bg-emerald-50 hover:shadow-xl"
             }`}
           >
             {hasCheckedInToday ? "Checked In ✅" : checkinLoading ? "Claiming..." : "Claim Points 👆"}
           </button>
           
           {lastDailyCheckin && (
             <p className="relative z-10 text-[10px] text-emerald-100/70 mt-3 font-medium">
               Last: {lastDailyCheckin.toLocaleDateString()}
             </p>
           )}
        </div>
      </section>

      {/* ───────── STATS & BADGES (Fixed Contrast) ───────── */}
      {/* Light Backgrounds -> DARK Text (Not white text) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="p-4 rounded-[1.5rem] bg-blue-50 border border-blue-100 text-center shadow-sm hover:-translate-y-1 transition-transform">
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-lg font-black text-blue-900">{hasCheckedInToday ? "Active" : "Inactive"}</div>
            <div className="text-[10px] text-blue-600 uppercase font-bold tracking-wide">Streak Status</div>
         </div>
         <div className="p-4 rounded-[1.5rem] bg-purple-50 border border-purple-100 text-center shadow-sm hover:-translate-y-1 transition-transform">
            <div className="text-2xl mb-1">📚</div>
            <div className="text-lg font-black text-purple-900">{learningCount}</div>
            <div className="text-[10px] text-purple-600 uppercase font-bold tracking-wide">Lessons Taken</div>
         </div>
         <div className="p-4 rounded-[1.5rem] bg-orange-50 border border-orange-100 text-center shadow-sm hover:-translate-y-1 transition-transform">
            <div className="text-2xl mb-1">🎁</div>
            <div className="text-lg font-black text-orange-900">{redeemCount}</div>
            <div className="text-[10px] text-orange-600 uppercase font-bold tracking-wide">Rewards Claimed</div>
         </div>
         <div className="p-4 rounded-[1.5rem] bg-pink-50 border border-pink-100 text-center shadow-sm hover:-translate-y-1 transition-transform">
            <div className="text-2xl mb-1">⭐️</div>
            <div className="text-lg font-black text-pink-900">{points}</div>
            <div className="text-[10px] text-pink-600 uppercase font-bold tracking-wide">Total KP</div>
         </div>
      </section>

      {/* ───────── LEADERBOARD & REDEEMED ───────── */}
      <section className="grid gap-6 md:grid-cols-2">
        
        {/* LEADERBOARD (White Card) */}
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/40">
           <div className="flex items-center gap-3 mb-6">
              <span className="bg-yellow-100 text-yellow-700 p-2.5 rounded-xl text-xl">👑</span>
              <h2 className="font-bold text-lg text-slate-800">Top Kabayans</h2>
           </div>
           
           <div className="space-y-3">
             {leaderboard.length === 0 ? (
                <p className="text-xs text-center py-4 text-slate-400">No data yet.</p>
             ) : (
                leaderboard.map((entry, index) => {
                   const isMe = user && entry.id === user.uid;
                   const medals = ["🥇", "🥈", "🥉"];
                   const rankIcon = medals[index] || <span className="text-xs font-bold text-slate-400">#{index+1}</span>;
                   
                   return (
                     <div key={entry.id} className={`flex items-center justify-between p-3 rounded-2xl transition-colors ${
                       isMe ? "bg-yellow-50 border border-yellow-200 shadow-sm" : "bg-slate-50 border border-transparent"
                     }`}>
                        <div className="flex items-center gap-3">
                           <div className="w-8 text-center text-lg">{rankIcon}</div>
                           <span className={`text-sm ${isMe ? "font-bold text-yellow-900" : "font-medium text-slate-700"}`}>
                             {entry.name} {isMe && "(You)"}
                           </span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                           isMe ? "bg-yellow-200 text-yellow-800" : "bg-white text-slate-600"
                        }`}>
                          {entry.points} KP
                        </span>
                     </div>
                   )
                })
             )}
           </div>
        </div>

        {/* REDEEMED ITEMS (White Card) */}
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/40">
           <div className="flex items-center gap-3 mb-6">
              <span className="bg-purple-100 text-purple-700 p-2.5 rounded-xl text-xl">🛍️</span>
              <h2 className="font-bold text-lg text-slate-800">My Rewards</h2>
           </div>

           <div className="space-y-3">
             {redeemedItems.length === 0 ? (
               <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-100">
                 <p className="text-xs text-slate-400 font-medium">No items redeemed yet.</p>
                 <button onClick={() => router.push('/marketplace')} className="mt-2 text-xs font-bold text-blue-600 hover:underline">
                   Go to Marketplace
                 </button>
               </div>
             ) : (
               redeemedItems.map((item) => (
                 <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                       <p className="text-sm font-bold text-slate-700">{item.itemTitle}</p>
                       <p className="text-[10px] text-slate-400 font-medium">
                         {item.createdAt?.toDate().toLocaleDateString()}
                       </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide ${
                      item.status === 'redeemed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status === 'redeemed' ? 'Sent' : 'Pending'}
                    </span>
                 </div>
               ))
             )}
           </div>
        </div>
      </section>

      {/* ───────── ACTIVITY LOG (White Card / Clean List) ───────── */}
      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/40">
         <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-slate-800">Activity History</h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase">
               Last {visibleActivity.length} Items
            </span>
         </div>

         <div className="space-y-1">
           {activity.length === 0 ? (
             <p className="text-sm text-center py-6 text-slate-400">Walang activity pa. Start exploring!</p>
           ) : (
             visibleActivity.map((a) => {
               const created = a.createdAt && (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : null;
               const isPositive = a.amount >= 0;
               
               return (
                 <div key={a.id} className="flex items-center justify-between py-3 px-3 hover:bg-slate-50 rounded-xl transition-colors group">
                    <div className="flex items-center gap-4">
                       <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-sm ${
                         isPositive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-orange-50 text-orange-600 border border-orange-100"
                       }`}>
                         {isPositive ? "📥" : "📤"}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                            {formatActivityType(a.type)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {created ? created.toLocaleString() : "Just now"}
                          </p>
                       </div>
                    </div>
                    <div className={`font-black text-sm ${isPositive ? "text-emerald-600" : "text-slate-400"}`}>
                       {isPositive ? "+" : ""}{a.amount} KP
                    </div>
                 </div>
               )
             })
           )}
         </div>

         {activity.length > 5 && (
           <div className="mt-6 text-center border-t border-slate-100 pt-4">
             <button 
               onClick={() => setShowAllActivity(!showAllActivity)}
               className="text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-full transition-all"
             >
               {showAllActivity ? "Show Less" : "View Older Activity ↓"}
             </button>
           </div>
         )}
      </section>

    </div>
  );
}