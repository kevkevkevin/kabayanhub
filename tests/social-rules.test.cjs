const { before, beforeEach, after, test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp, Timestamp, query, where, orderBy, documentId, limit, startAfter, getCountFromServer } = require("firebase/firestore");
const { ref, uploadBytes, getBytes } = require("firebase/storage");
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("Use npm run test:social; local emulators are required.");
let env;
const dbFor = uid => env.authenticatedContext(uid).firestore();
const profileData = (username = "alice") => ({ username, displayName: username, bio: "Hello, Kabayan!", photoPath: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const postData = (uid = "alice", text = "Hello from Riyadh!") => ({ uid, text, createdAt: serverTimestamp() });
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-kabayan-social", firestore: { rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8") }, storage: { rules: readFileSync(resolve(__dirname, "../storage.rules"), "utf8") } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const uid of ["alice", "bob", "admin"]) {
      await setDoc(doc(db, "users", uid), { role: uid === "admin" ? "admin" : "user", points: 20, email: `${uid}@example.test` });
      await setDoc(doc(db, "socialProfiles", uid), profileData(uid));
      await setDoc(doc(db, "socialHandles", uid), { uid });
    }
    await setDoc(doc(db, "socialPosts", "first"), postData());
  });
});
after(async () => env?.cleanup());

test("a profile and unique handle are created atomically", async () => {
  const db = dbFor("new-member");
  const batch = writeBatch(db);
  batch.set(doc(db, "socialProfiles", "new-member"), profileData("new_member"));
  batch.set(doc(db, "socialHandles", "new_member"), { uid: "new-member" });
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(dbFor("bob"), "socialHandles", "new_member"), { uid: "bob" }));
});

test("renaming reserves the new handle and releases the old one", async () => {
  const db = dbFor("alice");
  const batch = writeBatch(db);
  batch.update(doc(db, "socialProfiles", "alice"), { username: "new_alice", updatedAt: serverTimestamp() });
  batch.set(doc(db, "socialHandles", "new_alice"), { uid: "alice" });
  batch.delete(doc(db, "socialHandles", "alice"));
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(doc(db, "socialHandles", "alice"))).exists(), false);
  await assertFails(deleteDoc(doc(db, "socialHandles", "new_alice")));
});

test("profiles reject impersonation, invalid handles, private fields and another user's photo", async () => {
  const db = dbFor("alice");
  await assertFails(updateDoc(doc(db, "socialProfiles", "bob"), { bio: "hijacked", updatedAt: serverTimestamp() }));
  for (const invalid of [{ username: "bob" }, { username: "BAD HANDLE" }, { bio: "x".repeat(161) }, { role: "admin" }, { email: "private@example.test" }, { photoPath: "social/avatars/bob/avatar.jpg" }]) {
    await assertFails(updateDoc(doc(db, "socialProfiles", "alice"), { ...invalid, updatedAt: serverTimestamp() }));
  }
  await assertSucceeds(updateDoc(doc(db, "socialProfiles", "alice"), { bio: "Updated bio", photoPath: "social/avatars/alice/avatar.jpg", updatedAt: serverTimestamp() }));
});

test("guests can read public profiles and posts but cannot post", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "socialProfiles", "alice")));
  await assertSucceeds(getDocs(collection(db, "socialPosts")));
  await assertFails(setDoc(doc(db, "socialPosts", "guest"), postData()));
});

test("posts enforce identity, timestamps, text limits and no reward fields", async () => {
  const db = dbFor("alice");
  await assertSucceeds(setDoc(doc(db, "socialPosts", "multiline"), postData("alice", "Kumusta!\nHello from Riyadh.")));
  for (const invalid of [postData("bob"), postData("alice", " "), postData("alice", "x".repeat(501)), { ...postData(), points: 100 }, { ...postData(), createdAt: Timestamp.fromMillis(0) }]) {
    await assertFails(setDoc(doc(db, "socialPosts", "invalid"), invalid));
  }
  await assertFails(setDoc(doc(dbFor("no-profile"), "socialPosts", "missing-profile"), postData("no-profile")));
});

test("following and profile feeds support ordered cursor pagination", async () => {
  const db = dbFor("alice");
  for (let i = 0; i < 3; i++) await setDoc(doc(db, "socialPosts", `page-${i}`), postData());
  const base = [where("uid", "in", ["alice"]), orderBy("createdAt", "desc"), orderBy(documentId(), "desc")];
  const first = await getDocs(query(collection(db, "socialPosts"), ...base, limit(2)));
  const last = first.docs.at(-1);
  const next = await getDocs(query(collection(db, "socialPosts"), ...base, startAfter(last.data().createdAt, last.id), limit(2)));
  assert.equal(new Set([...first.docs, ...next.docs].map(d => d.id)).size, 4);
});

test("likes are one per user, countable, and cannot be forged or overwritten", async () => {
  const db = dbFor("bob");
  const mine = doc(db, "socialPosts", "first", "likes", "bob");
  await assertSucceeds(setDoc(mine, { uid: "bob", createdAt: serverTimestamp() }));
  assert.equal((await getCountFromServer(collection(db, "socialPosts", "first", "likes"))).data().count, 1);
  await assertFails(setDoc(doc(db, "socialPosts", "first", "likes", "alice"), { uid: "alice", createdAt: serverTimestamp() }));
  await assertFails(updateDoc(mine, { uid: "alice" }));
  await assertSucceeds(deleteDoc(mine));
});

test("replies enforce authorship and cannot be added under missing posts", async () => {
  const db = dbFor("bob");
  const reply = doc(db, "socialPosts", "first", "replies", "reply");
  await assertSucceeds(setDoc(reply, postData("bob", "Salamat!")));
  await assertFails(deleteDoc(doc(dbFor("alice"), "socialPosts", "first", "replies", "reply")));
  await assertFails(setDoc(doc(db, "socialPosts", "first", "replies", "too-long"), postData("bob", "x".repeat(281))));
  await assertFails(setDoc(doc(db, "socialPosts", "missing", "replies", "reply"), postData("bob")));
  await assertSucceeds(deleteDoc(reply));
});

test("following belongs to the follower and self-follow is denied", async () => {
  const db = dbFor("alice");
  const follow = doc(db, "socialProfiles", "alice", "following", "bob");
  await assertSucceeds(setDoc(follow, { createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "socialProfiles", "alice", "following", "alice"), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(dbFor("bob"), "socialProfiles", "alice", "following", "admin"), { createdAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(follow));
});

test("reports are private and only admins can resolve or remove another user's post", async () => {
  const db = dbFor("bob");
  const report = doc(db, "socialReports", "first_bob");
  await assertSucceeds(getDoc(report));
  await assertSucceeds(setDoc(report, { uid: "bob", postId: "first", reason: "spam", status: "open", createdAt: serverTimestamp() }));
  await assertFails(getDoc(doc(dbFor("alice"), "socialReports", "first_bob")));
  await assertFails(updateDoc(report, { status: "reviewed", reviewedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, "socialPosts", "first")));
  const admin = dbFor("admin");
  await assertSucceeds(updateDoc(doc(admin, "socialReports", "first_bob"), { status: "reviewed", reviewedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(admin, "socialPosts", "first")));
});

test("social interactions leave Kabayan Points unchanged", async () => {
  const db = dbFor("alice");
  await setDoc(doc(db, "socialPosts", "no-reward"), postData());
  await setDoc(doc(db, "socialPosts", "first", "likes", "alice"), { uid: "alice", createdAt: serverTimestamp() });
  await setDoc(doc(db, "socialPosts", "first", "replies", "no-reward"), postData());
  await setDoc(doc(db, "socialProfiles", "alice", "following", "bob"), { createdAt: serverTimestamp() });
  assert.equal((await getDoc(doc(db, "users", "alice"))).data().points, 20);
});

test("avatar storage permits only the owner's bounded JPEG upload", async () => {
  const owner = env.authenticatedContext("alice").storage();
  const other = env.authenticatedContext("bob").storage();
  const path = "social/avatars/alice/avatar.jpg";
  const bytes = new Uint8Array([255, 216, 255, 217]);
  await assertSucceeds(uploadBytes(ref(owner, path), bytes, { contentType: "image/jpeg" }));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  await assertFails(uploadBytes(ref(other, path), bytes, { contentType: "image/jpeg" }));
  await assertFails(uploadBytes(ref(owner, path), bytes, { contentType: "image/svg+xml" }));
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/jpeg" }));
});
