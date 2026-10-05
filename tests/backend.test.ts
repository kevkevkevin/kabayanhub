import { test } from "node:test";
import assert from "node:assert/strict";
import { hydrate, Timestamp, collection, doc, resolveReference } from "../lib/backend/db";
import { db, supabase } from "../lib/backend/client";
import { auth, onAuthStateChanged, type User } from "../lib/backend/auth";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { setTimeout as nextTask } from "node:timers/promises";

test("timestamp decoding preserves ISO-looking user text and date-only tracker values", () => {
  const iso="2026-09-30T12:30:00.123Z";
  const value=hydrate({createdAt:iso,text:iso,date:"2026-09-30",nested:{updatedAt:iso}}) as {createdAt:Timestamp;text:string;date:string;nested:{updatedAt:Timestamp}};
  assert.ok(value.createdAt instanceof Timestamp);
  assert.equal(value.createdAt.toDate().toISOString(),iso);
  assert.equal(value.text,iso);
  assert.equal(value.date,"2026-09-30");
  assert.ok(value.nested.updatedAt instanceof Timestamp);
});
test("nested collection paths cannot escape their feature tables", () => {
  assert.deepEqual(resolveReference(doc(db,"socialPosts","post","replies","reply")),{table:"replies",parent:"post",id:"reply"});
  assert.throws(()=>resolveReference(collection(db,"users","someone","likes")));
  assert.throws(()=>resolveReference(collection(db,"unknown")));
});

test("auth focus and token refresh preserve drafts while account changes still notify", async t => {
  let emit!: (event: AuthChangeEvent, session: Session | null) => void;
  let unsubscribed = false;
  t.mock.method(supabase.auth, "onAuthStateChange", (callback: typeof emit) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
  });
  const seen: (User | null)[] = [];
  const stop = onAuthStateChanged(auth, user => seen.push(user));
  const session = (id: string, name = "Editor") => ({ user: { id, email: `${id}@example.test`, user_metadata: { displayName: name } } } as unknown as Session);
  emit("INITIAL_SESSION", session("editor"));
  assert.equal(seen.length, 0, "Callbacks must leave the auth lock before making queries");
  await nextTask(0);
  assert.equal(seen.length, 1);
  emit("SIGNED_IN", session("editor")); // Returning from another browser tab.
  emit("TOKEN_REFRESHED", session("editor"));
  await nextTask(0);
  assert.equal(seen.length, 1, "Same-account events must not rebuild the editor");
  emit("USER_UPDATED", session("editor", "Updated name"));
  await nextTask(0);
  assert.equal(seen.at(-1)?.displayName, "Updated name");
  emit("SIGNED_IN", session("other-editor"));
  await nextTask(0);
  assert.equal(seen.at(-1)?.uid, "other-editor");
  emit("SIGNED_OUT", null);
  await nextTask(0);
  assert.equal(seen.at(-1), null);
  assert.equal(auth.currentUser, null);
  const count = seen.length;
  emit("SIGNED_IN", session("editor"));
  stop();
  await nextTask(0);
  assert.equal(seen.length, count, "Unsubscribed callbacks must not run");
  assert.equal(unsubscribed, true);
});

test("each auth subscriber receives its initial session, including signed-out users", async t => {
  const callbacks: ((event: AuthChangeEvent, session: Session | null) => void)[] = [];
  t.mock.method(supabase.auth, "onAuthStateChange", (callback: typeof callbacks[number]) => {
    callbacks.push(callback);
    return { data: { subscription: { unsubscribe() {} } } };
  });
  const seen: (User | null)[][] = [[], []];
  const stops = seen.map(list => onAuthStateChanged(auth, user => list.push(user)));
  callbacks.forEach(callback => callback("INITIAL_SESSION", null));
  await nextTask(0);
  assert.deepEqual(seen, [[null], [null]]);
  stops.forEach(stop => stop());
});
