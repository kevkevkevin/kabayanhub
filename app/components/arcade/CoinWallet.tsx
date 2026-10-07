"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../../../lib/backend/auth";
import { getArcadeWallet, refillArcadeWallet, type ArcadeWallet } from "../../../lib/backend/arcade";
import Icon from "../Icon";

export function useCoinWallet(uid: string) {
  const [wallet, setWallet] = useState<ArcadeWallet | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await getArcadeWallet();
      if (request === generation.current && auth.currentUser?.uid === uid) { setWallet(next); setError(""); }
    } catch { if (request === generation.current) setError("Couldn’t load your coins. Please retry."); }
  }, [uid]);
  useEffect(() => {
    let active = true;
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    queueMicrotask(() => { if (active) void refresh(); });
    window.addEventListener("kabayan-coins-updated", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 30000);
    return () => { active = false; invalidate(); clearInterval(timer); window.removeEventListener("kabayan-coins-updated", visible); document.removeEventListener("visibilitychange", visible); };
  }, [refresh, invalidate]);
  return { wallet, error, refresh };
}
export function CoinBalance({ balance }: { balance?: number }) {
  return <span className="coin-balance"><span className="coin-token" aria-hidden="true">K</span><strong>{balance === undefined ? "…" : balance.toLocaleString()}</strong><span>Kabayan Coins</span></span>;
}
export function CoinRefill({ wallet, onRefilled }: { wallet: ArcadeWallet; onRefilled: () => void }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function claim() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await refillArcadeWallet(); onRefilled(); window.dispatchEvent(new Event("kabayan-coins-updated")); }
    catch { setError("Couldn’t claim your refill. Retry safely; it can only be credited once a day."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div><button type="button" className="kh-button kh-button-secondary" disabled={busy || !wallet.canRefill} onClick={() => void claim()}><Icon name="gift" width={16} />{busy ? "Adding coins…" : wallet.canRefill ? "+500 daily free coins" : "Daily coins claimed"}</button>{error && <p role="alert" className="social-error">{error}</p>}</div>;
}
export default function CoinWalletCard({ uid }: { uid: string }) {
  const { wallet, error, refresh } = useCoinWallet(uid);
  return <section className="kh-card dashboard-coins" aria-label="Kabayan Coin wallet"><div><p className="kh-eyebrow">YOUR ARCADE WALLET</p><CoinBalance balance={wallet?.balance} /><p>Saved to your account. Free play coins for Kabayan games, separate from redeemable KP.</p></div><div className="dashboard-coins-actions">{wallet && <CoinRefill wallet={wallet} onRefilled={() => void refresh()} />}<Link className="kh-button kh-button-primary" href="/kabayan-cascade">Play Kabayan Cascade <Icon name="play" width={16} /></Link></div>{error && <p role="alert" className="social-error">{error} <button onClick={() => void refresh()}>Retry</button></p>}</section>;
}
