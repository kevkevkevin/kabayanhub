import { requireBackend } from "./client";

export type CascadeStage = { board: number[]; positions: number[]; wins: { symbol: number; count: number; coins: number }[]; coins: number; boost: number };
export type CascadeRound = { id: string; stake: number; cost: number; win: number; balance: number; stages: CascadeStage[]; multiplier: number; baseWin: number; bonusSpins: number; bonusAdded: number; wasBonus: boolean; bonusMultiplier: number; capped: boolean };
export type CoinTransaction = { id: string; kind: "starter" | "daily_refill" | "round" | "conversion" | "admin_adjustment"; game_id: string | null; amount: number; balance: number; created_at: string };
export type CoinConversion = { id: string; coins: number; earned: number; balance: number; points: number; createdAt: string };
export async function convertCoins(requestId: string, coins: number): Promise<CoinConversion> {
  const { data, error } = await requireBackend().rpc("convert_arcade_coins", { p_request_id: requestId, p_coins: coins });
  if (error) throw error;
  return data;
}
export type ArcadeWallet = { balance: number; canRefill: boolean; bonusSpins: number; bonusStake: number; bonusMultiplier: number; lastRound: CascadeRound | null; history: CoinTransaction[] };
export async function getArcadeWallet(): Promise<ArcadeWallet> {
  const { data, error } = await requireBackend().rpc("get_arcade_wallet");
  if (error) throw new Error(error.message);
  return data;
}
export async function refillArcadeWallet(): Promise<ArcadeWallet> {
  const { data, error } = await requireBackend().rpc("refill_arcade_wallet");
  if (error) throw new Error(error.message);
  return data;
}
export async function playCascade(requestId: string, stake: number): Promise<CascadeRound> {
  const { data, error } = await requireBackend().rpc("play_kabayan_cascade", { p_request_id: requestId, p_stake: stake });
  if (error) throw new Error(error.message);
  return data;
}
