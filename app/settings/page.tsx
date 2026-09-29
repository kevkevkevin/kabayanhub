"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import ProfileEditor from "../components/social/ProfileEditor";
import { Avatar, useSocialProfile } from "../components/social/Profile";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

type UserProfile = {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
};

type JobApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  age: number;
  mobile: string;
  email: string;
  hasValidIqama: boolean;
  cvUrl: string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  appliedAt: any;
};

export default function SettingsPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const { profile: socialProfile } = useSocialProfile(authUser?.uid);
  const [loadingUser, setLoadingUser] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  const [error, setError] = useState<string | null>(null);

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
          setUsername(data.username || "");
        } else {
          setUsername("");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setError("Failed to load your profile. Please refresh.");
      } finally {
        setLoadingUser(false);
      }

      // Load job applications
      try {
        setLoadingApplications(true);
        const q = query(
          collection(db, "jobApplications"),
          where("uid", "==", u.uid)
        );
        const snap = await getDocs(q);
        const applications: JobApplication[] = [];

        for (const appDoc of snap.docs) {
          const appData = appDoc.data();

          // Get job title
          let jobTitle = "Unknown Job";
          try {
            const jobDoc = await getDoc(doc(db, "jobs", appData.jobId));
            if (jobDoc.exists()) {
              jobTitle = jobDoc.data()?.title || "Unknown Job";
            }
          } catch (e) {
            console.error("Failed to load job title:", e);
          }

          applications.push({
            id: appDoc.id,
            jobId: appData.jobId,
            jobTitle,
            name: appData.name || "",
            age: appData.age || 0,
            mobile: appData.mobile || "",
            email: appData.email || "",
            hasValidIqama: appData.hasValidIqama || false,
            cvUrl: appData.cvUrl || "",
            status: appData.status || "pending",
            appliedAt: appData.appliedAt,
          });
        }

        setJobApplications(applications);
      } catch (err) {
        console.error("Failed to load job applications:", err);
      } finally {
        setLoadingApplications(false);
      }
    });

    return () => unsub();
  }, [router]);

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
          {socialProfile ? <Avatar profile={socialProfile} /> : initial}
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
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <ProfileEditor key={authUser.uid} uid={authUser.uid} onSaved={profile => setUsername(profile.username)} />

      {/* Job Applications */}
      <section className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-4 shadow-[var(--kh-card-shadow)] md:p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--kh-text)]">Job Applications</h2>
            <p className="text-sm text-[var(--kh-text-secondary)]">
              Manage your job applications and update your information.
            </p>
          </div>

          {loadingApplications ? (
            <p className="text-sm text-[var(--kh-text-muted)]">Loading applications...</p>
          ) : jobApplications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--kh-text-muted)] mb-2">No job applications yet</p>
              <a
                href="/market/jobs"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Browse Jobs
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {jobApplications.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[var(--kh-text)]">{app.jobTitle}</h3>
                      <p className="text-sm text-[var(--kh-text-secondary)]">
                        Applied {app.appliedAt?.toDate ? app.appliedAt.toDate().toLocaleDateString() : "Recently"}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                      app.status === "pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : app.status === "reviewed"
                        ? "bg-blue-100 text-blue-700"
                        : app.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <span className="text-[var(--kh-text-secondary)]">Name:</span>
                      <span className="ml-2 text-[var(--kh-text)]">{app.name}</span>
                    </div>
                    <div>
                      <span className="text-[var(--kh-text-secondary)]">Age:</span>
                      <span className="ml-2 text-[var(--kh-text)]">{app.age}</span>
                    </div>
                    <div>
                      <span className="text-[var(--kh-text-secondary)]">WhatsApp:</span>
                      <span className="ml-2 text-[var(--kh-text)]">{app.mobile}</span>
                    </div>
                    <div>
                      <span className="text-[var(--kh-text-secondary)]">Email:</span>
                      <span className="ml-2 text-[var(--kh-text)]">{app.email}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-[var(--kh-text-secondary)]">Iqama:</span>
                    <span className={`text-sm ${app.hasValidIqama ? "text-green-600" : "text-red-600"}`}>
                      {app.hasValidIqama ? "✓ Valid" : "✗ Not valid"}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href={`/market/jobs/${app.jobId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm font-medium text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)]"
                    >
                      View Job
                    </a>
                    <a
                      href={`/market/jobs/${app.jobId}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--kh-blue)] px-3 py-2 text-sm font-medium text-white hover:brightness-110"
                    >
                      Update Application
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
