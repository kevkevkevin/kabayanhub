"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type Question = {
  id: number;
  arabic: string;
  transliteration: string;
  question: string;
  choices: string[];
  correctIndex: number;
  tip?: string;
};

const QUIZ_REWARD = 15; // Kabayan Points for finishing + claiming once per day

const QUESTIONS: Question[] = [
  {
    id: 1,
    arabic: "السلام عليكم",
    transliteration: "As-salāmu ʿalaykum",
    question: "What does this greeting mean?",
    choices: [
      "Good morning",
      "Peace be upon you",
      "How are you?",
      "Welcome",
    ],
    correctIndex: 1,
    tip: "Reply is usually: wa ʿalaykum as-salām.",
  },
  {
    id: 2,
    arabic: "شكراً",
    transliteration: "Shukran",
    question: "What does 'Shukran' mean?",
    choices: ["Please", "Sorry", "Thank you", "See you"],
    correctIndex: 2,
  },
  {
    id: 3,
    arabic: "لو سمحت",
    transliteration: "Law samaḥt",
    question: "When do you use 'Law samaḥt'?",
    choices: [
      "To say good night",
      "To say excuse me / please",
      "To say I’m hungry",
      "To say I’m from the Philippines",
    ],
    correctIndex: 1,
  },
  {
    id: 4,
    arabic: "كم السعر؟",
    transliteration: "Kam as-siʿr?",
    question: "What are you asking when you say this?",
    choices: [
      "Where is the exit?",
      "What time is it?",
      "How much is the price?",
      "Do you speak English?",
    ],
    correctIndex: 2,
  },
  {
    id: 5,
    arabic: "أنا من الفلبين",
    transliteration: "Ana min al-Filibbin",
    question: "What does this sentence mean?",
    choices: [
      "I work in Saudi",
      "I am from the Philippines",
      "I am an OFW",
      "I am a nurse",
    ],
    correctIndex: 1,
  },
  {
    id: 6,
    arabic: "مستشفى",
    transliteration: "Mustashfā",
    question: "This word is very important. It means…",
    choices: ["Hospital", "Market", "Mosque", "Airport"],
    correctIndex: 0,
  },
  {
    id: 7,
    arabic: "يمين / يسار",
    transliteration: "Yamīn / Yasār",
    question: "What are you talking about with these words?",
    choices: ["Up / Down", "Big / Small", "Right / Left", "Hot / Cold"],
    correctIndex: 2,
  },
  {
    id: 8,
    arabic: "ماء",
    transliteration: "Mā’",
    question: "You really need this in Saudi 😅 What is it?",
    choices: ["Juice", "Milk", "Water", "Tea"],
    correctIndex: 2,
  },
  {
    id: 9,
    arabic: "أريد…",
    transliteration: "Urīd…",
    question: "If you start a sentence with this, you’re saying…",
    choices: ["I don’t like…", "I want…", "I’m going to…", "I finished…"],
    correctIndex: 1,
  },
  {
    id: 10,
    arabic: "فين المسجد؟",
    transliteration: "Fein al-masjid?",
    question: "What are you asking?",
    choices: [
      "Where is the mosque?",
      "Where is the mall?",
      "Where is my salary?",
      "Where is the bus?",
    ],
    correctIndex: 0,
  },
];

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ArabicQuizPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lastArabicQuiz, setLastArabicQuiz] = useState<Date | null>(null);
  const [hasClaimedToday, setHasClaimedToday] = useState(false);

  /* ───────────── Listen to auth + load lastArabicQuizAt ───────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoadingUser(false);

      if (u) {
        try {
          const userRef = doc(db, "users", u.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as any;
            const last =
              data.lastArabicQuizAt && data.lastArabicQuizAt.toDate
                ? data.lastArabicQuizAt.toDate()
                : null;
            setLastArabicQuiz(last);
            setHasClaimedToday(isSameDay(last, new Date()));
          }
        } catch (err) {
          console.error("Failed to load quiz info:", err);
        }
      }
    });

    return () => unsub();
  }, []);

  const question = QUESTIONS[currentIndex];

  const handleSelect = (idx: number) => {
    if (showFeedback) return; // lock answer once chosen
    setSelectedIndex(idx);
  };

  const handleCheckAnswer = () => {
    if (selectedIndex === null) return;
    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentIndex === QUESTIONS.length - 1) {
      setFinished(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedIndex(null);
    setShowFeedback(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setShowFeedback(false);
    setScore(0);
    setFinished(false);
    setStatus(null);
    setError(null);
  };

  const handleClaimReward = async () => {
    setStatus(null);
    setError(null);

    if (!user) {
      setError("Log in to claim Kabayan Points from this quiz.");
      router.push("/login");
      return;
    }

    if (hasClaimedToday) {
      setStatus("You already claimed your Arabic quiz reward today. Try again bukas! 🥰");
      return;
    }

    setClaiming(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setError("User record not found. Please log out and log in again.");
        setClaiming(false);
        return;
      }

      await Promise.all([
        updateDoc(userRef, {
          points: increment(QUIZ_REWARD),
          lastArabicQuizAt: serverTimestamp(),
          lastVisit: serverTimestamp(),
        }),
        addDoc(collection(db, "users", user.uid, "activity"), {
          type: "arabic_quiz",
          amount: QUIZ_REWARD,
          createdAt: serverTimestamp(),
        }),
      ]);

      setLastArabicQuiz(new Date());
      setHasClaimedToday(true);
      setStatus(`Nice! +${QUIZ_REWARD} Kabayan Points added from your Arabic quiz. 🟢`);
    } catch (err) {
      console.error("Failed to claim quiz reward:", err);
      setError("Failed to claim reward. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const total = QUESTIONS.length;
  const progressPct = ((currentIndex + (finished ? 1 : 0)) / total) * 100;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-[10px] font-semibold text-white px-3 py-1 shadow-sm">
          <span>🟢</span>
          <span className="text-[var(--kh-text-secondary)]">Mini-game · Learn survival Arabic</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold text-[var(--kh-text)]">
          Arabic Survival Quiz{" "}
          <span className="text-[var(--kh-blue)]">for Kabayans</span>
        </h1>
        <p className="text-sm text-[var(--kh-text-secondary)] max-w-xl">
          Practice common phrases you&apos;ll actually hear in Saudi. Finish the quiz,
          then claim{" "}
          <span className="font-semibold text-[var(--kh-yellow)]">
            Kabayan Points (once per day)
          </span>{" "}
          when you&apos;re logged in.
        </p>
      </header>

      {/* Status messages */}
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

      {/* Progress bar */}
      <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)]">
        <div className="flex items-center justify-between text-[11px] text-[var(--kh-text-muted)] mb-2">
          <span>
            Question {Math.min(currentIndex + 1, total)} of {total}
          </span>
          <span>{Math.round(progressPct)}% done</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg-subtle)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main quiz card */}
      {!finished ? (
        <section className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 md:p-5 shadow-[var(--kh-card-shadow)] space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--kh-text-muted)]">
              Phrase
            </p>
            <p className="text-2xl md:text-3xl font-semibold text-[var(--kh-text)]">
              {question.arabic}
            </p>
            <p className="text-xs md:text-sm text-[var(--kh-text-secondary)]">
              {question.transliteration}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--kh-text)]">
              {question.question}
            </p>
          </div>

          {/* Choices */}
          <div className="space-y-2">
            {question.choices.map((choice, idx) => {
              const isSelected = selectedIndex === idx;
              const isCorrect = idx === question.correctIndex;

              let bgClass =
                "bg-[var(--kh-bg-subtle)] border-[var(--kh-border)] text-[var(--kh-text)]";
              if (showFeedback && isSelected && isCorrect) {
                bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800";
              } else if (showFeedback && isSelected && !isCorrect) {
                bgClass = "bg-red-50 border-red-300 text-red-700";
              } else if (showFeedback && isCorrect) {
                bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800";
              } else if (isSelected) {
                bgClass =
                  "bg-[var(--kh-blue-soft)] border-[var(--kh-blue)] text-[var(--kh-blue)]";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs md:text-sm transition ${
                    bgClass
                  } ${!showFeedback && "hover:border-[var(--kh-blue)]"} `}
                >
                  <span className="mr-2 text-[10px] font-semibold text-[var(--kh-text-muted)]">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {choice}
                </button>
              );
            })}
          </div>

          {/* Tip / feedback */}
          {showFeedback && (
            <div className="mt-2 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-[11px] text-[var(--kh-text-secondary)]">
              {selectedIndex === question.correctIndex ? (
                <p>
                  ✅ Tama! Great job, Kabayan.{" "}
                  {question.tip && <span>{question.tip}</span>}
                </p>
              ) : (
                <p>
                  ❌ Mali ng konti. The correct answer is{" "}
                  <span className="font-semibold">
                    {
                      question.choices[question.correctIndex]
                    }
                  </span>
                  .
                  {question.tip && <span> {question.tip}</span>}
                </p>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px]">
            <div className="text-[var(--kh-text-muted)]">
              Score:{" "}
              <span className="font-semibold text-[var(--kh-text)]">
                {score} / {total}
              </span>
            </div>
            <div className="flex gap-2">
              {!showFeedback && (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={selectedIndex === null}
                  className="rounded-full bg-[var(--kh-blue)] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
                >
                  Check answer
                </button>
              )}
              {showFeedback && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-4 py-1.5 text-[11px] font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)]"
                >
                  {currentIndex === total - 1 ? "Finish quiz" : "Next question"}
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        /* Finished state */
        <section className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 md:p-6 shadow-[var(--kh-card-shadow)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--kh-text)]">
                Tapos na! 🎉
              </h2>
              <p className="text-sm text-[var(--kh-text-secondary)]">
                You scored{" "}
                <span className="font-semibold text-[var(--kh-blue)]">
                  {score} / {total}
                </span>{" "}
                on today&apos;s Arabic survival quiz.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs text-[var(--kh-text-muted)]">
              {hasClaimedToday ? (
                <p>
                  You&apos;ve already claimed your{" "}
                  <span className="font-semibold">{QUIZ_REWARD} KP</span> reward
                  for this quiz today. Balik ka ulit bukas para sa panibagong KP. 💚
                </p>
              ) : (
                <p>
                  Log in and tap &quot;Claim Kabayan Points&quot; below to get{" "}
                  <span className="font-semibold">{QUIZ_REWARD} KP</span> for
                  today. Once per day lang ito, ha.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-card)] px-4 py-1.5 text-[11px] font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)]"
            >
              🔁 Take the quiz again
            </button>
            <button
              type="button"
              onClick={handleClaimReward}
              disabled={claiming || hasClaimedToday}
              className="rounded-full bg-[var(--kh-blue)] px-5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
            >
              {hasClaimedToday
                ? "Reward already claimed today"
                : claiming
                ? "Claiming…"
                : `Claim ${QUIZ_REWARD} Kabayan Points`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
