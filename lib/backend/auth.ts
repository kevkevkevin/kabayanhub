import type { User as SupabaseUser } from "@supabase/supabase-js";
import { requireBackend, supabase } from "./client";

export type User = { uid: string; email: string | null; displayName: string | null; photoURL: string | null };
const convert = (user: SupabaseUser | null): User | null => user ? ({ uid: user.id, email: user.email || null, displayName: user.user_metadata?.displayName || null, photoURL: user.user_metadata?.photoURL || null }) : null;
export const auth: { currentUser: User | null } = { currentUser: null };
export function onAuthStateChanged(_auth: typeof auth, listener: (user: User | null) => void) {
  // Supabase emits INITIAL_SESSION after loading the persisted browser session.
  // It also repeats SIGNED_IN on tab focus and TOKEN_REFRESHED in the background.
  // Those are not account changes: rebuilding subscribers would discard drafts.
  let active = true;
  let previous: string | undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    auth.currentUser = convert(session?.user || null);
    const user = auth.currentUser;
    const identity = JSON.stringify(user);
    if (identity === previous) return;
    previous = identity;
    // Run in a later task so Supabase releases its auth lock before app queries.
    setTimeout(() => { if (active) listener(user); }, 0);
  });
  return () => { active = false; data.subscription.unsubscribe(); };
}
export async function signInWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const { data, error } = await requireBackend().auth.signInWithPassword({ email, password });
  if (error) throw error;
  auth.currentUser = convert(data.user);
  return { user: auth.currentUser! };
}
export async function registerUser(email: string, password: string, username: string, displayName: string) {
  const { data, error } = await requireBackend().auth.signUp({ email, password, options: {
    data: { username, displayName }, emailRedirectTo: `${window.location.origin}/login`,
  } });
  if (error) throw error;
  auth.currentUser = convert(data.session?.user || null);
  return { needsConfirmation: !data.session };
}
export async function signOut(_auth: typeof auth) {
  void _auth;
  const { error } = await requireBackend().auth.signOut();
  if (error) throw error;
  auth.currentUser = null;
}
