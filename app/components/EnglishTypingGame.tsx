"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { advanceTypingGame, initialTypingGame, pauseTypingGame, resumeTypingGame, startTypingGame, submitTypingWord, typingStats, activateTypingPower, LIFE_LIMIT, REFILL_WORDS, WORD_POINTS, type Difficulty, type Power, type TypingState } from "../../lib/english-typing-rush";

const powerInfo: { id: Power; label: string; key: string; description: string; symbol: string }[] = [
  { id: "freeze", label: "Freeze", key: "1", description: "Stop falling words for 5 seconds", symbol: "❄" },
  { id: "wind", label: "Wind", key: "2", description: "Clear every word for +10 points each", symbol: "≋" },
  { id: "shield", label: "Shield", key: "3", description: "Protect your lives for 5 seconds", symbol: "◇" },
];

export default function EnglishTypingGame() {
  const [game, setGame] = useState(initialTypingGame);
  const current = useRef(game);
  const input = useRef<HTMLInputElement>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("steady");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("Choose your pace, then start your first round.");
  const [windBurst, setWindBurst] = useState(0);
  const stats = typingStats(game);
  function commit(next: TypingState) { current.current = next; setGame(next); }
  function focusInput() { input.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (game.status !== "running") return;
    let frame = 0;
    let previous: number | null = null;
    input.current?.focus({ preventScroll: true });
    function tick(now: number) {
      if (current.current.status !== "running") return;
      const next = advanceTypingGame(current.current, previous === null ? 0 : (now - previous) / 1000);
      previous = now;
      current.current = next;
      setGame(next);
      if (next.status === "running") frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.status]);
  useEffect(() => {
    const pauseAway = () => {
      if (document.hidden && current.current.status === "running") {
        const next = pauseTypingGame(current.current);
        current.current = next; setGame(next);
        setFeedback("Paused while you were away. Your lives and power-ups are safe.");
      }
    };
    document.addEventListener("visibilitychange", pauseAway);
    return () => document.removeEventListener("visibilitychange", pauseAway);
  }, []);
  function begin() {
    commit(startTypingGame(difficulty)); setAnswer(""); setWindBurst(0);
    setFeedback("Type any falling word and press Enter. You’ve got this!");
  }
  function submit() {
    const before = current.current;
    const next = submitTypingWord(before, answer);
    if (next === before) return;
    commit(next);
    if (next.caught > before.caught) {
      setFeedback(next.caught % REFILL_WORDS === 0 ? "Nice work! +10 points. All power-ups refilled by one charge." : `Caught ${answer.trim().toLowerCase()}! +${WORD_POINTS} points.`);
      setAnswer("");
    } else setFeedback("That word isn’t on the board. Check the spelling and try again.");
    focusInput();
  }
  function power(id: Power) {
    const before = current.current;
    const next = activateTypingPower(before, id);
    if (next === before) return;
    commit(next);
    if (id === "wind") {
      setWindBurst(value => value + 1); setAnswer("");
      setFeedback(`Wind cleared ${before.words.length} word${before.words.length === 1 ? "" : "s"}! +${next.score - before.score} game points.`);
    } else setFeedback(id === "freeze" ? "Freeze! Words stop for 5 seconds. Keep typing." : "Shield on! Misses won’t cost a life for 5 seconds.");
    focusInput();
  }
  function pause() { commit(pauseTypingGame(current.current)); setFeedback("Paused. Resume whenever you’re ready."); }
  const running = game.status === "running";
  const activeRound = running || game.status === "paused";
  const refill = game.caught % REFILL_WORDS;
  return <div className="typing-page" onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && running) { event.preventDefault(); pause(); }
    const shortcut = powerInfo.find(item => item.key === event.key);
    if (shortcut && running) { event.preventDefault(); if (!event.repeat) power(shortcut.id); }
  }}>
    <header className="typing-heading"><div><p className="kh-eyebrow">KABAYAN ARCADE · TYPE. CATCH. IMPROVE.</p><h1>English Typing <span>Rush.</span></h1><p>A little focus. Faster fingers. Catch the words before they fall.</p></div><span className="typing-practice-badge"><Icon name="book" width={16} /> Free typing practice</span></header>
    <div className="typing-layout"><div className="typing-main">
      <section className="typing-stats" aria-label="Typing statistics"><div><span>GAME SCORE</span><strong>{game.score.toLocaleString()}</strong></div><div title="Correctly typed characters ÷ 5, per minute of active play. Wind adds no WPM."><span>LIVE WPM</span><strong>{stats.wpm}<small> wpm</small></strong></div><div title="Correct submitted words divided by all submitted words."><span>WORD ACCURACY</span><strong>{stats.accuracy}<small>%</small></strong></div><div><span>LIVES LEFT</span><strong className="typing-lives" aria-label={`${game.lives} of ${LIFE_LIMIT} lives`}>{Array.from({ length: LIFE_LIMIT }, (_, i) => <span aria-hidden="true" className={i < game.lives ? "" : "lost"} key={i}>♥</span>)}</strong></div></section>
      <section className="typing-arena-card" aria-label="English typing game">
        <div className="typing-arena-toolbar"><div><span className={`typing-status-dot ${running ? "is-running" : ""}`} /><strong>{game.status === "over" ? "Round complete" : game.status === "paused" ? "On a breather" : running ? "You’re up, Kabayan" : "Ready when you are"}</strong><span className="typing-elapsed">{Math.floor(game.elapsed / 60)}:{String(Math.floor(game.elapsed % 60)).padStart(2, "0")}</span></div><div>{running ? <button onClick={pause}>Pause <kbd>Esc</kbd></button> : game.status === "paused" ? <button onClick={() => { commit(resumeTypingGame(current.current)); setFeedback("Keep going! Catch the next word."); }}>Resume →</button> : <button onClick={begin}>{game.status === "over" ? "Play again" : "Start game"} →</button>}{game.status !== "idle" && <button aria-label="Reset round" title="Reset round" onClick={() => { commit(initialTypingGame(difficulty)); setAnswer(""); setWindBurst(0); setFeedback("Round reset. Start when you’re ready."); }}><Icon name="refresh" width={16} /></button>}</div></div>
        <div className={`typing-board ${game.freezeLeft > 0 ? "is-frozen" : ""} ${game.shieldLeft > 0 ? "is-shielded" : ""}`} data-testid="typing-board" data-status={game.status}>
          <div className="typing-board-grid" aria-hidden="true" />
          <div className="typing-effects" aria-hidden="true">{game.freezeLeft > 0 && <span>❄ Frozen · {Math.ceil(game.freezeLeft)}s</span>}{game.shieldLeft > 0 && <span>◇ Shield · {Math.ceil(game.shieldLeft)}s</span>}</div>
          <div className="typing-falling-area">{game.words.map(word => {
            const matching = !!answer.trim() && word.text.startsWith(answer.trim().toLowerCase());
            return <div key={word.id} className={`typing-word ${matching ? "is-matching" : ""}`} data-testid="typing-word" style={{ left: `${word.x * 100}%`, top: `${word.y * 100}%`, transform: `translateX(-${word.x * 100}%)` }}>{matching ? <><mark>{word.text.slice(0, answer.trim().length)}</mark>{word.text.slice(answer.trim().length)}</> : word.text}</div>;
          })}</div>
          {windBurst > 0 && <div key={windBurst} className="typing-wind-burst" aria-hidden="true"><span /><span /><span /></div>}
          <div className="typing-floor">{game.shieldLeft > 0 ? "SHIELD ACTIVE · YOUR LIVES ARE PROTECTED" : "CATCH THEM BEFORE THEY CROSS THE LINE"}</div>
          {!running && <div className="typing-overlay"><span className="typing-overlay-symbol" aria-hidden="true">{game.status === "over" ? "✦" : game.status === "paused" ? "Ⅱ" : "Aa"}</span><h2>{game.status === "over" ? "Every round makes you better." : game.status === "paused" ? "Take your time." : "Let your fingers do the talking."}</h2><p>{game.status === "over" ? `${game.caught} words typed · ${game.swept} swept by Wind · ${game.score} points` : game.status === "paused" ? "The clock, words, and power-up timers are paused." : "Type an English word, then press Enter or tap Catch. Five lives. Three power-ups. Your pace."}</p>{game.status === "over" && <p className="typing-final-stats">{stats.wpm} WPM · {stats.accuracy}% word accuracy</p>}<button className="kh-button kh-button-yellow" onClick={() => game.status === "paused" ? commit(resumeTypingGame(current.current)) : begin()}>{game.status === "paused" ? "Resume round" : game.status === "over" ? "Try another round" : "Let’s play"}<Icon name="arrow" width={17} /></button></div>}
        </div>
        <div className="typing-mobile-powers" aria-label="Quick power-ups">{powerInfo.map(item => {
          const remaining = item.id === "freeze" ? game.freezeLeft : item.id === "shield" ? game.shieldLeft : 0;
          return <button type="button" key={item.id} disabled={!running || !game.charges[item.id] || remaining > 0 || (item.id === "wind" && !game.words.length)} onPointerDown={event => event.preventDefault()} onClick={() => power(item.id)} aria-label={`${item.label} power-up, ${game.charges[item.id]} charges`}><span aria-hidden="true">{item.symbol}</span>{item.label}<small>{remaining > 0 ? `${Math.ceil(remaining)}s` : `×${game.charges[item.id]}`}</small></button>;
        })}</div>
        <form className="typing-answer" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor="typing-answer">Type a falling word</label><div><input id="typing-answer" ref={input} value={answer} maxLength={24} disabled={!running} onChange={event => setAnswer(event.target.value)} onPaste={event => { event.preventDefault(); setFeedback("Type the word yourself to build your speed."); }} onDrop={event => event.preventDefault()} onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send" placeholder="Your next word…" /><button className="kh-button kh-button-primary" disabled={!running || !answer.trim()} onPointerDown={event => event.preventDefault()}>Catch <span>↵</span></button></div><p role="status" aria-live="polite">{game.status === "over" ? `Round finished. ${game.score} points, ${stats.wpm} WPM, ${stats.accuracy}% word accuracy.` : feedback}</p></form>
      </section>
    </div><aside className="typing-sidebar">
      <section className="typing-power-panel"><p className="kh-eyebrow">A LITTLE HELP, RIGHT ON TIME</p><h2>Your power-ups<span>✦</span></h2><p>Tap to activate, or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> while playing.</p><div className="typing-power-list">{powerInfo.map(item => {
        const seconds = item.id === "freeze" ? game.freezeLeft : item.id === "shield" ? game.shieldLeft : 0;
        const unavailable = !running || !game.charges[item.id] || seconds > 0 || (item.id === "wind" && !game.words.length);
        return <button type="button" key={item.id} className={`typing-power typing-power-${item.id}`} aria-label={`${item.label} power-up, ${game.charges[item.id]} charges${seconds > 0 ? ", active" : ""}`} disabled={unavailable} onPointerDown={event => event.preventDefault()} onClick={() => power(item.id)}><span className="typing-power-symbol" aria-hidden="true">{item.id === "shield" ? <Icon name="shield" width={24} height={24} /> : item.symbol}</span><span><strong>{item.label}<small>{seconds > 0 ? `${Math.ceil(seconds)}s active` : `${game.charges[item.id]} left`}</small></strong><span>{item.description}</span></span><kbd>{item.key}</kbd></button>;
      })}</div><div className="typing-refill"><div><strong>Earn your next refill</strong><span>{refill}/{REFILL_WORDS}</span></div><progress value={refill} max={REFILL_WORDS} aria-label="Typed words towards power-up refill" /><p>Every 10 correctly typed words restores one charge of each power-up. Hold up to two each.</p></div></section>
      <fieldset className="typing-pace" disabled={activeRound}><legend>Find your rhythm</legend><p>Pick a pace before starting a round.</p><div>{([{ id: "easy", label: "Easy", hint: "Short & slow" }, { id: "steady", label: "Steady", hint: "Build your flow" }, { id: "fast", label: "Fast", hint: "Feel the rush" }] as const).map(option => <label key={option.id} className={difficulty === option.id ? "is-selected" : ""}><input type="radio" name="typing-pace" value={option.id} checked={difficulty === option.id} onChange={() => setDifficulty(option.id)} /><span><strong>{option.label}</strong><small>{option.hint}</small></span></label>)}</div></fieldset>
      <div className="typing-tip"><Icon name="heart" width={18} /><div><strong>Accuracy first. Speed will follow.</strong><p>WPM counts only words you type. Wind earns game points, not typing progress. These points stay in this round and don’t add Kabayan Points.</p></div></div>
    </aside></div>
  </div>;
}
