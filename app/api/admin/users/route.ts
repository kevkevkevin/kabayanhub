import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function administrator(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return { response: reply({ error: "Sign in as an administrator." }, 401) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret) return { response: reply({ error: "User management is temporarily unavailable." }, 503) };
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, key, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const identity = await client.auth.getUser(token);
  if (identity.error || !identity.data.user) return { response: reply({ error: "Please sign in again." }, 401) };
  const profile = await client.from("users").select("data").eq("id", identity.data.user.id).maybeSingle();
  if (profile.error || profile.data?.data.role !== "admin" || profile.data.data.blocked === true) return { response: reply({ error: "Administrator access required." }, 403) };
  return { client, service: createClient(url, secret, options) };
}
export async function GET(request: Request) {
  const context = await administrator(request);
  if (context.response) return context.response;
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || "0");
  const search = (params.get("search") || "").trim();
  const status = params.get("status") || "all";
  if (!Number.isInteger(page) || page < 0 || page > 100000 || search.length > 100 || !["all", "active", "blocked"].includes(status)) return reply({ error: "Invalid user filter." }, 400);
  const { data, error } = await context.client!.rpc("admin_list_users", { p_search: search, p_page: page, p_status: status });
  return error ? reply({ error: "Couldn’t load users. Please retry." }, 503) : reply(data);
}
export async function POST(request: Request) {
  const context = await administrator(request);
  if (context.response) return context.response;
  let body;
  try { const raw = await request.text(); if (raw.length > 4000) return reply({ error: "Request too large." }, 413); body = JSON.parse(raw); }
  catch { return reply({ error: "Invalid request." }, 400); }
  if (!body || !uuid(body.requestId) || !uuid(body.userId) || !["balances", "block", "unblock", "delete"].includes(body.action) || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 250) return reply({ error: "Choose an action and provide a reason." }, 400);
  if (body.action === "delete" && body.confirmation !== `DELETE ${body.userId}`) return reply({ error: "Confirm deletion of this specific account." }, 400);
  if (body.action === "balances" && ![body.points, body.coins, body.expectedPoints, body.expectedCoins].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000)) return reply({ error: "Balances must be whole numbers between 0 and 1,000,000,000." }, 400);
  const { data, error } = await context.client!.rpc("admin_user_action", { p_request_id: body.requestId, p_target: body.userId, p_action: body.action, p_values: { reason: body.reason.trim(), points: body.points, coins: body.coins, expectedPoints: body.expectedPoints, expectedCoins: body.expectedCoins } });
  if (error) return reply({ error: error.code === "40001" ? "Balances changed while you were editing. Close this form, refresh, and try again." : error.message }, error.code === "42501" ? 403 : 409);
  if (body.action === "balances") return reply({ result: data });
  const service = context.service!;
  if (body.action === "delete") {
    const target = await service.auth.admin.getUserById(body.userId);
    const missing = target.error?.status === 404 || target.error?.code === "user_not_found";
    if (target.error && !missing) return reply({ error: "The account is blocked, but deletion could not finish. Retry this action." }, 503);
    if (!missing) {
      const ban = await service.auth.admin.updateUserById(body.userId, { ban_duration: "876000h" });
      if (ban.error) return reply({ error: "The account is blocked. Retry to finish deleting it." }, 503);
      const removed = await service.storage.from("avatars").remove([`social/avatars/${body.userId}/avatar.jpg`]);
      if (removed.error) return reply({ error: "The account is blocked, but avatar cleanup failed. Retry deletion." }, 503);
      const deleted = await service.auth.admin.deleteUser(body.userId);
      if (deleted.error) return reply({ error: "The account is blocked, but deletion could not finish. Retry this action." }, 503);
    }
  } else {
    // The database is authoritative; re-read it when synchronizing Auth bans.
    let synced = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await service.from("users").select("data").eq("id", body.userId).single();
      if (current.error) break;
      const blocked = current.data.data.blocked === true;
      const changed = await service.auth.admin.updateUserById(body.userId, { ban_duration: blocked ? "876000h" : "none" });
      if (changed.error) break;
      const latest = await service.from("users").select("data").eq("id", body.userId).single();
      if (!latest.error && (latest.data.data.blocked === true) === blocked) { synced = true; break; }
    }
    if (!synced) return reply({ error: "Hub access was updated, but sign-in synchronization needs a retry. Retry this same action." }, 503);
  }
  const audit = await service.from("admin_user_audit").update({ outcome: "completed" }).eq("request_id", body.requestId);
  if (audit.error) return reply({ error: "The account action finished, but its audit status needs a retry. Retry safely." }, 503);
  return reply({ result: data, deleted: body.action === "delete" });
}
