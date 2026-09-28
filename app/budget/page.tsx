"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type BudgetEntry = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category?: string;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt?: any;
  currency?: "PHP" | "SAR";
};

export default function BudgetPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);

  // Currency preference (per user)
  const [currency, setCurrency] = useState<"PHP" | "SAR">("PHP");
  const CURRENCY_SYMBOL = currency === "PHP" ? "₱" : "﷼";

  // Form state
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Monthly target
  const [targetMonthly, setTargetMonthly] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [showTargetEditor, setShowTargetEditor] = useState(false);

  const quickAmounts = [100, 500, 1000, 2000];
  const incomeSuggestions = ["Salary", "Bonus", "Freelance", "OT", "Allowance"];
  const expenseSuggestions = [
    "Food",
    "Transport",
    "Rent",
    "Bills",
    "Groceries",
    "Shopping",
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);
      try {
        // Load user doc (for monthly target + currency)
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          if (typeof data.budgetTargetMonthly === "number") {
            setTargetMonthly(String(data.budgetTargetMonthly));
          }
          if (data.budgetCurrency === "PHP" || data.budgetCurrency === "SAR") {
            setCurrency(data.budgetCurrency);
          }
        }

        // Load budget entries
        const entriesRef = collection(db, "users", u.uid, "budgetEntries");
        const q = query(entriesRef, orderBy("date", "desc"), limit(200));
        const snap = await getDocs(q);

        const list: BudgetEntry[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            type: data.type,
            amount: data.amount ?? 0,
            category: data.category || "",
            note: data.note || "",
            date: data.date || "",
            createdAt: data.createdAt,
            currency: data.currency || undefined,
          });
        });
        setEntries(list);
      } catch (err) {
        console.error("Failed to load budget data:", err);
        setError("Failed to load your budget tracker. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const { totalIncome, totalExpenses, net, progress, targetNumber, smartInsight, suggestedTarget, monthlyTrend, spendingBreakdown, categoryChips } =
    useMemo(() => {
      let inc = 0;
      let exp = 0;
      const monthlyMap = new Map<string, { income: number; expense: number }>();
      const categoryMap = new Map<string, number>();

      for (const e of entries) {
        if (e.type === "income") {
          inc += e.amount;
        } else if (e.type === "expense") {
          exp += e.amount;
          const key = (e.category || "Uncategorized").trim();
          categoryMap.set(key, (categoryMap.get(key) || 0) + e.amount);
        }

        const entryDate = new Date(`${e.date}T00:00:00`);
        if (!Number.isNaN(entryDate.getTime())) {
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;
          const current = monthlyMap.get(monthKey) || { income: 0, expense: 0 };
          if (e.type === "income") current.income += e.amount;
          else current.expense += e.amount;
          monthlyMap.set(monthKey, current);
        }
      }

      const sortedMonths = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([monthKey, values]) => {
          const [year, month] = monthKey.split("-");
          const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en", {
            month: "short",
          });
          return {
            label,
            income: values.income,
            expense: values.expense,
          };
        });

      const spendingList = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      const maxCategoryAmount = spendingList[0]?.[1] || 1;
      const breakdown = spendingList.map(([category, total]) => ({
        category,
        total,
        width: Math.max(16, Math.round((total / maxCategoryAmount) * 100)),
      }));

      const netVal = inc - exp;
      const t = parseFloat(targetMonthly || "0");
      const pct =
        t > 0 ? Math.max(0, Math.min(100, Math.round((netVal / t) * 100))) : 0;
      const averageIncome = entries.filter((e) => e.type === "income").length
        ? Math.round(inc / entries.filter((e) => e.type === "income").length)
        : 0;
      const suggested = t > 0 ? Math.round(Math.max(t, averageIncome * 2)) : Math.round(Math.max(averageIncome * 2, 5000));
      const insight =
        pct >= 100
          ? "You’ve already hit your target — nice work. Keep the momentum going."
          : netVal > 0
          ? "Your cash flow is healthy. Try moving a small chunk to savings each payday."
          : "You’re still building momentum. A simple weekly check-in will help keep spending in control.";

      return {
        totalIncome: inc,
        totalExpenses: exp,
        net: netVal,
        progress: pct,
        targetNumber: t,
        smartInsight: insight,
        suggestedTarget: suggested,
        monthlyTrend: sortedMonths,
        spendingBreakdown: breakdown,
        categoryChips: entryType === "expense" ? expenseSuggestions : incomeSuggestions,
      };
    }, [entries, entryType, targetMonthly]);

  const formatCurrency = (value: number) => `${CURRENCY_SYMBOL}${value.toLocaleString()}`;

  const handleAddEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatus(null);
    setError(null);

    const amt = parseFloat(amount || "0");
    if (!date) {
      setError("Please choose a date.");
      return;
    }
    if (!amt || amt <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSavingEntry(true);
    try {
      const ref = collection(db, "users", user.uid, "budgetEntries");
      const newDoc = await addDoc(ref, {
        type: entryType,
        amount: amt,
        category: category || null,
        note: note || null,
        date,
        currency, // store the currently selected currency
        createdAt: serverTimestamp(),
      });

      const newEntry: BudgetEntry = {
        id: newDoc.id,
        type: entryType,
        amount: amt,
        category: category || "",
        note: note || "",
        date,
        createdAt: null,
        currency,
      };

      setEntries((prev) => [newEntry, ...prev]);
      setStatus(
        `${entryType === "income" ? "Income" : "Expense"} added to your tracker.`
      );

      // Reset form (keep date + type)
      setAmount("");
      setCategory("");
      setNote("");
    } catch (err) {
      console.error("Failed to add entry:", err);
      setError("Failed to save entry. Please try again.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleSaveTarget = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingTarget(true);
    setStatus(null);
    setError(null);

    try {
      const val = parseFloat(targetMonthly || "0");
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        budgetTargetMonthly: isNaN(val) ? 0 : val,
      });
      setStatus("Monthly savings target updated. Galing mo Kabayan 💪");
    } catch (err) {
      console.error("Failed to save target:", err);
      setError("Failed to save monthly target. Please try again.");
    } finally {
      setSavingTarget(false);
    }
  };

  // Save currency preference per user
  const handleCurrencyChange = async (newCurrency: "PHP" | "SAR") => {
    if (!user) {
      setCurrency(newCurrency);
      return;
    }
    setCurrency(newCurrency);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        budgetCurrency: newCurrency,
      });
    } catch (err) {
      console.error("Failed to save currency preference:", err);
    }
  };

  if (!user && loading) {
    return (
      <p className="text-sm text-[var(--kh-text-secondary)]">
        Loading your budget tracker…
      </p>
    );
  }

  // Small helper to style net value
  const netColor =
    net > 0
      ? "text-emerald-600"
      : net < 0
      ? "text-red-600"
      : "text-[var(--kh-text-secondary)]";

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/50 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-1">{CURRENCY_SYMBOL}</span>
          <span className="font-semibold uppercase tracking-wide">
            Budget &amp; Savings Tracker
          </span>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
              Track your money flow, Kabayan 💸
            </h1>
            <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
              Log your income and expenses in Saudi so you can see real savings,
              not just “tantya-tantya”. Simple lang pero powerful para sa future mo.
            </p>
          </div>

          {/* Currency toggle */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-2 py-1 text-xs">
            <span className="text-[10px] text-[var(--kh-text-muted)]">
              Currency
            </span>
            <button
              type="button"
              onClick={() => handleCurrencyChange("PHP")}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                currency === "PHP"
                  ? "bg-[var(--kh-blue)] text-white"
                  : "text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
              }`}
            >
              ₱ PHP
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange("SAR")}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                currency === "SAR"
                  ? "bg-[var(--kh-blue)] text-white"
                  : "text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
              }`}
            >
              ﷼ SAR
            </button>
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
      <section className="grid gap-4">
        <div className="kh-card card-hover">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                📊 This period overview
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs md:text-sm">
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Total income
                  </p>
                  <p className="font-semibold text-emerald-600">
                    {formatCurrency(totalIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Total expenses
                  </p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Net balance
                  </p>
                  <p className={`font-semibold ${netColor}`}>
                    {net >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(net))}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-[11px] lg:w-64 kp-glow">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--kh-text)]">
                  Savings target
                </span>
                <span className="text-[10px] text-[var(--kh-text-muted)]">
                  Monthly
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-[var(--kh-text)]">
                {formatCurrency(targetNumber)}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg)]/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                {targetNumber > 0 ? (
                  <>
                    {progress}% of your target reached. {net >= 0 ? "Nice! Konti na lang, kaya yan." : "Bawi tayo next sweldo."}
                  </>
                ) : (
                  <>Set a monthly target below to start tracking your goal.</>
                )}
              </p>

              <div className="mt-3 border-t border-[var(--kh-border)] pt-3">
                <button
                  type="button"
                  onClick={() => setShowTargetEditor((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--kh-blue)]"
                >
                  <span>✏️</span> Edit savings target
                </button>

                {showTargetEditor && (
                  <form
                    onSubmit={handleSaveTarget}
                    className="mt-3 flex flex-col gap-2 text-xs md:flex-row md:items-center"
                  >
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                        Target amount (per month)
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                        value={targetMonthly}
                        onChange={(e) => setTargetMonthly(e.target.value)}
                        placeholder="e.g. 20000"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingTarget}
                      className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60 md:mt-6"
                    >
                      {savingTarget ? "Saving…" : "Save target"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--kh-border)] bg-gradient-to-br from-[var(--kh-blue)]/10 to-[var(--kh-yellow)]/10 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                ✨ Smart insight
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--kh-text)]">
                {smartInsight}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                🎯 Suggested goal
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--kh-text)]">
                {formatCurrency(suggestedTarget)} / month
              </p>
              <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                Based on your recent income flow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Entry form + quick shortcuts + recent list */}
      <section className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="kh-card card-hover">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                  ✨ Add income / expense
                </h2>
                <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
                  Log even small gastos &quot;para hindi nawawala sa hangin&quot;.
                </p>
              </div>
              <div className="rounded-full bg-[var(--kh-blue-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--kh-blue)]">
                Quick save
              </div>
            </div>

            <form onSubmit={handleAddEntry} className="mt-3 space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEntryType("income")}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-center font-semibold transition ${
                    entryType === "income"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                      : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType("expense")}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-center font-semibold transition ${
                    entryType === "expense"
                      ? "border-red-500 bg-red-500/10 text-red-700"
                      : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-subtle)]"
                  }`}
                >
                  Expense
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Amount ({CURRENCY_SYMBOL})
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Category (optional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={
                    entryType === "income"
                      ? "Salary, OT, Bonus, Side hustle..."
                      : "Food, Rent, Transport, Padala..."
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-xs text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Grocery sa weekend, Grab, Zain bill..."
                />
              </div>

              <button
                type="submit"
                disabled={savingEntry}
                className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                {savingEntry
                  ? "Saving entry…"
                  : entryType === "income"
                  ? "Add income"
                  : "Add expense"}
              </button>
            </form>
          </div>

          <div className="kh-card card-hover">
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              ⚡ Quick shortcuts
            </h2>
            <p className="mt-1 text-[11px] text-[var(--kh-text-secondary)]">
              Tap once to fill common amounts and categories faster.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--kh-text)] transition hover:border-[var(--kh-blue)] hover:text-[var(--kh-blue)]"
                >
                  {CURRENCY_SYMBOL}{value}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                Suggested categories
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCategory(chip)}
                    className="rounded-full border border-[var(--kh-border)] bg-white/70 px-3 py-1 text-[11px] text-[var(--kh-text)] transition hover:border-[var(--kh-blue)] hover:text-[var(--kh-blue)]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                Top spending areas
              </p>
              <div className="mt-2 space-y-2">
                {spendingBreakdown.length > 0 ? (
                  spendingBreakdown.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--kh-text)]">
                        <span>{item.category}</span>
                        <span className="font-semibold">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/70">
                        <div className="h-2 rounded-full bg-gradient-to-r from-[var(--kh-blue)] to-[var(--kh-yellow)]" style={{ width: `${item.width}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Your biggest spending categories will show up here once you log a few expenses.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent entries */}
        <div className="kh-card card-hover">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                Recent entries
              </h2>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                Latest money moves you logged.
              </p>
            </div>
            <span className="hidden rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)] md:inline-flex">
              Showing {entries.length} items
            </span>
          </div>

          {loading && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
              Loading entries…
            </p>
          )}

          {!loading && entries.length === 0 && (
            <p className="mt-3 text-xs text-[var(--kh-text-secondary)]">
              Walang entries pa. Try adding your next sweldo and a few gastos to
              see your net savings.
            </p>
          )}

          {!loading && entries.length > 0 && (
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1 text-xs">
              {entries.map((e) => {
                const isIncome = e.type === "income";
                const color = isIncome ? "text-emerald-600" : "text-red-600";
                const sign = isIncome ? "+" : "-";
                const entrySymbol =
                  e.currency === "SAR"
                    ? "﷼"
                    : e.currency === "PHP"
                    ? "₱"
                    : CURRENCY_SYMBOL;

                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2"
                  >
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-semibold text-[var(--kh-text)]">
                        {e.category || (isIncome ? "Income" : "Expense")}
                      </p>
                      <p className="text-[10px] text-[var(--kh-text-muted)]">
                        {e.date}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${color}`}>
                      {sign}
                      {entrySymbol}
                      {e.amount.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
