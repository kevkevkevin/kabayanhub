import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const backendConfigured = !!url && !!key;
// The placeholder permits Next.js prerendering without opening a connection.
// Runtime calls fail clearly when the deployment environment is incomplete.
export const supabase = createClient(url || "http://127.0.0.1:54321", key || "not-configured", {
  auth: { persistSession: typeof window !== "undefined", autoRefreshToken: typeof window !== "undefined", detectSessionInUrl: typeof window !== "undefined" },
});
export function requireBackend() {
  if (!backendConfigured) throw new Error("The app connection is not configured. Please contact the site administrator.");
  return supabase;
}
export const db = { kind: "supabase" } as const;
export const storage = db;
