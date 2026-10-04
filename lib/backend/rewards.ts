import { requireBackend } from "./client";
export async function claimReward(type: string, reference = "", score = 0): Promise<{ awarded: boolean; points: number; amount: number }> {
  const { data, error } = await requireBackend().rpc("claim_reward", { p_type: type, p_ref: reference, p_score: score });
  if (error) throw new Error(error.message);
  return data;
}
export async function redeemItem(id: string): Promise<{ points: number; stock: number | null; price: number }> {
  const { data, error } = await requireBackend().rpc("redeem_item", { p_item_id: id });
  if (error) throw new Error(error.message);
  return data;
}
