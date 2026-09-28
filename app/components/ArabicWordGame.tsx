"use client";

import { useEffect, useRef, useState } from "react";
import {
  advanceGame, catchWord, initialGame, pauseGame, resumeGame, startGame,
  CLAIM_SCORE, MISS_LIMIT, type GameState, type WordPair,
} from "../../lib/arabic-word-rush";

type Props = {
  wordPool: WordPair[];
  rewardKp: number;
  alreadyClaimed: boolean;
  claiming: boolean;
  onClaim: (score: number) => Promise<void>;
};

export default function ArabicWordGame({ wordPool, rewardKp, alreadyClaimed, claiming, onClaim }: Props) {
  const [game, setGame] = useState(initialGame);
  const gameRef = useRef(game);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState("Press Start to catch your first word.");

  function commit(next: GameState) {
    gameRef.current = next;
    setGame(next);
  }

  useEffect(() => {
    if (game.status !== "running") return;
    let frame = 0;
    let lastTime: number | null = null;
    inputRef.current?.focus({ preventScroll: true });
    const tick = (time: number) => {
      if (gameRef.current.status !== "running") return;
      const elapsed = lastTime === null ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      const height = boxRef.current?.clientHeight ?? 0;
      const next = advanceGame(gameRef.current, elapsed, height, wordPool);
      gameRef.current = next;
      setGame(next);
      if (next.status === "running") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.status, wordPool]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameRef.current.status === "running") {
        commit(pauseGame(gameRef.current));
        setFeedback("Paused while you were away. Resume when you’re ready.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function begin() {
    commit(startGame(wordPool));
    setTyped("");
    setFeedback("Type the English meaning of a falling word.");
  }

  function submitAnswer() {
    const before = gameRef.current;
    if (before.status !== "running" || !typed.trim()) return;
    const next = catchWord(before, typed);
    if (next === before) {
      setFeedback("No matching word yet. Check the spelling and try again.");
      return;
    }
    commit(next);
    setTyped("");
    setFeedback(`Correct! ${next.lastCorrect?.ar} means ${next.lastCorrect?.en}. +5 points.`);
    inputRef.current?.focus({ preventScroll: true });
  }

  const canClaim = (game.status === "paused" || game.status === "over") && game.score >= CLAIM_SCORE && !alreadyClaimed;

  return <div className="space-y-5">
    <section className="grid grid-cols-3 gap-2 md:gap-4" aria-label="Game statistics">
      <div className="kh-card !p-3 md:!p-5"><p className="text-xs text-[var(--kh-text-muted)]">Score</p><p className="mt-1 text-xl font-bold md:text-3xl" data-testid="rush-score">{game.score}</p><p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">+5 per catch</p></div>
      <div className="kh-card !p-3 md:!p-5"><p className="text-xs text-[var(--kh-text-muted)]">Missed</p><p className="mt-1 text-xl font-bold md:text-3xl" data-testid="rush-misses">{game.misses}/{MISS_LIMIT}</p><p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">10 ends the round</p></div>
      <div className="kh-card !p-3 md:!p-5"><p className="text-xs text-[var(--kh-text-muted)]">Weekly reward</p><p className="mt-1 text-xl font-bold md:text-3xl">{rewardKp} <span className="text-xs">KP</span></p><p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">Reach {CLAIM_SCORE} points</p></div>
    </section>

    <section className="kh-card !p-3 md:!p-6" aria-label="Arabic word catch game">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold">Catch the meaning</h2><p className="mt-1 text-xs text-[var(--kh-text-muted)]">Translate a word before it reaches the floor.</p></div>
        <div className="flex gap-2">
          {game.status === "running" ? <button className="kh-button kh-button-secondary" onClick={() => { commit(pauseGame(gameRef.current)); setFeedback("Round paused. Your words and score are saved."); }}>Pause</button>
            : game.status === "paused" ? <button disabled={claiming} className="kh-button kh-button-primary" onClick={() => { commit(resumeGame(gameRef.current)); setFeedback("Keep going! Catch the next word."); }}>Resume</button>
            : <button disabled={claiming} className="kh-button kh-button-primary" onClick={begin}>{game.status === "over" ? "Play again" : "Start game"}</button>}
          <button disabled={claiming || game.status === "idle"} className="kh-button kh-button-secondary" onClick={() => { commit(initialGame()); setTyped(""); setFeedback("Round reset. Press Start to play again."); }}>Reset</button>
        </div>
      </div>

      <div ref={boxRef} className="relative h-[260px] overflow-hidden rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] md:h-[360px]" data-testid="rush-board" data-status={game.status}>
        <div className="absolute inset-x-3 top-0 bottom-10">
          {game.words.map(word => <div key={word.id} lang="ar" dir="rtl" data-testid="falling-word" className="absolute w-[140px] max-w-full select-none break-words rounded-xl border border-[var(--kh-border-strong)] bg-[var(--kh-bg-card)] px-3 py-2 text-center text-xl font-semibold leading-tight text-[var(--kh-text)] shadow-sm" style={{ left: `${word.x * 100}%`, top: word.y, transform: `translateX(-${word.x * 100}%)` }}>{word.ar}</div>)}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 border-t border-dashed border-[var(--kh-border-strong)] bg-[var(--kh-bg-card)] px-4 py-2 text-center text-xs text-[var(--kh-text-muted)]">Catch words before they cross this line</div>
        {game.status !== "running" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--kh-bg-card)]/95 p-5 text-center">
          <p className="text-xl font-bold">{game.status === "over" ? "Round complete!" : game.status === "paused" ? "Take a breather." : "Ready, Kabayan?"}</p>
          <p className="max-w-sm text-sm text-[var(--kh-text-secondary)]">{game.status === "over" ? `You caught ${game.score / 5} words and scored ${game.score} points.` : game.status === "paused" ? "Resume to continue the same round." : "Type the English translation, then press Enter or tap Catch."}</p>
        </div>}
      </div>

      <form className="mt-3" onSubmit={event => { event.preventDefault(); submitAnswer(); }}>
        <label htmlFor="word-rush-answer" className="mb-1 block text-xs font-medium">English meaning</label>
        <div className="flex gap-2"><input ref={inputRef} id="word-rush-answer" value={typed} onChange={event => setTyped(event.target.value)} disabled={game.status !== "running"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="send" placeholder="e.g. hello or thank you" className="min-w-0 flex-1 border border-[var(--kh-border)] disabled:opacity-60" /><button type="submit" onPointerDown={event => event.preventDefault()} disabled={game.status !== "running" || !typed.trim()} className="kh-button kh-button-primary">Catch</button></div>
      </form>
      <p role="status" aria-live="polite" className="mt-3 min-h-10 text-xs text-[var(--kh-text-secondary)]">{game.status === "over" ? `Game over. Final score: ${game.score}. Play again to try for a higher score.` : feedback}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kh-border)] pt-4"><p className="max-w-md text-xs text-[var(--kh-text-muted)]">Catch 6 words to unlock your weekly reward. Pause or finish the round to claim. You can keep practicing after claiming.</p><button disabled={!canClaim || claiming} onClick={() => void onClaim(gameRef.current.score)} className="kh-button kh-button-yellow">{alreadyClaimed ? "Claimed this week" : claiming ? "Claiming…" : canClaim ? `Claim ${rewardKp} KP` : `Reach ${CLAIM_SCORE} points to claim`}</button></div>
    </section>

    <details className="kh-card !p-4"><summary className="cursor-pointer text-sm font-semibold">Practice vocabulary ({wordPool.length} words)</summary><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{wordPool.map((word, index) => <div key={`${word.ar}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--kh-bg-subtle)] px-3 py-2"><span lang="ar" dir="rtl" className="text-lg">{word.ar}</span><span className="text-xs text-[var(--kh-text-secondary)]">{word.en}</span></div>)}</div></details>
  </div>;
}
