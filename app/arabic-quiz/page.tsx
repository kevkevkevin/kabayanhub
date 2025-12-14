// app/arabic-quiz/page.tsx
"use client";

import { useEffect, useState, FormEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type QuizQuestion = {
  id: string;
  arabic: string;
  transliteration: string;
  question: string;
  choices: string[];
  correct: string;
  hint?: string;
};

type UserInfo = {
  username?: string;
  email?: string;
  arabicQuizScore?: number;
  lastArabicQuiz?: Date | null;
};

const WEEKLY_REWARD_KP = 25; // tweak if you want 🪙

// Helper: has 7 days passed since last quiz?
function hasOneWeekPassed(last: Date | null): boolean {
  if (!last) return true; // never played → allowed
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return diff >= sevenDays;
}

// Optional: days remaining until next quiz
function daysUntilNext(last: Date | null): number {
  if (!last) return 0;
  const now = new Date();
  const diff = now.getTime() - last.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const remaining = sevenDays - diff;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

// ✨ Weekly Arabic quiz questions
const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    arabic: "السلام عليكم",
    transliteration: "as-salāmu ʿalaykum",
    question: "What does this phrase mean?",
    choices: [
      "Good morning",
      "Peace be upon you",
      "See you later",
      "Welcome to Saudi Arabia",
    ],
    correct: "Peace be upon you",
    hint: "You hear this greeting everyday in KSA.",
  },
  {
    id: "q2",
    arabic: "شكراً",
    transliteration: "shukran",
    question: "When would you say this?",
    choices: [
      "When entering a shop",
      "When saying thank you",
      "When saying sorry",
      "When ordering food",
    ],
    correct: "When saying thank you",
  },
  {
    id: "q3",
    arabic: "كم السعر؟",
    transliteration: "kam as-siʿr?",
    question: "What are you asking?",
    choices: [
      "Where is the restroom?",
      "Do you speak English?",
      "How much is this?",
      "Can I get a discount?",
    ],
    correct: "How much is this?",
    hint: "Very useful sa grocery o mall. 😉",
  },
  {
    id: "q4",
    arabic: "يمين / يسار",
    transliteration: "yamīn / yasār",
    question: "What do these words refer to?",
    choices: [
      "Right / Left",
      "Up / Down",
      "Inside / Outside",
      "Fast / Slow",
    ],
    correct: "Right / Left",
  },
  {
    id: "q5",
    arabic: "أنا من الفلبين",
    transliteration: "anā min al-Filibbīn",
    question: "What are you telling someone?",
    choices: [
      "I live in Riyadh",
      "I’m from the Philippines",
      "I work in a hospital",
      "I’m on vacation",
    ],
    correct: "I’m from the Philippines",
  },
];

export default function ArabicQuizPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userInfo, setUserInfo] = useState<UserInfo>({
    username: "",
    email: "",
    arabicQuizScore: undefined,
    lastArabicQuiz: null,
  });

  const [quizAvailable, setQuizAvailable] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [hasFinished, setHasFinished] = useState(false);

  // --- Auth + load user info ---
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

        if (snap.exists()) {
          const data = snap.data() as any;
          const last =
            data.lastArabicQuiz && data.lastArabicQuiz.toDate
              ? data.lastArabicQuiz.toDate()
              : null;

          const info: UserInfo = {
            username: data.username || data.displayName || undefined,
            email: data.email || u.email || "",
            arabicQuizScore:
              typeof data.arabicQuizScore === "number"
                ? data.arabicQuizScore
                : undefined,
            lastArabicQuiz: last,
          };

          setUserInfo(info);
          setQuizAvailable(hasOneWeekPassed(last));
        } else {
          // If user doc doesn't exist, basic info from auth
          setUserInfo({
            username: u.displayName || undefined,
            email: u.email || "",
            arabicQuizScore: undefined,
            lastArabicQuiz: null,
          });
          setQuizAvailable(true); // first-time user → allow quiz
        }
      } catch (err) {
        console.error("Failed to load Arabic quiz info:", err);
        setError("Failed to load Arabic quiz. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const nextDays = useMemo(
    () => daysUntilNext(userInfo.lastArabicQuiz || null),
    [userInfo.lastArabicQuiz]
  );

  const handleSelectAnswer = (questionId: string, choice: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  };

  const handleSubmitQuiz = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatus(null);
    setError(null);

    if (!quizAvailable) {
      setError(
        "You’ve already completed this week’s Arabic Quiz. Balik ulit next week, Kabayan. 🥰"
      );
      return;
    }

    // Make sure all questions answered
    if (Object.keys(answers).length < QUESTIONS.length) {
      setError("Please answer all questions before submitting. 💡");
      return;
    }

    // Calculate score
    let s = 0;
    for (const q of QUESTIONS) {
      if (answers[q.id] === q.correct) s++;
    }

    setSubmitting(true);
    try {
      const userRef = doc(db, "users", user.uid);

      // Reward: flat weekly reward (you can make it dynamic if you want)
      const reward = WEEKLY_REWARD_KP;

      await Promise.all([
        updateDoc(userRef, {
          lastArabicQuiz: serverTimestamp(),
          arabicQuizScore: s,
          points: increment(reward),
          lastVisit: serverTimestamp(),
        }),
        addDoc(collection(db, "users", user.uid, "activity"), {
          type: "arabic_quiz",
          amount: reward,
          createdAt: serverTimestamp(),
          score: s,
          totalQuestions: QUESTIONS.length,
        }),
      ]);

      setScore(s);
      setHasFinished(true);
      setQuizAvailable(false);
      setUserInfo((prev) => ({
        ...prev,
        arabicQuizScore: s,
        lastArabicQuiz: new Date(),
      }));

      setStatus(
        `Nice one! You scored ${s}/${QUESTIONS.length} and earned +${reward} Kabayan Points 🇸🇦✨`
      );
    } catch (err) {
      console.error("Failed to submit Arabic quiz:", err);
      setError("Failed to submit quiz. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user && loading) {
    return (
      <p className="text-sm text-[var(--kh-text-secondary)]">
        Loading Arabic Quiz…
      </p>
    );
  }

  const usernameDisplay =
    userInfo.username || (userInfo.email ? userInfo.email.split("@")[0] : "");

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/40 px-3 py-1 text-[10px] text-[var(--kh-blue)]">
          <span className="kp-coin kp-coin-delay-1 text-xs">🕌</span>
          <span className="font-semibold uppercase tracking-wide">
            Weekly Arabic Quiz
          </span>
          <span className="rounded-full bg-[var(--kh-yellow-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--kh-text)]">
            +{WEEKLY_REWARD_KP} KP / week
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Level up your Arabic, Kabayan 🇸🇦
        </h1>

        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Short weekly quiz lang — 5 questions about phrases you actually use in
          Saudi. Every correct effort builds confidence, and every completion
          gives you Kabayan Points.
        </p>

        {/* Availability pill */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {quizAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Quiz is available this week — go for it! 💪
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[var(--kh-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              You already claimed this week’s Arabic quiz reward.
              {nextDays > 0 && (
                <>
                  {" "}
                  Next quiz in{" "}
                  <span className="font-semibold text-[var(--kh-text)]">
                    {nextDays} day{nextDays > 1 ? "s" : ""}
                  </span>
                  .
                </>
              )}
            </span>
          )}

          {userInfo.lastArabicQuiz && (
            <span className="text-[10px] text-[var(--kh-text-muted)]">
              Last attempt:{" "}
              {userInfo.lastArabicQuiz.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
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

      {/* Layout: quiz on left, summary on right */}
      <section className="grid gap-4 md:grid-cols-[1.2fr,0.9fr]">
        {/* Quiz card */}
        <div className="kh-card card-hover">
          <h2 className="text-sm font-semibold text-[var(--kh-text)] md:text-base">
            This week’s quiz
          </h2>
          <p className="mt-1 text-xs text-[var(--kh-text-secondary)]">
            Answer the questions based on common phrases you hear sa Saudi
            mall, work, at sa everyday life. One attempt per week lang. 😊
          </p>

          {!quizAvailable && !hasFinished && (
            <p className="mt-3 rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-2 text-[11px] text-[var(--kh-text-muted)]">
              You’ve already completed this week’s quiz. If you just want to
              review, feel free to go through the questions — but no extra
              points until next week. 🫶
            </p>
          )}

          <form
            onSubmit={handleSubmitQuiz}
            className="mt-4 space-y-4 text-xs md:text-sm"
          >
            {QUESTIONS.map((q, index) => {
              const selected = answers[q.id];
              const showCorrect =
                hasFinished && selected && selected === q.correct;
              const showWrong =
                hasFinished && selected && selected !== q.correct;

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                        Question {index + 1}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--kh-text)]">
                        {q.arabic}
                      </p>
                      <p className="text-[11px] text-[var(--kh-text-secondary)]">
                        {q.transliteration}
                      </p>
                    </div>
                    {hasFinished && (
                      <span
                        className={`mt-1 inline-flex h-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold ${
                          showCorrect
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {showCorrect ? "Correct ✓" : "Answer"}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[12px] text-[var(--kh-text)]">
                    {q.question}
                  </p>

                  {q.hint && (
                    <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                      Hint: {q.hint}
                    </p>
                  )}

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {q.choices.map((choice) => {
                      const isSelected = selected === choice;
                      const isCorrectChoice = hasFinished && choice === q.correct;
                      const isWrongSelected =
                        hasFinished && isSelected && choice !== q.correct;

                      return (
                        <label
                          key={choice}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] transition ${
                            isCorrectChoice
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                              : isWrongSelected
                              ? "border-red-500 bg-red-500/10 text-red-700"
                              : isSelected
                              ? "border-[var(--kh-blue)] bg-[var(--kh-blue-soft)]/20 text-[var(--kh-blue)]"
                              : "border-[var(--kh-border)] text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={choice}
                            disabled={hasFinished}
                            className="h-3 w-3 accent-[var(--kh-blue)]"
                            checked={isSelected}
                            onChange={() =>
                              handleSelectAnswer(q.id, choice)
                            }
                          />
                          <span>{choice}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!hasFinished && (
              <button
                type="submit"
                disabled={submitting || !quizAvailable}
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
              >
                {submitting
                  ? "Checking your answers…"
                  : quizAvailable
                  ? "Submit quiz & claim KP"
                  : "Quiz already claimed this week"}
              </button>
            )}

            {hasFinished && score !== null && (
              <p className="mt-2 text-center text-[11px] text-[var(--kh-text-secondary)]">
                You can revisit these questions anytime, pero KP reward is
                once-per-week lang. Balik ka next week 🇸🇦💛
              </p>
            )}
          </form>
        </div>

        {/* Right side: profile + progress */}
        <div className="space-y-4">
          <div className="kh-card card-hover">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--kh-yellow-soft)] text-lg">
                <span className="kp-coin">🧠</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kh-text-muted)]">
                  Arabic streak
                </p>
                <p className="text-sm font-semibold text-[var(--kh-text)]">
                  {usernameDisplay || "Kabayan learner"}
                </p>
                <p className="text-[11px] text-[var(--kh-text-secondary)]">
                  {userInfo.email}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--kh-text-secondary)]">
                  Last score
                </span>
                <span className="font-semibold text-[var(--kh-text)]">
                  {userInfo.arabicQuizScore != null
                    ? `${userInfo.arabicQuizScore}/${QUESTIONS.length}`
                    : "No attempts yet"}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--kh-bg-subtle)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--kh-blue)] via-[var(--kh-yellow)] to-[var(--kh-red)]"
                  style={{
                    width: `${
                      userInfo.arabicQuizScore != null
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              (userInfo.arabicQuizScore / QUESTIONS.length) *
                                100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              <p className="text-[10px] text-[var(--kh-text-muted)]">
                Every week you complete the quiz, you build your habit streak —
                both in Arabic and in smart money discipline. 🔁
              </p>
            </div>
          </div>

          <div className="kh-card card-hover">
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              How this weekly quiz works
            </h2>
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--kh-text-secondary)]">
              <li>• 1 quiz per week, 5 short questions.</li>
              <li>• Answer once, claim your Kabayan Points reward.</li>
              <li>
                • You can review questions anytime, but KP is only once per
                week.
              </li>
              <li>
                • We can change questions weekly — perfect for new vocab,
                phrases, and real-life situations.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
