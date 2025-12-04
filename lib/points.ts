// lib/points.ts
import { auth, db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/**
 * Give points to the currently logged-in user and log an activity entry.
 *
 * options.oncePerItem = true  → only give once per (user, type, refId)
 */
export async function givePoints(
  amount: number,
  type: string,
  refId?: string,
  options?: { oncePerItem?: boolean }
) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("not-logged-in");
  }

  const uid = user.uid;
  const userRef = doc(db, "users", uid);

  if (options?.oncePerItem && refId) {
    // Use deterministic doc ID so we can detect duplicates
    const activityId = `${type}_${refId}`;
    const activityRef = doc(db, "users", uid, "activity", activityId);

    const existing = await getDoc(activityRef);
    if (existing.exists()) {
      throw new Error("already-earned");
    }

    // 1) Increase points
    await updateDoc(userRef, {
      points: increment(amount),
      lastVisit: serverTimestamp(),
    });

    // 2) Log activity
    await setDoc(activityRef, {
      type,
      refId,
      amount,
      createdAt: serverTimestamp(),
    });
  } else {
    // Fallback: no uniqueness check
    await updateDoc(userRef, {
      points: increment(amount),
      lastVisit: serverTimestamp(),
    });

    const activityCol = collection(db, "users", uid, "activity");
    await addDoc(activityCol, {
      type,
      refId: refId || null,
      amount,
      createdAt: serverTimestamp(),
    });
  }
}
