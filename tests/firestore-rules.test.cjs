const { before, beforeEach, after, test } = require("node:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc, setDoc, updateDoc, deleteDoc, deleteField,
  serverTimestamp, writeBatch, increment,
} = require("firebase/firestore");

// Never run these writes against a real Firebase project.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Run npm run test:rules to start the local Firestore emulator.");
}

let environment;
const dbFor = uid => environment.authenticatedContext(uid).firestore();
const profile = db => doc(db, "users", "member");

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-kabayan-rules",
    firestore: { rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(profile(db), { role: "user", username: "member", points: 5 }),
      setDoc(doc(db, "users", "admin"), { role: "admin", username: "admin" }),
      setDoc(doc(db, "users", "legacy"), { username: "legacy" }),
    ]);
  });
});

after(async () => { await environment?.cleanup(); });

test("the existing signup payload can create a regular user", async () => {
  await assertSucceeds(setDoc(doc(dbFor("new-user"), "users", "new-user"), {
    email: "new@example.test", username: "newuser", displayName: "New User",
    points: 0, role: "user", createdAt: serverTimestamp(), lastVisit: serverTimestamp(),
  }));
});

test("signup cannot choose admin, an arbitrary role, or omit the role", async () => {
  const ref = doc(dbFor("new-user"), "users", "new-user");
  for (const fields of [{ role: "admin" }, { role: "moderator" }, { role: null }, {}]) {
    await assertFails(setDoc(ref, { username: "newuser", ...fields }));
  }
});

test("profile edits and existing non-social activity updates still work", async () => {
  const db = dbFor("member");
  await assertSucceeds(updateDoc(profile(db), {
    displayName: "Updated Name", username: "updated", updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(profile(db), { lastVisit: serverTimestamp(), points: increment(1) }));
  await assertSucceeds(setDoc(doc(db, "users", "member", "activity", "check-in"), {
    type: "check-in", createdAt: serverTimestamp(),
  }));
});

test("update and merge writes cannot elevate a user's role", async () => {
  const ref = profile(dbFor("member"));
  await assertFails(updateDoc(ref, { role: "admin" }));
  await assertFails(setDoc(ref, { role: "admin" }, { merge: true }));
});

test("replacement writes must retain the existing role", async () => {
  const ref = profile(dbFor("member"));
  await assertFails(setDoc(ref, { username: "replacement", role: "admin" }));
  await assertFails(setDoc(ref, { username: "replacement" }));
  await assertSucceeds(setDoc(ref, { username: "replacement", role: "user" }));
});

test("role deletion and deleting a profile for recreation are denied", async () => {
  const ref = profile(dbFor("member"));
  await assertFails(updateDoc(ref, { role: deleteField() }));
  await assertFails(deleteDoc(ref));
});

test("legacy profiles can be edited but cannot acquire an admin role", async () => {
  const ref = doc(dbFor("legacy"), "users", "legacy");
  await assertSucceeds(updateDoc(ref, { displayName: "Legacy Member" }));
  await assertFails(updateDoc(ref, { role: "admin" }));
  await assertFails(setDoc(ref, { role: "admin" }, { merge: true }));
});

test("users cannot create, edit or delete someone else's profile", async () => {
  const db = dbFor("outsider");
  await assertFails(setDoc(doc(db, "users", "someone-new"), { role: "user" }));
  await assertFails(updateDoc(profile(db), { username: "hijacked" }));
  await assertFails(deleteDoc(profile(db)));
});

test("anonymous clients cannot write profiles", async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "users", "new-user"), { role: "user" }));
  await assertFails(updateDoc(profile(db), { username: "hijacked" }));
  await assertFails(deleteDoc(profile(db)));
});

test("trusted existing admins retain profile editing and admin operations", async () => {
  const db = dbFor("admin");
  await assertSucceeds(updateDoc(doc(db, "users", "admin"), { displayName: "Admin Name" }));
  await assertSucceeds(setDoc(doc(db, "news", "admin-post"), { title: "Community news" }));
  await assertFails(updateDoc(doc(db, "users", "admin"), { role: "user" }));
  await assertFails(deleteDoc(doc(db, "users", "admin")));
});

test("failed self-promotion does not unlock admin-only collections", async () => {
  const db = dbFor("member");
  await assertFails(updateDoc(profile(db), { role: "admin" }));
  await assertFails(setDoc(doc(db, "news", "unauthorized-post"), { title: "Unauthorized" }));
});

test("an atomic batch cannot combine self-promotion with an admin write", async () => {
  const db = dbFor("member");
  const batch = writeBatch(db);
  batch.update(profile(db), { role: "admin" });
  batch.set(doc(db, "news", "batched-post"), { title: "Unauthorized" });
  await assertFails(batch.commit());
});
