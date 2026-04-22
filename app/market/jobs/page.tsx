// app/market/jobs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Job = {
  id: string;
  title: string;
  location: string;
  workingHours: string;
  shortDesc: string;
  pointsEarn: number;
  salary: string;
  type: "full-time" | "part-time";
  workingStatus: "open" | "currently-working" | "filled";
  description: string;
  requirements: string[];
  active: boolean;
  createdAt: any;
};

export default function JobsPage() {
  const [user, setUser] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const getLocationHref = (location: string) => {
    if (!location || location.trim().length === 0) return "";
    const trimmed = location.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(trimmed)}`;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const q = query(
          collection(db, "jobs"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const jobsList: Job[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          if (data.active) {
            jobsList.push({
              id: doc.id,
              title: data.title || "",
              location: data.location || "",
              workingHours: data.workingHours || "",
              shortDesc: data.shortDesc || "",
              pointsEarn: data.pointsEarn || 0,
              salary: data.salary || "",
              type: data.type || "full-time",
              workingStatus: data.workingStatus || "open",
              description: data.description || "",
              requirements: data.requirements || [],
              active: data.active || false,
              createdAt: data.createdAt,
            });
          }
        });
        setJobs(jobsList);
      } catch (e) {
        console.error("Failed to load jobs:", e);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-[var(--kh-text-muted)]">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
          <span className="kp-coin kp-coin-delay-2">💼</span>
          <span className="font-semibold uppercase tracking-wide">Jobs</span>
          <span className="text-[10px] text-[var(--kh-text-muted)]">find work</span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Job Board 💼
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Find job opportunities in Saudi Arabia. Apply with your CV and earn points while working.
        </p>
      </header>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--kh-text-muted)]">
            No jobs available at the moment. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/market/jobs/${job.id}`}
              className="kh-card card-hover block"
            >
              <div className="space-y-3">
                {/* Job Type Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${
                      job.type === "full-time"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {job.type === "full-time" ? "Full Time" : "Part Time"}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${
                      job.workingStatus === "open"
                        ? "bg-yellow-100 text-yellow-700"
                        : job.workingStatus === "currently-working"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {job.workingStatus === "open" ? "Open" : job.workingStatus === "currently-working" ? "Currently Working" : "Filled"}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--kh-text-muted)]">
                    {job.location}
                  </span>
                </div>

                {/* Title + location link */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const href = getLocationHref(job.location);
                    if (href) window.open(href, "_blank", "noopener,noreferrer");
                  }}
                  className="text-left text-lg font-semibold text-[var(--kh-text)] line-clamp-2 hover:underline"
                >
                  {job.title} - {job.location}
                </button>

                {/* Working Hours */}
                <div className="flex items-center gap-2 text-sm text-[var(--kh-text-secondary)]">
                  <span>🕒</span>
                  <span>{job.workingHours}</span>
                </div>

                {/* Short Description */}
                <p className="text-sm text-[var(--kh-text-secondary)] line-clamp-3">
                  {job.shortDesc}
                </p>

                {/* Salary & Points */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--kh-border)]">
                  <div className="flex items-center gap-1">
                    <span className="kp-coin">🟡</span>
                    <span className="text-sm font-semibold text-[var(--kh-text)]">
                      +{job.pointsEarn} KP/month
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--kh-text)]">
                      {job.salary}
                    </p>
                    <p className="text-[10px] text-[var(--kh-text-muted)]">
                      per month
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}