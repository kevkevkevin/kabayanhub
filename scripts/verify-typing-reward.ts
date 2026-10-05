// Explicit hosted smoke test: creates one disposable account and deletes it on exit.
// Run with Node 24: node --env-file=.env.local --import tsx scripts/verify-typing-reward.ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { activateTypingPower, advanceTypingGame, seededTypingRandom, startTypingGame, TYPING_TICK_SECONDS } from "../lib/english-typing-rush";

async function main() {
  const endpoint = "http://localhost:3003/api/typing-round";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  assert.ok(url && key && secret, "Supply the local server environment first.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, secret, options);
  const client = createClient(url, key, options);
  const email = `typing-check-${Date.now()}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const uid = created.data.user!.id;
  try {
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    const token = login.data.session!.access_token;
    const request = async (body: object, authenticated = true) => {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await request({ action: "start", difficulty: "fast" }, false)).status, 401);
    const start = await request({ action: "start", difficulty: "fast" });
    assert.equal(start.status, 200);
    const startedAt = Date.now();
    const random = seededTypingRandom(start.body.seed);
    let game = activateTypingPower(startTypingGame("fast", random), "wind");
    let tick = 0;
    while (game.status === "running") { game = advanceTypingGame(game, TYPING_TICK_SECONDS, random); tick++; }
    const events = [{ tick: 0, kind: "power", power: "wind" }];
    const claim = { action: "claim", roundId: start.body.id, events, endTick: tick, score: 999999 };
    assert.equal((await request(claim)).status, 400, "Cannot claim faster than real elapsed time");
    assert.equal((await request({ ...claim, endTick: 1 })).status, 400, "Cannot claim unfinished rounds");
    console.log(`Waiting ${Math.ceil(tick * TYPING_TICK_SECONDS)} seconds for the valid round's real duration.`);
    await setTimeout(Math.max(0, tick * TYPING_TICK_SECONDS * 1000 - (Date.now() - startedAt)) + 300);
    const reward = await request(claim);
    assert.equal(reward.status, 200);
    assert.equal(reward.body.score, 10, "Server ignores the forged score field");
    assert.equal(reward.body.amount, 1);
    assert.equal(reward.body.awarded, true);
    const duplicate = await request(claim);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.awarded, false);
    assert.equal(duplicate.body.points, reward.body.points);
    const activities = await admin.from("activities").select("id").eq("parent_id", uid).eq("id", `englishTypingRush_${start.body.id}`);
    assert.ifError(activities.error);
    assert.equal(activities.data!.length, 1);
    assert.ok((await client.rpc("credit_typing_round", { p_round_id: start.body.id, p_user_id: uid, p_score: 100000 })).error, "Browser cannot invoke trusted credit directly");
    console.log("PASS: authentication, elapsed time, completed-round verification, server score, 10:1 reward, duplicate claim, one activity, and direct-credit rejection.");
  } finally {
    const deleted = await admin.auth.admin.deleteUser(uid);
    assert.ifError(deleted.error);
    console.log("Disposable typing verification account removed.");
  }
}
main().catch(() => { console.error("Typing reward verification failed. No credentials were logged."); process.exitCode = 1; });
