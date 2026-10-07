// Explicit hosted check. Creates one disposable account and deletes that exact account.
// Node 24: node --env-file=.env.local --import tsx scripts/verify-arcade.ts
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  assert.ok(url && key && secret, "Supply the local server environment first.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, secret, options);
  const client = createClient(url, key, options);
  const email = `arcade-check-${Date.now()}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const uid = created.data.user!.id;
  try {
    assert.ok((await client.rpc("get_arcade_wallet")).error, "Anonymous wallet access rejected");
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    const rpc = async (name: string, args = {}) => {
      const result = await client.rpc(name, args);
      assert.ifError(result.error);
      return result.data;
    };
    assert.equal((await rpc("get_arcade_wallet")).balance, 1000);
    assert.equal((await rpc("get_arcade_wallet")).balance, 1000);
    await Promise.all([rpc("refill_arcade_wallet"), rpc("refill_arcade_wallet")]);
    assert.equal((await rpc("get_arcade_wallet")).balance, 1500);
    const requestId = randomUUID();
    const spin = () => rpc("play_kabayan_cascade", { p_request_id: requestId, p_stake: 10 });
    const [first, second] = await Promise.all([spin(), spin()]);
    assert.deepEqual(first, second, "Concurrent retries return the saved round");
    assert.equal(first.cost, 10);
    const wallet = await rpc("get_arcade_wallet");
    assert.equal(wallet.balance, 1490 + first.win);
    assert.equal(wallet.lastRound.id, requestId);
    assert.equal(wallet.history.filter((row: { kind: string }) => row.kind === "round").length, 1);
    assert.ok((await client.from("arcade_wallets").update({ balance: 999999 }).eq("user_id", uid)).error);
    assert.equal((await rpc("get_arcade_wallet")).balance, wallet.balance);
    console.log("PASS: hosted starter coins, daily refill concurrency, saved rounds, one charge per request, and direct-write rejection.");
  } finally {
    assert.ifError((await admin.auth.admin.deleteUser(uid)).error);
    console.log("Disposable arcade verification account removed.");
  }
}
main().catch(() => { console.error("Arcade verification failed. No credentials were logged."); process.exitCode = 1; });
