// Explicit hosted verification: touches only accounts created by this script.
// Node 24: node --env-file=.env.local --import tsx scripts/verify-admin-users.ts
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GET, POST } from "../app/api/admin/users/route";

let stage = "configuration";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  assert.ok(url && publicKey && secret);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(url, secret, options);
  const createdIds: string[] = [];
  const deletedIds = new Set<string>();
  const suffix = Date.now();
  async function create(kind: string) {
    const email = `admin-check-${kind}-${suffix}@example.test`;
    const password = randomBytes(24).toString("base64url");
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    const id = created.data.user!.id; createdIds.push(id);
    const client = createClient(url, publicKey, options);
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    return { id, client, token: login.data.session!.access_token, email, password };
  }
  try {
    stage = "create disposable accounts";
    const manager = await create("admin");
    const member = await create("member");
    const ownProfile = await service.from("users").select("data").eq("id", manager.id).single();
    assert.ifError(ownProfile.error);
    assert.ifError((await service.from("users").update({ data: { ...ownProfile.data!.data, role: "admin" } }).eq("id", manager.id)).error);
    const request = (token?: string, body?: object, search = member.email) => new Request(`http://localhost/api/admin/users?search=${encodeURIComponent(search)}`, { method: body ? "POST" : "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    stage = "authorization and private listing";
    assert.equal((await GET(request())).status, 401);
    assert.equal((await GET(request(member.token))).status, 403);
    const listed = await GET(request(manager.token));
    assert.equal(listed.status, 200);
    const page = await listed.json(); assert.equal(page.total, 1); assert.equal(page.users[0].id, member.id);
    const edit = { requestId: randomUUID(), userId: member.id, action: "balances", reason: "Disposable verification", points: 42, coins: 750, expectedPoints: 0, expectedCoins: 1000 };
    assert.equal((await POST(request(member.token, edit))).status, 403);
    stage = "atomic balances and retries";
    const [first, retry] = await Promise.all([POST(request(manager.token, edit)), POST(request(manager.token, edit))]);
    assert.equal(first.status, 200); assert.equal(retry.status, 200); assert.deepEqual(await first.json(), await retry.json());
    assert.equal((await POST(request(manager.token, { ...edit, requestId: randomUUID() }))).status, 409);
    const wallet = await member.client.rpc("get_arcade_wallet"); assert.ifError(wallet.error); assert.equal(wallet.data.balance, 750);
    stage = "protected admin account";
    assert.equal((await POST(request(manager.token, { requestId: randomUUID(), userId: manager.id, action: "block", reason: "Must reject" }))).status, 403);
    stage = "blocking active tokens and sign-in";
    const block = { requestId: randomUUID(), userId: member.id, action: "block", reason: "Disposable block test" };
    assert.equal((await POST(request(manager.token, block))).status, 200);
    assert.ok((await member.client.rpc("get_arcade_wallet")).error);
    assert.ok((await member.client.auth.signInWithPassword({ email: member.email, password: member.password })).error);
    stage = "unblock and restore access";
    assert.equal((await POST(request(manager.token, { ...block, requestId: randomUUID(), action: "unblock" }))).status, 200);
    assert.ifError((await member.client.auth.signInWithPassword({ email: member.email, password: member.password })).error);
    assert.ifError((await member.client.rpc("get_arcade_wallet")).error);
    stage = "confirmed deletion and cleanup";
    const deletion = { requestId: randomUUID(), userId: member.id, action: "delete", reason: "Disposable deletion test" };
    assert.equal((await POST(request(manager.token, deletion))).status, 400);
    const confirmed = { ...deletion, confirmation: `DELETE ${member.id}` };
    const deleted = await POST(request(manager.token, confirmed));
    assert.equal(deleted.status, 200); deletedIds.add(member.id);
    assert.equal((await POST(request(manager.token, confirmed))).status, 200);
    const profile = await service.from("users").select("id").eq("id", member.id); assert.ifError(profile.error); assert.equal(profile.data!.length, 0);
    const audit = await service.from("admin_user_audit").select("outcome").eq("request_id", deletion.requestId); assert.ifError(audit.error); assert.equal(audit.data![0].outcome, "completed");
    console.log("PASS: admin-only listing, balance edits/retries, stale edits, admin protection, active-session block, Auth ban, unblock, confirmed deletion, cleanup, and retained audit.");
  } finally {
    for (const id of createdIds) if (!deletedIds.has(id)) assert.ifError((await service.auth.admin.deleteUser(id)).error);
    console.log("Disposable verification accounts removed.");
  }
}
main().catch(() => { console.error(`Admin user verification failed at: ${stage}. No credentials were logged.`); process.exitCode = 1; });
