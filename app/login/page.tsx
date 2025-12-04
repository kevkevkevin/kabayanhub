// app/login/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(
        err?.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : "Failed to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-6 shadow-[var(--kh-card-shadow)] md:p-8">
        <div className="mb-5 space-y-2 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--kh-yellow)] text-xs font-black text-slate-900">
            KH
          </div>
          <h1 className="text-xl font-semibold text-[var(--kh-text)]">
            Welcome back, Kabayan
          </h1>
          <p className="text-xs text-[var(--kh-text-secondary)]">
            Log in to continue earning Kabayan Points and tracking your
            progress.
          </p>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-full bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-[var(--kh-text-muted)]">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[var(--kh-blue)] underline-offset-2 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
