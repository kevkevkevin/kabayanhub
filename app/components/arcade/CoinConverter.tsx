"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "../../../lib/backend/auth";
import { convertCoins } from "../../../lib/backend/arcade";

type Pending = { id: string; coins: number };
export default function CoinConverter({ uid, balance, onConverted }: { uid: string; balance: number; onConverted: () => void }) {
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(false);
  const lock = useRef(false);
  const storageKey = `kabayan-coin-conversion:${uid}`;
  useEffect(() => {
    alive.current = true;
    let saved: Pending | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (value && typeof value.id === "string" && /^[0-9a-f-]{36}$/i.test(value.id) && Number.isInteger(value.coins) && value.coins >= 10 && value.coins <= 1000000 && value.coins % 10 === 0) saved = value;
    } catch { /* In-memory retries also preserve the request ID. */ }
    queueMicrotask(() => { if (alive.current) { setPending(saved); if (saved) setAmount(String(saved.coins)); setReady(true); } });
    return () => { alive.current = false; };
  }, [storageKey]);
  const coins = pending?.coins ?? Number(amount);
  const valid = Number.isInteger(coins) && coins >= 10 && coins <= 1000000 && coins % 10 === 0;
  async function convert() {
    if (lock.current || !ready || !valid || (!pending && coins > balance)) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    const request = pending || { id: crypto.randomUUID(), coins };
    setPending(request);
    try { localStorage.setItem(storageKey, JSON.stringify(request)); } catch { /* Optional recovery after reload. */ }
    try {
      const result = await convertCoins(request.id, request.coins);
      if (!alive.current || auth.currentUser?.uid !== uid) return;
      try { localStorage.removeItem(storageKey); } catch { /* Repeating this ID cannot charge twice. */ }
      setPending(null);
      setMessage(`${result.coins.toLocaleString()} coins converted to ${result.earned.toLocaleString()} KP. Saved to your profile.`);
      onConverted();
      window.dispatchEvent(new Event("kabayan-coins-updated"));
    } catch (err) {
      if (!alive.current || auth.currentUser?.uid !== uid) return;
      const failure = err as { code?: string; message?: string };
      if (failure.code === "P0001" || failure.code === "42501") {
        setPending(null);
        try { localStorage.removeItem(storageKey); } catch { /* No conversion was made. */ }
        setError(failure.message || "Couldn’t convert these coins.");
      } else setError("Connection interrupted. Retry this conversion safely; the same request cannot charge you twice.");
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <form className="coin-converter" onSubmit={event => { event.preventDefault(); void convert(); }}>
    <div><h3>Convert coins to KP</h3><p>10 Kabayan Coins = 1 KP. Both are play-only, with no cash or real-world reward value.</p></div>
    <div className="coin-converter-controls"><label htmlFor="coin-conversion-amount">Coins to convert<input id="coin-conversion-amount" type="number" inputMode="numeric" min="10" max="1000000" step="10" value={amount} disabled={busy || !!pending} onChange={event => { setAmount(event.target.value); setMessage(""); setError(""); }} aria-describedby="coin-conversion-preview" /></label>
      <output id="coin-conversion-preview" aria-live="polite">{valid ? `${(coins / 10).toLocaleString()} KP` : "Use multiples of 10"}</output>
      <button type="submit" className="kh-button kh-button-primary" disabled={busy || !ready || !valid || (!pending && coins > balance)}>{busy ? "Converting…" : pending ? "Retry conversion" : `Convert ${valid ? coins.toLocaleString() : ""} coins`}</button></div>
    {!pending && valid && coins > balance && <p>Not enough coins for this amount. Your available balance is {balance.toLocaleString()}.</p>}
    {pending && !busy && !error && <p>A previous conversion needs checking. Retry to recover its saved result.</p>}
    {message && <p role="status" className="coin-conversion-success">{message}</p>}
    {error && <p role="alert" className="social-error">{error}</p>}
  </form>;
}
