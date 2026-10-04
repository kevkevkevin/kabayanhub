import { claimReward } from "./backend/rewards";
// Amounts and duplicate protection are enforced by the database.
export async function givePoints(_amount: number, type: string, refId?: string, _options?: { oncePerItem?: boolean }) {
  const result = await claimReward(type, refId);
  if (!result.awarded) throw new Error("already-earned");
  return result;
}
