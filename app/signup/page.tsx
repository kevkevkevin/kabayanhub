// app/signup/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import AuthAside from "../components/AuthAside";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupUsername.trim()) {
      setError("Please choose a username.");
      return;
    }

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (signupUsername.includes(" ")) {
      setError("Username cannot contain spaces.");
      return;
    }

    setLoading(true);
    try {
      // Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const finalDisplayName =
        signupUsername || displayName || email.split("@")[0];

      // Update Firebase Auth profile (optional but nice)
      await updateProfile(cred.user, {
        displayName: finalDisplayName,
      });

      // Create Firestore user doc
      const userRef = doc(db, "users", cred.user.uid);
      await setDoc(userRef, {
        email,
        username: signupUsername,
        displayName: finalDisplayName,
        points: 0,
        role: "user",
        createdAt: serverTimestamp(),
        lastVisit: serverTimestamp(),
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Signup failed:", err);
      let msg = "Failed to sign up. Please try again.";
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        msg = "This email is already registered. Try logging in instead.";
      } else if (code === "auth/weak-password") {
        msg = "Password is too weak. Please use at least 6 characters.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kh-auth-layout">
      <AuthAside />
      <div className="kh-auth-form">
        <div className="mb-7 space-y-2">
          <p className="kh-eyebrow">THERE’S A PLACE FOR YOU HERE</p>
          <h1 className="text-xl font-semibold text-[var(--kh-text)]">
            Join Kabayan Hub
          </h1>
          <p className="text-xs text-[var(--kh-text-secondary)]">
            Create your free Kabayan profile and start earning Kabayan Points
            from news, tutorials, and daily check-ins.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Name (optional) */}
          <div className="space-y-1">
            <label htmlFor="signup-name" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Name (optional)
            </label>
            <input
              id="signup-name"
              autoComplete="name"
              type="text"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="Juan Dela Cruz"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label htmlFor="signup-username" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Username
            </label>
            <input
              id="signup-username"
              autoComplete="username"
              type="text"
              required
              minLength={3}
              maxLength={20}
              placeholder="e.g. kabayan123"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value.trim())}
            />
            <p className="text-[10px] text-[var(--kh-text-muted)]">
              This will show on the leaderboard and dashboard. No spaces, keep
              it wholesome 😊
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="signup-email" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="signup-password" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Password
            </label>
            <input
              id="signup-password"
              minLength={6}
              type="password"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-[var(--kh-text-muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
