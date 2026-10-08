"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { auth, onAuthStateChanged } from "../../../lib/backend/auth";
import { playCascade, type CascadeRound } from "../../../lib/backend/arcade";
import Icon from "../Icon";
import { CoinBalance, CoinRefill, useCoinWallet } from "./CoinWallet";

const symbols = [
  { name: "Mango", icon: "🥭", rate: "10%" }, { name: "Coconut", icon: "🥥", rate: "20%" },
  { name: "Coffee", icon: "☕", rate: "30%" }, { name: "Sampaguita", icon: "🌼", rate: "40%" },
  { name: "Suitcase", icon: "🧳", rate: "50%" }, { name: "Airplane", icon: "✈️", rate: "80%" },
  { name: "Heart", icon: "❤️", rate: "120%" }, { name: "Sun", icon: "☀️", rate: "200%" },
  { name: "Kabayan scatter", icon: "", rate: "BONUS" },
];
const idleBoard = Array.from({ length: 30 }, (_, i) => (i * 3 + Math.floor(i / 4)) % 8);
type Pending = { id: string; stake: number };

export default function KabayanCascade() {
  const [identity, setIdentity] = useState<{ ready: boolean; uid: string | null }>({ ready: false, uid: null });
  useEffect(() => onAuthStateChanged(auth, user => setIdentity({ ready: true, uid: user?.uid ?? null })), []);
  return <div className="cascade-page">
    <header className="cascade-heading"><div><p className="kh-eyebrow">KABAYAN ARCADE · A LITTLE PLAY, A LITTLE PINOY</p><h1>Kabayan <span>Cascade.</span></h1><p>Catch a match. Watch it tumble. Let the good vibes fall.</p></div><span className="cascade-free-label"><Icon name="shield" width={15} />Free coins. Just for fun.</span></header>
    {!identity.ready ? <p role="status" className="kh-card">Opening the arcade…</p> : identity.uid ? <MemberGame key={identity.uid} uid={identity.uid} /> : <section className="cascade-welcome"><Image src="/logomain.png" alt="Kabayan mascot" width={112} height={116} /><p className="kh-eyebrow">YOUR NEXT LITTLE BREAK</p><h2>Tayo ang saya!</h2><p>Start with 1,000 free Kabayan Coins. Match symbols, unlock mascot bonuses, and keep your arcade balance on your profile.</p><Link className="kh-button kh-button-yellow" href="/login">Sign in to play <Icon name="arrow" width={17} /></Link></section>}
    <p className="cascade-disclaimer">Kabayan Coins and KP are free, play-only credits with no cash or real-world reward value. Convert 10 coins to 1 KP on your profile. No purchases, transfers, or cash-out.</p>
  </div>;
}

function MemberGame({ uid }: { uid: string }) {
  const { wallet, error: walletError, refresh } = useCoinWallet(uid);
  const [stake, setStake] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [round, setRound] = useState<CascadeRound | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const pendingKey = `kabayan-cascade-pending:${uid}`;
  useEffect(() => {
    alive.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(pendingKey) || "null");
      if (saved && /^[0-9a-f-]{36}$/i.test(saved.id) && [10,25,50,100].includes(saved.stake)) queueMicrotask(() => { if (alive.current) setPending(saved); });
    } catch { /* Storage can be disabled; in-memory retries still work. */ }
    queueMicrotask(() => { if (alive.current) setReady(true); });
    return () => { alive.current = false; };
  }, [pendingKey]);
  const animating = !!round && step < round.stages.length;
  const busy = spinning || animating;
  useEffect(() => {
    if (!round || step >= round.stages.length) return;
    const timer = window.setTimeout(() => setStep(value => value + 1), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 850);
    return () => clearTimeout(timer);
  }, [round, step]);
  async function spin() {
    if (lock.current || busy || !wallet || !ready) return;
    lock.current = true; setSpinning(true); setError("");
    const request = pending || { id: crypto.randomUUID(), stake: wallet.bonusSpins ? wallet.bonusStake : stake };
    setPending(request);
    try { localStorage.setItem(pendingKey, JSON.stringify(request)); } catch { /* Optional reload recovery. */ }
    try {
      const result = await playCascade(request.id, request.stake);
      if (!alive.current || auth.currentUser?.uid !== uid) return;
      try { localStorage.removeItem(pendingKey); } catch { /* A repeat returns the saved result. */ }
      setPending(null); setStep(0); setRound(result);
      await refresh();
      window.dispatchEvent(new Event("kabayan-coins-updated"));
    } catch (err) {
      if (alive.current) {
        const message = err instanceof Error ? err.message : "Connection interrupted.";
        setError(`${message} Use Retry round to recover the same result without paying twice.`);
        if (/Not enough|Choose 10/.test(message)) {
          setPending(null);
          try { localStorage.removeItem(pendingKey); } catch { /* No spend took place. */ }
          setError(message);
        }
      }
    } finally { lock.current = false; if (alive.current) setSpinning(false); }
  }
  const displayed = round || wallet?.lastRound;
  const stage = round ? round.stages[Math.min(step, round.stages.length - 1)] : wallet?.lastRound?.stages.at(-1);
  const board = stage?.board || idleBoard;
  const activeHits = animating ? stage?.positions || [] : [];
  const bonus = wallet?.bonusSpins || 0;
  const currentStake = bonus ? wallet!.bonusStake : stake;
  const enough = bonus > 0 || (wallet?.balance ?? 0) >= currentStake;
  const complete = displayed && !busy;
  return <div className="cascade-layout">
    <div className="cascade-main">
      <div className="cascade-wallet-strip"><CoinBalance balance={wallet?.balance} /><Link href="/dashboard" className="kh-inline-link">My profile <Icon name="arrow" width={14} /></Link></div>
      <section className={`cascade-machine ${bonus ? "is-bonus" : ""}`} aria-label="Kabayan Cascade game">
        <div className="cascade-machine-top"><span><i />{bonus ? "BAYANI BONUS" : "MATCH 8+ SYMBOLS ANYWHERE"}</span><strong>{bonus ? `${bonus} free spins` : "6 columns · endless good vibes"}</strong></div>
        <div className="cascade-stage-wrap">
          <div className={`cascade-board ${spinning ? "is-spinning" : ""}`} role="img" aria-label={stage ? `Game board. ${animating ? `Cascade ${step + 1}. ${stage.wins.map(win => `${win.count} ${symbols[win.symbol].name} symbols`).join(", ")}` : "Round complete. Results below."}` : "Thirty spaces for Kabayan symbols"}>
            {board.map((symbol, index) => <div key={`${round?.id || "idle"}-${step}-${index}`} className={`cascade-symbol symbol-${symbol} ${activeHits.includes(index) ? "is-winning" : ""}`} style={{ animationDelay: `${(index % 5) * 22}ms` }} aria-hidden="true">{symbol === 8 ? <><Image src="/logomain.png" alt="" width={72} height={74} /><small>SCATTER</small></> : <span>{symbols[symbol].icon}</span>}</div>)}
          </div>
          {animating && !!stage?.boost && <div className="cascade-boost" role="status">Bayanihan boost <strong>+{stage.boost}×</strong></div>}
        </div>
        <div className="cascade-round-status" role="status" aria-live="polite">{spinning ? "Your next cascade is on its way…" : animating ? stage?.coins ? `${stage.wins.map(win => `${win.count} ${symbols[win.symbol].name}`).join(" + ")} · +${stage.coins} coins before multiplier` : "Settling this round…" : complete ? displayed.win > 0 ? `Salamat, Kabayan! +${displayed.win.toLocaleString()} coins won${displayed.multiplier > 1 ? ` · ${displayed.multiplier}× multiplier` : ""}` : "No match this round. Take your time, Kabayan." : "Eight of a kind, anywhere on the board. Ready?"}</div>
        {complete && displayed.bonusAdded > 0 && <p className="cascade-bonus-notice">✦ Mascot scatters unlocked {displayed.bonusAdded} free spins!</p>}
        <div className="cascade-controls"><fieldset disabled={busy || bonus > 0 || !!pending}><legend>Coins per spin</legend><div>{[10,25,50,100].map(value => <button key={value} type="button" aria-pressed={currentStake === value} onClick={() => setStake(value)}>{value}</button>)}</div></fieldset><button type="button" className="cascade-spin" disabled={busy || !ready || !wallet || (!pending && !enough)} onClick={() => void spin()}><Icon name="refresh" width={25} />{busy ? "Playing…" : pending ? "Retry round" : bonus ? `Free spin · ${bonus} left` : `Spin · ${stake} coins`}</button></div>
        {bonus > 0 && <p className="cascade-control-hint">Bonus spins use {wallet?.bonusStake} coins as their scoring base and cost nothing. Bonus multiplier: {Math.max(1,wallet?.bonusMultiplier || 0)}×.</p>}
        {!enough && !pending && <p className="cascade-control-hint">Your balance is too low for this spin. Choose a smaller amount or use your daily free refill.</p>}
      </section>
      {(error || walletError) && <p role="alert" className="cascade-error">{error || walletError} {walletError && <button onClick={() => void refresh()}>Reload wallet</button>}</p>}
      <details className="cascade-rules kh-card"><summary>How to play &amp; symbol values <Icon name="chevron" width={18} /></summary><p>Match 8 or more identical symbols anywhere. Matching symbols disappear; the remaining symbols fall and new ones arrive. Values below are a percentage of your chosen coins per spin for 8–9 symbols. Matches of 10–11 pay 2×; 12 or more pay 3×.</p><div className="cascade-paytable">{symbols.slice(0,8).map(symbol => <div key={symbol.name}><span>{symbol.icon}</span><strong>{symbol.name}</strong><small>{symbol.rate}</small></div>)}</div><ul><li>Four or more mascot scatters on one board unlock 8 free spins. During a bonus, they add 3 more, up to 50 remaining.</li><li>A winning cascade can add a 2×, 3×, 5×, 10×, or 25× boost. Boosts add together, up to 100×, and multiply the round’s total match coins. During free spins, this multiplier carries over until the bonus ends.</li><li>Each round resolves up to 12 boards and awards at most 100,000 play coins. Round results and your shared balance are saved automatically.</li><li>Your 500-coin daily refill resets at midnight in Saudi Arabia. Spins are random; earlier results do not predict the next spin.</li></ul></details>
    </div>
    <aside className="cascade-sidebar"><section className="cascade-mascot-card"><div className="cascade-mascot-orbit"><Image src="/logomain.png" alt="Kabayan Hub mascot" width={112} height={116} /></div><p className="kh-eyebrow">ONE HUB. ALL YOUR GAMES.</p><h2>Tayo ang saya!</h2><p>Your Kabayan Coins stay with your profile. One shared wallet for the arcade games we create.</p><div className="cascade-scatter-tip"><strong>4 mascot scatters</strong><span>unlock 8 free spins ✦</span></div></section>
      <section className="kh-card cascade-refill"><h2>A fresh little boost.</h2><p>1,000 coins to start. Another 500 free coins each day.</p>{wallet && <CoinRefill wallet={wallet} onRefilled={() => void refresh()} />}<small>No purchases. No cash-out. Just play.</small><Link className="kh-inline-link" href="/dashboard#coin-wallet">Convert coins to KP →</Link></section>
      <section className="kh-card cascade-history"><h2>Your coin history</h2>{wallet?.history.map(item => <div key={item.id}><span><strong>{item.kind === "starter" ? "Welcome coins" : item.kind === "daily_refill" ? "Daily free refill" : item.kind === "conversion" ? "Converted to KP" : item.kind === "admin_adjustment" ? "Admin adjustment" : "Kabayan Cascade"}</strong><small>{new Date(item.created_at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></span><b className={item.amount >= 0 ? "positive" : ""}>{item.amount > 0 ? "+" : ""}{item.amount.toLocaleString()}</b></div>)}<p>Round history shows the net change after the spin cost and winnings.</p></section>
    </aside>
  </div>;
}
