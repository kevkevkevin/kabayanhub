"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // adjust path if needed

// -----------------------------
// Helpers
// -----------------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ISO week key: "2026-W01"
function getISOWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  const year = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${year}-W${ww}`;
}

type WordPair = { ar: string; en: string };

type FallingWord = {
  id: string;
  ar: string;
  en: string;
  x: number; // 0..1
  y: number; // px
  speed: number; // px/sec
};

type WeekConfig = {
  title?: string;
  rewardKp?: number;
  // NEW: array of {ar,en}
  words?: WordPair[];
  updatedAt?: any;
};

function normalizeEnglish(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // collapse spaces
}

export default function ArabicWordRushPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // weekly config
  const weekKey = useMemo(() => getISOWeekKey(new Date()), []);
  const [config, setConfig] = useState<WeekConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // claim state
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // game state
  const gameBoxRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);
  const spawnRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [words, setWords] = useState<FallingWord[]>([]);
  const [typed, setTyped] = useState("");
  const [score, setScore] = useState(0);
  const [miss, setMiss] = useState(0);

  // UI helper: show the last correct answer for dopamine 😄
  const [lastCorrect, setLastCorrect] = useState<{ ar: string; en: string } | null>(null);

  const [pops, setPops] = useState<Array<{ id: string; x: number; y: number }>>([]);

  const MISS_LIMIT = 10;

  // fallback pairs if no config found
  const fallbackPairs: WordPair[] = useMemo(
    () => [
      { ar: "مرحبا", en: "hello" },
      { ar: "شكرا", en: "thank you" },
      { ar: "ماء", en: "water" },
      { ar: "خبز", en: "bread" },
      { ar: "رز", en: "rice" },
      { ar: "عمل", en: "work" },
      { ar: "بيت", en: "house" },
      { ar: "سوق", en: "market" },
      { ar: "صديق", en: "friend" },
      { ar: "صباح", en: "morning" },
      { ar: "مساء", en: "evening" },
    ],
    []
  );

  const rewardKp = config?.rewardKp ?? 30;
  const title = config?.title ?? `Arabic Word Rush · Weekly Challenge (${weekKey})`;

  // Use config words if valid, else fallback
  const wordPool: WordPair[] = useMemo(() => {
    const fromDb = (config?.words || [])
      .filter((w: any) => w && typeof w.ar === "string" && typeof w.en === "string")
      .map((w: any) => ({ ar: String(w.ar).trim(), en: String(w.en).trim() }))
      .filter((w) => w.ar.length > 0 && w.en.length > 0);

    return fromDb.length > 0 ? fromDb : fallbackPairs;
  }, [config?.words, fallbackPairs]);

  // -----------------------------
  // Auth
  // -----------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUid(u.uid);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [router]);

  // -----------------------------
  // Load weekly config
  // Collection: /arabicWordRushConfig/{weekKey}
  // -----------------------------
  useEffect(() => {
    if (!uid) return;

    (async () => {
      setLoadingConfig(true);
      setError(null);
      try {
        const ref = doc(db, "arabicWordRushConfig", weekKey);
        const snap = await getDoc(ref);
        if (snap.exists()) setConfig(snap.data() as any);
        else setConfig(null);
      } catch (e) {
        console.error(e);
        setError("Failed to load this week’s words. Using default list.");
        setConfig(null);
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, [uid, weekKey]);

  // -----------------------------
  // Check if claimed this week
  // /users/{uid}/activity/arabicWordRush_{weekKey}
  // -----------------------------
  useEffect(() => {
    if (!uid) return;

    (async () => {
      setAlreadyClaimed(false);
      try {
        const actRef = doc(db, "users", uid, "activity", `arabicWordRush_${weekKey}`);
        const actSnap = await getDoc(actRef);
        if (actSnap.exists()) setAlreadyClaimed(true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [uid, weekKey]);

  // -----------------------------
  // Game loop
  // -----------------------------
  const stopGame = () => {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const resetGame = () => {
    setWords([]);
    setTyped("");
    setScore(0);
    setMiss(0);
    setLastCorrect(null);
    setPops([]);
    setClaimStatus(null);
    setError(null);
  };

  const startGame = () => {
    resetGame();
    setRunning(true);
    lastTRef.current = performance.now();
    spawnRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  };

  const spawnWord = () => {
    const box = gameBoxRef.current;
    if (!box) return;

    const pick = wordPool[Math.floor(Math.random() * wordPool.length)];
    const xRel = Math.random();
    const x = clamp(xRel, 0.10, 0.90);
    const speed = 60 + Math.random() * 95;

    setWords((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ar: pick.ar,
        en: pick.en,
        x,
        y: -10,
        speed,
      },
    ]);
  };

  const tick = (t: number) => {
    const box = gameBoxRef.current;
    if (!box) return;

    const dt = (t - lastTRef.current) / 1000;
    lastTRef.current = t;

    // spawn
    spawnRef.current += dt;
    if (spawnRef.current >= 1.15) {
      spawnRef.current = 0;
      spawnWord();
    }

    const bottom = box.clientHeight - 40;

    setWords((prev) => {
      const next: FallingWord[] = [];
      let missedNow = 0;

      for (const item of prev) {
        const ny = item.y + item.speed * dt;
        if (ny >= bottom) {
          missedNow += 1;
          continue;
        }
        next.push({ ...item, y: ny });
      }

      if (missedNow > 0) {
        setMiss((m) => {
          const nm = m + missedNow;
          if (nm >= MISS_LIMIT) stopGame();
          return nm;
        });
      }

      return next;
    });

    if (running) rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -----------------------------
  // Hit logic (English translation)
  // -----------------------------
  const tryHit = () => {
    const input = normalizeEnglish(typed);
    if (!input) return;

    // Find first word whose English matches
    const match = words.find((w) => normalizeEnglish(w.en) === input);
    if (!match) return;

    // pop effect
    const box = gameBoxRef.current;
    if (box) {
      const px = match.x * box.clientWidth;
      const py = match.y;
      const pid = crypto.randomUUID();
      setPops((prev) => [...prev, { id: pid, x: px, y: py }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== pid)), 500);
    }

    setWords((prev) => prev.filter((w) => w.id !== match.id));
    setScore((s) => s + 5);
    setLastCorrect({ ar: match.ar, en: match.en });
    setTyped("");
  };

  // -----------------------------
  // Weekly claim
  // -----------------------------
  const canClaim = !running && score >= 30 && !alreadyClaimed;

  const claimWeeklyReward = async () => {
    if (!uid) return;
    if (!canClaim) return;

    setClaiming(true);
    setClaimStatus(null);
    setError(null);

    try {
      const actRef = doc(db, "users", uid, "activity", `arabicWordRush_${weekKey}`);
      const actSnap = await getDoc(actRef);
      if (actSnap.exists()) {
        setAlreadyClaimed(true);
        setClaimStatus("Already claimed this week ✅");
        return;
      }

      await setDoc(actRef, {
        type: "arabicWordRush",
        weekKey,
        score,
        claimedAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", uid);

      // ✅ CHANGE THIS FIELD if your user points field is different
      await updateDoc(userRef, {
        kabayanPoints: increment(rewardKp),
      });

      setAlreadyClaimed(true);
      setClaimStatus(`+${rewardKp} KP claimed! Ang galing mo Kabayan 🥳`);
    } catch (e) {
      console.error(e);
      setError("Failed to claim KP. Check Firestore rules (permissions).");
    } finally {
      setClaiming(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  if (loadingAuth) {
    return (
      <div className="kh-card">
        <p className="text-sm text-[var(--kh-text-secondary)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/40 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-1">أ</span>
          <span className="font-semibold uppercase tracking-wide">
            Kabayan Games · Arabic Word Rush
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          {title} ✨
        </h1>

        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Arabic word falls down. You type the <span className="font-semibold">English meaning</span> then press{" "}
          <span className="font-semibold">Enter</span>.
        </p>
      </header>

      {loadingConfig && (
        <p className="text-xs text-[var(--kh-text-muted)]">Loading weekly words…</p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {claimStatus && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {claimStatus}
        </p>
      )}

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="kh-card card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
            Score
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kh-text)]">
            {score} <span className="text-sm font-semibold text-[var(--kh-text-secondary)]">pts</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">+5 per catch</p>
        </div>

        <div className="kh-card card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
            Miss
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kh-text)]">
            {miss}/{MISS_LIMIT}
          </p>
          <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">Game over at {MISS_LIMIT}</p>
        </div>

        <div className="kh-card card-hover kp-glow">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
            Weekly reward
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kh-text)]">
            +{rewardKp} <span className="text-sm font-semibold text-[var(--kh-text-secondary)]">KP</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
            Claim once/week (score ≥ 30)
          </p>
        </div>
      </section>

      {/* Game area */}
      <section className="kh-card card-hover overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[rgba(37,99,235,0.18)] blur-2xl" />
          <div className="absolute right-[-20px] top-6 h-40 w-40 rounded-full bg-[rgba(234,179,8,0.16)] blur-2xl" />
          <div className="absolute left-1/3 bottom-[-30px] h-44 w-44 rounded-full bg-[rgba(239,68,68,0.14)] blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--kh-text)]">Play area</p>
              <p className="text-[11px] text-[var(--kh-text-muted)]">
                Catch by typing the English translation (example: “شكرا” → “thank you”)
              </p>
            </div>

            <div className="flex gap-2">
              {!running ? (
                <button
                  onClick={startGame}
                  className="rounded-full bg-[var(--kh-yellow)] px-4 py-2 text-xs font-bold text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105"
                >
                  {miss >= MISS_LIMIT ? "Play again" : "Start game"}
                </button>
              ) : (
                <button
                  onClick={stopGame}
                  className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
                >
                  Pause
                </button>
              )}

              <button
                onClick={resetGame}
                className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Hint bubble (last correct) */}
          {lastCorrect && (
            <div className="mt-3 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-xs">
              <span className="font-semibold text-[var(--kh-text)]">Last correct:</span>{" "}
              <span className="text-[var(--kh-text-secondary)]">
                {lastCorrect.ar} → {lastCorrect.en}
              </span>
            </div>
          )}

          {/* Game box */}
          <div
            ref={gameBoxRef}
            className="mt-4 relative h-[360px] w-full overflow-hidden rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)]"
          >
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-[var(--kh-bg)]/40 border-t border-[var(--kh-border)]" />
            <div className="absolute bottom-3 left-4 text-[10px] text-[var(--kh-text-muted)]">
              sahig 😭
            </div>

            {words.map((w) => (
              <div
                key={w.id}
                className="absolute select-none rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-3 py-1 text-base font-semibold text-[var(--kh-text)] shadow-sm"
                style={{
                  left: `calc(${w.x * 100}% - 22px)`,
                  top: `${w.y}px`,
                }}
                dir="rtl"
                title={`Answer: ${w.en}`}
              >
                {w.ar}
              </div>
            ))}

            {pops.map((p) => (
              <div
                key={p.id}
                className="absolute text-xl animate-[pop_0.5s_ease-out_forwards]"
                style={{ left: p.x, top: p.y }}
              >
                ✨
              </div>
            ))}
          </div>

          {/* input */}
          <div className="mt-4 grid gap-2 md:grid-cols-[1fr,auto]">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Type the English translation
              </label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryHit();
                  }
                }}
                placeholder="e.g. hello / thank you / water"
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              />
              <p className="text-[10px] text-[var(--kh-text-muted)]">
                Press Enter to catch. (Exact meaning match)
              </p>
            </div>

            <button
              onClick={tryHit}
              className="rounded-2xl bg-[var(--kh-blue)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110"
            >
              Catch ✅
            </button>
          </div>

          {/* game over + claim */}
          {!running && miss >= MISS_LIMIT && (
            <div className="mt-4 rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4">
              <p className="text-sm font-semibold text-[var(--kh-text)]">Game over 😭</p>
              <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
                Final score: <span className="font-semibold">{score}</span>
              </p>
            </div>
          )}

          {!running && (
            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] text-[var(--kh-text-muted)]">
                Weekly claim unlocks when score ≥ <span className="font-semibold">30</span>.
              </div>

              <button
                onClick={claimWeeklyReward}
                disabled={!canClaim || claiming}
                className="rounded-full bg-[var(--kh-yellow)] px-5 py-2 text-xs font-bold text-slate-900 shadow-[var(--kh-card-shadow)] hover:brightness-105 disabled:opacity-50"
              >
                {alreadyClaimed
                  ? "Claimed this week ✅"
                  : claiming
                  ? "Claiming…"
                  : canClaim
                  ? `Claim +${rewardKp} KP 🎉`
                  : "Reach 30 score to claim"}
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="text-[11px] text-[var(--kh-text-muted)]">
        Weekly words source: <span className="font-semibold">/arabicWordRushConfig/{weekKey}</span>
        {" · "}
        Format: <span className="font-semibold">words: [{`{ar:"", en:""}`}]</span>
      </div>

      <style jsx>{`
        @keyframes pop {
          0% {
            transform: translateY(0) scale(0.9);
            opacity: 0.4;
          }
          60% {
            transform: translateY(-10px) scale(1.15);
            opacity: 1;
          }
          100% {
            transform: translateY(-18px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
