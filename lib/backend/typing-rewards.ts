import { requireBackend } from "./client";
import type { Difficulty } from "../english-typing-rush";
import type { TypingAction } from "../typing-replay";

export async function typingRewardRequest(body: object) {
  const { data } = await requireBackend().auth.getSession();
  if (!data.session) throw new Error("Please sign in to earn Kabayan Points.");
  const response = await fetch("/api/typing-round", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Couldn’t connect to rewards. Please try again.");
  return result;
}
export async function startTypingReward(difficulty: Difficulty): Promise<{ id: string; seed: number; difficulty: Difficulty }> {
  return typingRewardRequest({ action: "start", difficulty });
}
export async function claimTypingReward(roundId: string, events: TypingAction[], endTick: number): Promise<{ awarded: boolean; amount: number; points: number; score: number }> {
  return typingRewardRequest({ action: "claim", roundId, events, endTick });
}
