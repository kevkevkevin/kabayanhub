import { test } from "node:test";
import assert from "node:assert/strict";
import { hydrate, Timestamp, collection, doc, resolveReference } from "../lib/backend/db";
import { db } from "../lib/backend/client";

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
