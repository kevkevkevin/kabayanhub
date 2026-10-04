// app/login/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent,useState } from "react";
import { auth } from "../../lib/backend";
import { signInWithEmailAndPassword } from "../../lib/backend/auth";
import AuthAside from "../components/AuthAside";

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
    } catch (err: unknown) {
      console.error("Login failed:", err);
      setError(
        (err as { code?: string })?.code === "invalid_credentials"
          ? "Invalid email or password."
          : (err as { code?: string })?.code === "email_not_confirmed"
          ? "Please confirm your email using the link in your inbox, then log in."
          : "Failed to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kh-auth-layout">
      <AuthAside />
      <div className="kh-auth-form">
        <div className="mb-7 space-y-2">
          <p className="kh-eyebrow">YOUR COMMUNITY IS WAITING</p>
          <h1 className="text-xl font-semibold text-[var(--kh-text)]">
            Welcome back, Kabayan
          </h1>
          <p className="text-xs text-[var(--kh-text-secondary)]">
            Log in to continue earning Kabayan Points and tracking your
            progress.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label htmlFor="login-email" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Email
            </label>
            <input
              id="login-email"
              required
              type="email"
              className="w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Password
            </label>
            <input
              id="login-password"
              required
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
