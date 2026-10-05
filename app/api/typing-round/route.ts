import { createClient } from "@supabase/supabase-js";
import { TYPING_TICK_SECONDS, type Difficulty } from "../../../lib/english-typing-rush";
import { replayTypingRound } from "../../../lib/typing-replay";

export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serverKey) return reply({ error: "Rewards are temporarily unavailable. Please try again later." }, 503);
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: "Sign in to earn Kabayan Points." }, 401);
  const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: identity, error: authError } = await authClient.auth.getUser(token);
  if (authError || !identity.user) return reply({ error: "Please sign in again." }, 401);
  if (Number(request.headers.get("content-length") || 0) > 1200000) return reply({ error: "Round recording is too large." }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1200000) return reply({ error: "Round recording is too large." }, 413);
    body = JSON.parse(raw);
  } catch { return reply({ error: "Invalid round request." }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "Invalid round request." }, 400);
  if (body.action === "start") {
    if (!["easy", "steady", "fast"].includes(body.difficulty)) return reply({ error: "Choose a valid pace." }, 400);
    const { data, error } = await authClient.rpc("start_typing_round", { p_difficulty: body.difficulty });
    return error ? reply({ error: "Couldn’t start a reward round. Please try again." }, 503) : reply(data);
  }
  if (body.action !== "claim" || typeof body.roundId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.roundId)) return reply({ error: "Invalid round request." }, 400);
  const service = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: round, error } = await service.from("typing_rounds").select("id,seed,difficulty,created_at,status").eq("id", body.roundId).eq("user_id", identity.user.id).maybeSingle();
  if (error) return reply({ error: "Couldn’t verify this round. Please try again." }, 503);
  if (!round) return reply({ error: "Round not found for this account." }, 404);
  if (round.status === "abandoned" || Date.now() - Date.parse(round.created_at) > 86400000) return reply({ error: "This round expired or was replaced by a new round." }, 409);
  let result;
  try {
    if (!Number.isInteger(body.endTick) || body.endTick * TYPING_TICK_SECONDS > (Date.now() - Date.parse(round.created_at)) / 1000 + 1) throw new Error("Invalid round duration");
    result = replayTypingRound(round.seed, round.difficulty as Difficulty, body.events, body.endTick);
  } catch { return reply({ error: "This round could not be verified. Please complete a new round to earn points." }, 400); }
  const { data: reward, error: creditError } = await service.rpc("credit_typing_round", { p_round_id: round.id, p_user_id: identity.user.id, p_score: result.score });
  if (creditError) return reply({ error: "Couldn’t credit this round. Please retry; the same round can only be rewarded once." }, 409);
  return reply({ ...reward, score: result.score });
}
