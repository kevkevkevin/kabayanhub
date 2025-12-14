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
  const [date, setDate] = useState("");

  // Monthly target
  const [targetMonthly, setTargetMonthly] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);

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

  const { totalIncome, totalExpenses, net, progress, targetNumber } =
    useMemo(() => {
      let inc = 0;
      let exp = 0;
      for (const e of entries) {
        if (e.type === "income") inc += e.amount;
        if (e.type === "expense") exp += e.amount;
      }
      const netVal = inc - exp;
      const t = parseFloat(targetMonthly || "0");
      const pct =
        t > 0 ? Math.max(0, Math.min(100, Math.round((netVal / t) * 100))) : 0;
      return {
        totalIncome: inc,
        totalExpenses: exp,
        net: netVal,
        progress: pct,
        targetNumber: t,
      };
    }, [entries, targetMonthly]);

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
      <section className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
        {/* Totals card */}
        <div className="kh-card card-hover">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                This period overview
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs md:text-sm">
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Total income
                  </p>
                  <p className="font-semibold text-emerald-600">
                    {CURRENCY_SYMBOL}
                    {totalIncome.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Total expenses
                  </p>
                  <p className="font-semibold text-red-600">
                    {CURRENCY_SYMBOL}
                    {totalExpenses.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--kh-text-secondary)]">
                    Net balance
                  </p>
                  <p className={`font-semibold ${netColor}`}>
                    {net >= 0 ? "+" : "-"}
                    {CURRENCY_SYMBOL}
                    {Math.abs(net).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly target progress */}
            <div className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-[11px] md:w-64 kp-glow">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--kh-text)]">
                  Savings target
                </span>
                <span className="text-[10px] text-[var(--kh-text-muted)]">
                  Monthly
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-[var(--kh-text)]">
                {CURRENCY_SYMBOL}
                {targetNumber.toLocaleString()}
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
                    {progress}% of your target reached.{" "}
                    {net >= 0
                      ? "Nice! Konti na lang, kaya yan."
                      : "Bawi tayo next sweldo."}
                  </>
                ) : (
                  <>Set a monthly target below to start tracking your goal.</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly target form */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            Set your monthly savings goal
          </h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Example: &ldquo;Gusto ko at least {CURRENCY_SYMBOL}20,000
            maiuwi/maipon per month.&rdquo;
          </p>
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
        </div>
      </section>

      {/* Entry form + recent list */}
      <section className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
        {/* Add entry form */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            Add income / expense
          </h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Log even small gastos &quot;para hindi nawawala sa hangin&quot;.
          </p>

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
                // If entry has its own currency saved, use that symbol; otherwise fall back to current
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
