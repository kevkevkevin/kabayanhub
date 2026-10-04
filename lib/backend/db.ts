/* A small document-shaped repository interface preserves the existing pages.
 * Each feature has its own PostgreSQL table and RLS policies; filtering, ordering,
 * limits, counts, and cursors execute on the server, never over a downloaded DB.
 */
import { db, requireBackend } from "./client";

// Existing UI models contain heterogeneous CMS data; keep it at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;
export class Timestamp {
  constructor(public seconds: number, public nanoseconds = 0) {}
  static fromDate(date: Date) { const ms = date.getTime(); return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static now() { return Timestamp.fromDate(new Date()); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6; }
  toJSON() { return this.toDate().toISOString(); }
}
const timestampFields = new Set(["createdAt", "updatedAt", "lastVisit", "lastDailyCheckin", "lastArabicQuiz", "appliedAt", "redeemedAt", "expiresAt", "claimedAt"]);
export function hydrate(value: unknown, field = ""): unknown {
  if (timestampFields.has(field) && typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value)) return Timestamp.fromDate(new Date(value));
  if (Array.isArray(value)) return value.map(item => hydrate(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hydrate(v, k)]));
  return value;
}
export const serverTimestamp = () => ({ __hub_op: "timestamp" });
export const increment = (amount: number) => ({ __hub_op: "increment", amount });
type Reference = { path: string; id: string; kind: "collection" | "document"; constraints: QueryConstraint[] };
export type QueryConstraint = { kind: "where"; field: string; op: string; value: unknown } | { kind: "order"; field: string; direction: "asc" | "desc" } | { kind: "limit"; count: number } | { kind: "cursor"; values: unknown[] };
const tables: Record<string, string> = {
  users: "users", leaderboard: "leaderboard", news: "news", videos: "videos", marketplaceItems: "marketplace_items", marketplacePurchases: "marketplace_purchases", marketRestaurants: "market_restaurants", marketSupermarkets: "market_supermarkets", marketProducts: "market_products", jobs: "jobs", jobApplications: "job_applications", tambayanStickers: "tambayan_stickers", tambayanChat: "tambayan_chat", tambayanConfig: "tambayan_config", tambayanLive: "tambayan_live", moments: "moments", arabicWordRushConfig: "arabic_word_rush_config", socialProfiles: "social_profiles", socialPosts: "social_posts", socialReports: "social_reports", activity: "activities", budgetEntries: "budget_entries", calorieEntries: "calorie_entries", following: "follows", likes: "likes", replies: "replies",
};
export function resolveReference(reference: Reference) {
  const parts = reference.path.split("/");
  const isDocument = reference.kind === "document";
  const collectionParts = isDocument ? parts.slice(0, -1) : parts;
  const collectionName = collectionParts.at(-1)!;
  const table = tables[collectionName];
  if (!table || ![1, 3].includes(collectionParts.length)) throw new Error("Unknown data collection");
  if (collectionParts.length === 3) {
    const permitted: Record<string, string[]> = { users: ["activity", "budgetEntries", "calorieEntries"], socialProfiles: ["following"], socialPosts: ["likes", "replies"] };
    if (!permitted[collectionParts[0]]?.includes(collectionName)) throw new Error("Invalid collection path");
  }
  return { table, parent: collectionParts.length === 3 ? collectionParts[1] : "", id: isDocument ? parts.at(-1)! : undefined };
}
export function collection(base: typeof db | Reference, ...parts: string[]): Reference {
  const path = [...("path" in base ? [base.path] : []), ...parts].join("/");
  return { path, id: path.split("/").at(-1)!, kind: "collection", constraints: [] };
}
export function doc(base: typeof db | Reference, ...parts: string[]): Reference {
  if ("path" in base && !parts.length) parts = [crypto.randomUUID()];
  const path = [...("path" in base ? [base.path] : []), ...parts].join("/");
  return { path, id: path.split("/").at(-1)!, kind: "document", constraints: [] };
}
export const where = (field: string, op: string, value: unknown): QueryConstraint => ({ kind: "where", field, op, value });
export const orderBy = (field: string, direction: "asc" | "desc" = "asc"): QueryConstraint => ({ kind: "order", field, direction });
export const limit = (count: number): QueryConstraint => ({ kind: "limit", count });
export const documentId = () => "__name__";
export const startAfter = (...values: unknown[]): QueryConstraint => ({ kind: "cursor", values });
export const query = (base: Reference, ...constraints: QueryConstraint[]): Reference => ({ ...base, constraints: [...base.constraints, ...constraints] });
export class QueryDocumentSnapshot {
  constructor(public id: string, private value: Data, public ref: Reference) {}
  data(): Data { return this.value; }
  exists() { return true; }
}
class DocumentSnapshot {
  constructor(public id: string, private value: Data | undefined, public ref: Reference) {}
  data(): Data | undefined { return this.value; }
  exists(): this is this & { data(): Data } { return this.value !== undefined; }
}
function queryArgs(reference: Reference) {
  const { table, parent } = resolveReference(reference);
  const constraints = reference.constraints.map(c => {
    if (c.kind !== "cursor" || !(c.values[0] instanceof QueryDocumentSnapshot)) return c;
    const snapshot = c.values[0];
    const orders = reference.constraints.filter(c => c.kind === "order");
    if (!orders.some(o => o.field === "__name__")) orders.push({ kind: "order", field: "__name__", direction: orders.at(-1)?.direction || "asc" });
    return { kind: "cursor", values: orders.map(o => o.field === "__name__" ? snapshot.id : snapshot.data()[o.field]) };
  });
  return { p_table: table, p_parent: parent, p_constraints: JSON.parse(JSON.stringify(constraints)) };
}
export async function getDoc(reference: Reference) {
  const { table, parent, id } = resolveReference(reference);
  const { data, error } = await requireBackend().from(table).select("id,data").eq("parent_id", parent).eq("id", id!).maybeSingle();
  if (error) throw error;
  return new DocumentSnapshot(reference.id, data ? hydrate(data.data) as Data : undefined, reference);
}
export async function getDocs(reference: Reference) {
  const { data, error } = await requireBackend().rpc("hub_query", queryArgs(reference));
  if (error) throw error;
  const docs = ((data || []) as { id: string; data: Data }[]).map(row => new QueryDocumentSnapshot(row.id, hydrate(row.data) as Data, doc(reference, row.id)));
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn: (doc: QueryDocumentSnapshot) => void) => docs.forEach(fn) };
}
export async function getCountFromServer(reference: Reference) {
  const { table, parent } = resolveReference(reference);
  const { count, error } = await requireBackend().from(table).select("id", { count: "exact", head: true }).eq("parent_id", parent);
  if (error) throw error;
  return { data: () => ({ count: count || 0 }) };
}
async function write(reference: Reference, data: Data, mode: string) {
  const { table, parent, id } = resolveReference(reference);
  const { error } = await requireBackend().rpc("hub_write", { p_table: table, p_parent: parent, p_id: id, p_data: JSON.parse(JSON.stringify(data)), p_mode: mode });
  if (error) throw error;
}
export const setDoc = (reference: Reference, data: Data, options?: { merge: boolean }) => write(reference, data, options?.merge ? "merge" : "set");
export const updateDoc = (reference: Reference, data: Data) => write(reference, data, "update");
export const deleteDoc = (reference: Reference) => write(reference, {}, "delete");
export async function addDoc(reference: Reference, data: Data) { const target = doc(reference); await setDoc(target, data); return target; }

type QueryResult = Awaited<ReturnType<typeof getDocs>>;
export function onSnapshot(reference: Reference, next: (snapshot: QueryResult & DocumentSnapshot) => void, failure?: (error: Error) => void) {
  const { table, parent, id } = resolveReference(reference);
  const client = requireBackend();
  let active = true;
  let sequence = 0;
  const refresh = async () => {
    const current = ++sequence;
    try {
      const snapshot = reference.kind === "document" ? await getDoc(reference) : await getDocs(reference);
      if (active && current === sequence) next(snapshot as QueryResult & DocumentSnapshot);
    } catch (error) { if (active) failure?.(error as Error); }
  };
  const channel = client.channel(`hub-${crypto.randomUUID()}`).on("postgres_changes", {
    event: "*", schema: "public", table, filter: id ? `id=eq.${id}` : `parent_id=eq.${parent}`,
  }, () => { void refresh(); }).subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
  void refresh();
  // Recovers missed events after network interruptions or deleted rows under RLS.
  const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
  const visibility = () => { if (document.visibilityState === "visible") void refresh(); };
  document.addEventListener("visibilitychange", visibility);
  return () => { active = false; clearInterval(interval); document.removeEventListener("visibilitychange", visibility); void client.removeChannel(channel); };
}
