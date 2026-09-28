"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, increment, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import ArabicWordGame from "../components/ArabicWordGame";
import { CLAIM_SCORE, FALLBACK_WORDS, getISOWeekKey, parseWordPool, type WordPair } from "../../lib/arabic-word-rush";

type Challenge = { weekKey: string; title: string; rewardKp: number; words: WordPair[]; rewardReady: boolean };

export default function ArabicWordRushPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const lastUid = useRef<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const claimLock = useRef(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, user => {
    if (lastUid.current !== (user?.uid ?? null)) {
      setChallenge(null);
      setAlreadyClaimed(false);
      setStatus("");
      setError("");
      lastUid.current = user?.uid ?? null;
    }
    setUid(user?.uid ?? null);
    if (!user) router.replace("/login");
  }), [router]);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const weekKey = getISOWeekKey();
    const defaults: Challenge = { weekKey, title: "Arabic Word Catch", rewardKp: 30, words: FALLBACK_WORDS, rewardReady: false };
    // A slow/offline connection must not leave the game on a loading screen forever.
    const timeout = setTimeout(() => {
      if (active) {
        setChallenge(defaults);
        setError("Weekly words are taking a while to load. You can practice with the default list; rewards unlock once the challenge loads.");
      }
    }, 8000);
    async function loadChallenge() {
      try {
        const snap = await getDoc(doc(db, "arabicWordRushConfig", weekKey));
        const data = snap.data();
        if (!active) return;
        setChallenge({
          ...defaults,
          title: typeof data?.title === "string" && data.title.trim() ? data.title.trim() : defaults.title,
          rewardKp: typeof data?.rewardKp === "number" && Number.isSafeInteger(data.rewardKp) && data.rewardKp >= 0 ? data.rewardKp : 30,
          words: parseWordPool(data?.words), rewardReady: true,
        });
        setError("");
      } catch {
        if (active) {
          setChallenge(defaults);
          setError("Couldn’t load the weekly challenge. Practice is available; refresh when connected to unlock rewards.");
        }
      } finally { clearTimeout(timeout); }
    }
    async function loadClaim() {
      try {
        const snap = await getDoc(doc(db, "users", uid!, "activity", `arabicWordRush_${weekKey}`));
        if (active) setAlreadyClaimed(snap.exists());
      } catch { /* Claiming rechecks the record atomically before awarding points. */ }
    }
    void loadChallenge();
    void loadClaim();
    return () => { active = false; clearTimeout(timeout); };
  }, [uid]);

  async function claimReward(score: number) {
    if (!uid || !challenge || score < CLAIM_SCORE || alreadyClaimed || claimLock.current || auth.currentUser?.uid !== uid) return;
    if (!challenge.rewardReady) { setError("Reconnect and refresh to load this week’s reward before claiming."); return; }
    if (getISOWeekKey() !== challenge.weekKey) { setError("A new weekly challenge has started. Refresh to play this week’s round."); return; }
    claimLock.current = true;
    setClaiming(true);
    setError("");
    setStatus("");
    try {
      const activityRef = doc(db, "users", uid, "activity", `arabicWordRush_${challenge.weekKey}`);
      const userRef = doc(db, "users", uid);
      const awarded = await runTransaction(db, async transaction => {
        const activity = await transaction.get(activityRef);
        if (activity.exists()) return false;
        const user = await transaction.get(userRef);
        if (!user.exists()) throw new Error("Profile unavailable");
        // The dashboard, leaderboard and marketplace all use `points`.
        // Record the claim and credit the balance together, including across tabs.
        transaction.update(userRef, { points: increment(challenge.rewardKp), lastVisit: serverTimestamp() });
        transaction.set(activityRef, {
          type: "arabicWordRush", title: challenge.title, weekKey: challenge.weekKey,
          score, amount: challenge.rewardKp, createdAt: serverTimestamp(), claimedAt: serverTimestamp(),
        });
        return true;
      });
      setAlreadyClaimed(true);
      setStatus(awarded ? `+${challenge.rewardKp} KP added to your balance. Ang galing, Kabayan!` : "You’ve already claimed this week’s reward. Keep practicing!");
    } catch {
      setError("Couldn’t claim your reward. Check your connection and try again. Your score is still here.");
    } finally { claimLock.current = false; setClaiming(false); }
  }

  if (!uid || !challenge) return <div className="kh-card" role="status"><p className="text-sm text-[var(--kh-text-secondary)]">Loading Arabic Word Catch…</p></div>;

  return <div className="space-y-6 md:space-y-8">
    <header className="space-y-2"><p className="kh-eyebrow">KABAYAN GAMES · WEEKLY CHALLENGE</p><h1>{challenge.title}</h1><p className="text-sm text-[var(--kh-text-secondary)]">A little Arabic, a little fun. Catch falling words by typing their English meaning, then press Enter or tap Catch.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {status && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</p>}
    <ArabicWordGame key={uid} wordPool={challenge.words} rewardKp={challenge.rewardKp} alreadyClaimed={alreadyClaimed} claiming={claiming} onClaim={claimReward} />
  </div>;
}
