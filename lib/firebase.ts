import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const app = !getApps().length ? initializeApp(useEmulators ? {
  apiKey: "demo-key", projectId: "demo-kabayan-social", authDomain: "demo-kabayan-social.firebaseapp.com", storageBucket: "demo-kabayan-social.appspot.com", appId: "demo-app",
} : firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Explicit, localhost-only opt-in for isolated development and browser tests.
const emulatorState = globalThis as typeof globalThis & { __kabayanEmulatorsConnected?: boolean };
if (useEmulators && typeof window !== "undefined" && !emulatorState.__kabayanEmulatorsConnected) {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) throw new Error("Emulator mode is only available on localhost.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8089);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  emulatorState.__kabayanEmulatorsConnected = true;
}
