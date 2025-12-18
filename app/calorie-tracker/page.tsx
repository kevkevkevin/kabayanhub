"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type CalorieEntry = {
  id: string;
  food: string;
  calories: number;
  protein?: number;
  mealType: MealType;
  date: string; // YYYY-MM-DD
  createdAt?: any;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CalorieTrackerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form
  const [food, setFood] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [date, setDate] = useState(todayISO());

  // goals
  const [goalCalories, setGoalCalories] = useState<string>("");
  const [goalProtein, setGoalProtein] = useState<string>("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);

      try {
        // load goals from user doc
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          if (typeof data.calorieGoalDaily === "number") setGoalCalories(String(data.calorieGoalDaily));
          if (typeof data.proteinGoalDaily === "number") setGoalProtein(String(data.proteinGoalDaily));
        }

        // load entries
        const ref = collection(db, "users", u.uid, "calorieEntries");
        const q = query(ref, orderBy("date", "desc"), orderBy("createdAt", "desc"), limit(250));
        const snap = await getDocs(q);

        const list: CalorieEntry[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            food: data.food || "",
            calories: data.calories ?? 0,
            protein: typeof data.protein === "number" ? data.protein : undefined,
            mealType: (data.mealType || "breakfast") as MealType,
            date: data.date || "",
            createdAt: data.createdAt,
          });
        });

        setEntries(list);
      } catch (e) {
        console.error(e);
        setError("Failed to load your calorie tracker. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const stats = useMemo(() => {
    const t = todayISO();
    const weekStart = addDaysISO(t, -6);

    let todayCals = 0;
    let todayProt = 0;
    let weekCals = 0;
    let weekProt = 0;

    for (const e of entries) {
      if (e.date === t) {
        todayCals += e.calories;
        todayProt += e.protein || 0;
      }
      if (e.date >= weekStart && e.date <= t) {
        weekCals += e.calories;
        weekProt += e.protein || 0;
      }
    }

    const gC = parseFloat(goalCalories || "0");
    const gP = parseFloat(goalProtein || "0");

    const calPct = gC > 0 ? Math.max(0, Math.min(100, Math.round((todayCals / gC) * 100))) : 0;
    const protPct = gP > 0 ? Math.max(0, Math.min(100, Math.round((todayProt / gP) * 100))) : 0;

    const mood =
      gC > 0
        ? todayCals < gC * 0.75
          ? "🧃 Under goal — ok lang, bawi sa next meal."
          : todayCals <= gC * 1.05
          ? "🌟 On track — galing Kabayan!"
          : "😅 Over goal — chill lang, balance tomorrow."
        : "🎯 Set a goal para mas exciting ang tracking.";

    return {
      todayCals,
      todayProt,
      weekCals,
      weekProt,
      gC,
      gP,
      calPct,
      protPct,
      mood,
      weekStart,
      today: t,
    };
  }, [entries, goalCalories, goalProtein]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatus(null);
    setError(null);

    const cals = parseFloat(calories || "0");
    const prot = protein ? parseFloat(protein) : NaN;

    if (!food.trim()) return setError("Please enter the food name.");
    if (!date) return setError("Please choose a date.");
    if (!cals || cals <= 0) return setError("Calories must be greater than 0.");

    setSavingEntry(true);
    try {
      const ref = collection(db, "users", user.uid, "calorieEntries");
      const newDoc = await addDoc(ref, {
        food: food.trim(),
        calories: cals,
        protein: protein ? (isNaN(prot) ? null : prot) : null,
        mealType,
        date,
        createdAt: serverTimestamp(),
      });

      const newEntry: CalorieEntry = {
        id: newDoc.id,
        food: food.trim(),
        calories: cals,
        protein: protein ? (isNaN(prot) ? undefined : prot) : undefined,
        mealType,
        date,
        createdAt: null,
      };

      setEntries((prev) => [newEntry, ...prev]);
      setStatus("Entry added. Nice! 💪");
      setFood("");
      setCalories("");
      setProtein("");
      // keep date + mealType
    } catch (err) {
      console.error(err);
      setError("Failed to save entry. Please try again.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleSaveGoals = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingGoals(true);
    setStatus(null);
    setError(null);

    try {
      const gC = parseFloat(goalCalories || "0");
      const gP = parseFloat(goalProtein || "0");

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        calorieGoalDaily: isNaN(gC) ? 0 : gC,
        proteinGoalDaily: isNaN(gP) ? 0 : gP,
      });

      setStatus("Goals updated! 🔥");
    } catch (err) {
      console.error(err);
      setError("Failed to save goals. Please try again.");
    } finally {
      setSavingGoals(false);
    }
  };

  const mealLabel = (m: MealType) =>
    m === "breakfast" ? "Breakfast" : m === "lunch" ? "Lunch" : m === "dinner" ? "Dinner" : "Snack";

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)]/60 px-3 py-1 text-[10px] text-slate-900">
          <span className="kp-coin kp-coin-delay-2">🥗</span>
          <span className="font-semibold uppercase tracking-wide">Calorie Tracker</span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Track your kain + goal, Kabayan 🍽️
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Quick log lang: food + calories (optional protein). Makikita mo today vs goal, and your last 7 days.
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

      {/* Summary + Goals */}
      <section className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
        {/* Summary */}
        <div className="kh-card card-hover">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                Today ({stats.today})
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2">
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">Calories</p>
                  <p className="text-lg font-bold text-[var(--kh-text)]">
                    {stats.todayCals.toLocaleString()}
                    <span className="ml-1 text-[11px] font-medium text-[var(--kh-text-muted)]">
                      {stats.gC > 0 ? `/ ${stats.gC.toLocaleString()}` : ""}
                    </span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg)]/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)] transition-[width]"
                      style={{ width: `${stats.calPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">{stats.calPct}% of goal</p>
                </div>

                <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2">
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">Protein (g)</p>
                  <p className="text-lg font-bold text-[var(--kh-text)]">
                    {stats.todayProt.toLocaleString()}
                    <span className="ml-1 text-[11px] font-medium text-[var(--kh-text-muted)]">
                      {stats.gP > 0 ? `/ ${stats.gP.toLocaleString()}` : ""}
                    </span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg)]/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-[width]"
                      style={{ width: `${stats.protPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">{stats.protPct}% of goal</p>
                </div>
              </div>

              <p className="text-xs text-[var(--kh-text-secondary)]">{stats.mood}</p>

              <p className="text-[10px] text-[var(--kh-text-muted)]">
                Last 7 days ({stats.weekStart} → {stats.today}):{" "}
                <span className="font-semibold text-[var(--kh-text)]">
                  {stats.weekCals.toLocaleString()}
                </span>{" "}
                cals ·{" "}
                <span className="font-semibold text-[var(--kh-text)]">
                  {stats.weekProt.toLocaleString()}
                </span>{" "}
                g protein
              </p>
            </div>

            <div className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-[11px] md:w-64 kp-glow">
              <p className="font-semibold text-[var(--kh-text)]">Mini tip</p>
              <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                Add “Snack” entries too—usually dyan nadadagdag yung extra calories 🤭
              </p>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">Daily goals</h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Optional lang — but it makes the tracker more fun.
          </p>

          <form onSubmit={handleSaveGoals} className="mt-3 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Calorie goal / day
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={goalCalories}
                onChange={(e) => setGoalCalories(e.target.value)}
                placeholder="e.g. 2000"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Protein goal / day (g)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={goalProtein}
                onChange={(e) => setGoalProtein(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>

            <button
              type="submit"
              disabled={savingGoals}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
            >
              {savingGoals ? "Saving…" : "Save goals"}
            </button>
          </form>
        </div>
      </section>

      {/* Add entry + Recent */}
      <section className="grid gap-4 md:grid-cols-[0.95fr,1.05fr]">
        {/* Form */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">Add meal</h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Quick log lang. You can keep it simple.
          </p>

          <form onSubmit={handleAdd} className="mt-3 space-y-3 text-xs">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">Meal</label>
                <select
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">Date</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">Food</label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={food}
                onChange={(e) => setFood(e.target.value)}
                placeholder="e.g. Chicken shawarma, rice, coffee..."
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Calories
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="1"
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="e.g. 450"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Protein (g) optional
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingEntry}
              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
            >
              {savingEntry ? "Saving…" : "Add entry"}
            </button>
          </form>
        </div>

        {/* Recent */}
        <div className="kh-card card-hover">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">Recent meals</h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">Latest logs (up to 250).</p>
            </div>
            <span className="hidden rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)] md:inline-flex">
              {entries.length} items
            </span>
          </div>

          {loading && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">Loading entries…</p>
          )}

          {!loading && entries.length === 0 && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
              Wala pa entries. Add your first meal para makita mo yung daily total.
            </p>
          )}

          {!loading && entries.length > 0 && (
            <div className="mt-3 space-y-2 max-h-[460px] overflow-y-auto pr-1 text-xs">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[var(--kh-text)]">
                      {mealLabel(e.mealType)} · {e.food}
                    </p>
                    <p className="text-[10px] text-[var(--kh-text-muted)]">
                      {e.date}
                      {typeof e.protein === "number" ? ` · ${e.protein}g protein` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-[var(--kh-text)]">
                      {e.calories.toLocaleString()}{" "}
                      <span className="text-[10px] font-semibold text-[var(--kh-text-muted)]">kcal</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Fun future upgrade */}
      <section className="kh-card card-hover">
        <h3 className="text-sm font-semibold text-[var(--kh-text)]">Next fun upgrade (optional)</h3>
        <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
          We can add: “streak” for logging meals 7 days straight + Kabayan Points reward 🎁
        </p>
      </section>
    </div>
  );
}
