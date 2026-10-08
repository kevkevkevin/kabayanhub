import { requireBackend } from "./client";
export type AdminMember = { id: string; email: string | null; username: string; displayName: string; role: string; points: number; coins: number; walletInitialized: boolean; blocked: boolean; deleting: boolean; createdAt: string; lastSignInAt: string | null; confirmed: boolean };
export type UserPage = { users: AdminMember[]; total: number; page: number; pageSize: number };
export type UserAction = { requestId: string; userId: string; action: "balances" | "block" | "unblock" | "delete"; reason: string; points?: number; coins?: number; expectedPoints?: number; expectedCoins?: number; confirmation?: string };
export async function adminUsersRequest(query: string, action?: UserAction, signal?: AbortSignal) {
  const { data, error } = await requireBackend().auth.getSession();
  if (error || !data.session) throw new Error("Please sign in again.");
  const response = await fetch(`/api/admin/users${query}`, { method: action ? "POST" : "GET", headers: { Authorization: `Bearer ${data.session.access_token}`, ...(action ? { "Content-Type": "application/json" } : {}) }, body: action ? JSON.stringify(action) : undefined, cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Couldn’t complete the user request.");
  return result;
}
