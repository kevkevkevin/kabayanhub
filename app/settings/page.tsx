"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

type UserProfile = {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to clean username (no spaces etc.)
  const sanitizeUsername = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, "") // remove spaces
      .replace(/[^a-z0-9_.-]/g, ""); // allow letters, numbers, _ . -
  };

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setAuthUser(u);
      setEmail(u.email ?? null);

      // Load Firestore user profile
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setDisplayName(data.displayName || u.displayName || "");
          setUsername(data.username || "");
        } else {
          // No doc yet – fall back to auth
          setDisplayName(u.displayName || "");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setError("Failed to load your profile. Please refresh.");
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setStatus(null);
    setError(null);

    const cleanUsername = sanitizeUsername(username);

    if (!cleanUsername) {
      setError("Please enter a valid username (letters/numbers only).");
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", authUser.uid);

      // Update Firestore profile
      await updateDoc(userRef, {
        displayName: displayName || email || null,
        username: cleanUsername,
        updatedAt: serverTimestamp(),
      });

      // Update Firebase Auth displayName (for convenience)
      await updateProfile(authUser, {
        displayName: displayName || cleanUsername,
      });

      setUsername(cleanUsername);
      setStatus("Profile updated successfully. ✨");
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      if (err?.code === "permission-denied") {
        setError("Permission denied. Please re-login and try again.");
      } else {
        setError("Failed to save your profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center text-sm text-[var(--kh-text-secondary)]">
        Loading your profile…
      </div>
    );
  }

  if (!authUser) {
    return null; // redirect already triggered
  }

  // Avatar initial: first letter of username or email
  const initial =
    (username && username[0]?.toUpperCase()) ||
    (email && email[0]?.toUpperCase()) ||
    "K";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 md:gap-8">
      {/* Header */}
      <header className="flex items-center gap-4 md:gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--kh-yellow-soft)] text-base font-bold text-slate-900 shadow-[var(--kh-card-shadow)] md:h-14 md:w-14 md:text-lg">
          {initial}
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-[var(--kh-text)] md:text-xl">
            Profile &amp; settings
          </h1>
          <p className="text-[11px] text-[var(--kh-text-secondary)] md:text-xs">
            Update how your name and username appear in Kabayan Hub.
          </p>
          {email && (
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Signed in as <span className="font-medium">{email}</span>
            </p>
          )}
        </div>
      </header>

      {/* Alerts */}
      {status && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Form card */}
      <section className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Name (optional)
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="Juan Dela Cruz"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-[10px] text-[var(--kh-text-muted)]">
              This is your friendly name on some pages. You can leave it blank
              if you prefer to just use your username.
            </p>
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="e.g. kabayan123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-[10px] text-[var(--kh-text-muted)]">
              This appears on your dashboard, leaderboard, and future profile
              pages. No spaces – letters, numbers, underscore, dot, and dash
              only.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Saving changes…" : "Save profile"}
          </button>
        </form>
      </section>

      {/* (Optional) coming-soon badges preview */}
      <section className="rounded-2xl border border-dashed border-[var(--kh-border)] bg-[var(--kh-bg-card)]/70 p-4 text-xs text-[var(--kh-text-secondary)] md:p-5">
        <p className="mb-2 text-[11px] font-semibold text-[var(--kh-text)]">
          Badges &amp; achievements (coming soon)
        </p>
        <p className="mb-3 text-[11px]">
          Soon you&apos;ll unlock badges for streaks, learning Arabic, watching
          tutorials, and redeeming marketplace rewards. Stay tuned, Kabayan. 💛
        </p>
        <div className="flex gap-2 text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kh-yellow-soft)]">
            🥇
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kh-blue-soft)]">
            📚
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kh-red-soft)]">
            🔥
          </span>
        </div>
      </section>
    </div>
  );
}
