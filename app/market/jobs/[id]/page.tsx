// app/market/jobs/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";

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

type JobApplication = {
  id: string;
  jobId: string;
  uid: string;
  name: string;
  age: number;
  mobile: string;
  email: string;
  hasValidIqama: boolean;
  cvUrl: string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  appliedAt: any;
};

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [existingApplication, setExistingApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Application form state
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [hasValidIqama, setHasValidIqama] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvPreview, setCvPreview] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getLocationHref = (location: string) => {
    if (!location || location.trim().length === 0) return "";
    const trimmed = location.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(trimmed)}`;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setEmail(u.email || "");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const loadJob = async () => {
      try {
        const jobDoc = await getDoc(doc(db, "jobs", jobId));
        if (!jobDoc.exists()) {
          setError("Job not found");
          return;
        }

        const data = jobDoc.data() as any;
        setJob({
          id: jobDoc.id,
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
      } catch (e) {
        console.error("Failed to load job:", e);
        setError("Failed to load job");
      }
    };

    const checkExistingApplication = async () => {
      if (!user) return;

      try {
        const q = query(
          collection(db, "jobApplications"),
          where("jobId", "==", jobId),
          where("uid", "==", user.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const appData = snap.docs[0].data() as any;
          setExistingApplication({
            id: snap.docs[0].id,
            jobId: appData.jobId,
            uid: appData.uid,
            name: appData.name || "",
            age: appData.age || 0,
            mobile: appData.mobile || "",
            email: appData.email || "",
            hasValidIqama: appData.hasValidIqama || false,
            cvUrl: appData.cvUrl || "",
            status: appData.status || "pending",
            appliedAt: appData.appliedAt,
          });

          // Pre-fill form with existing data
          setName(appData.name || "");
          setAge(appData.age?.toString() || "");
          setMobile(appData.mobile || "");
          setEmail(appData.email || "");
          setHasValidIqama(appData.hasValidIqama || false);
          setCvPreview(appData.cvUrl || "");
        }
      } catch (e) {
        console.error("Failed to check existing application:", e);
      }
    };

    loadJob();
    if (user) checkExistingApplication();
  }, [jobId, user]);

  useEffect(() => {
    if (job !== null) {
      setLoading(false);
    }
  }, [job]);

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes("pdf") && !file.type.includes("word") && !file.type.includes("document")) {
      setError("Please upload a PDF or Word document");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setCvFile(file);
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setCvPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const submitApplication = async () => {
    if (!user || !job) return;

    // Validation
    if (!name.trim() || !age || !mobile.trim() || !email.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    if (!hasValidIqama) {
      setError("You must have a valid Iqama to apply for jobs");
      return;
    }

    if (!cvFile && !existingApplication) {
      setError("Please upload your CV");
      return;
    }

    setApplying(true);
    setError(null);
    setStatus(null);

    try {
      let cvUrl = existingApplication?.cvUrl || "";

      // Upload CV if new file selected
      if (cvFile) {
        // For now, convert to base64. In production, use Firebase Storage
        cvUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(cvFile);
        });
      }

      const applicationData = {
        jobId,
        uid: user.uid,
        name: name.trim(),
        age: parseInt(age),
        mobile: mobile.trim(),
        email: email.trim(),
        hasValidIqama,
        cvUrl,
        status: "pending" as const,
        appliedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingApplication) {
        // Update existing application
        await setDoc(doc(db, "jobApplications", existingApplication.id), applicationData, { merge: true });
        setStatus("Application updated successfully! ✅");
      } else {
        // Create new application
        await setDoc(doc(db, "jobApplications", `${user.uid}_${jobId}`), applicationData);
        setStatus("Application submitted successfully! ✅");
      }

      // Refresh existing application data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (e) {
      console.error("Failed to submit application:", e);
      setError("Failed to submit application. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-[var(--kh-text-muted)]">Loading job details...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => router.push("/market/jobs")}
          className="text-sm text-[var(--kh-blue)] hover:underline"
        >
          ← Back to jobs
        </button>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <button
          onClick={() => router.push("/market/jobs")}
          className="text-sm text-[var(--kh-blue)] hover:underline"
        >
          ← Back to jobs
        </button>

        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
          <span className="kp-coin kp-coin-delay-2">💼</span>
          <span className="font-semibold uppercase tracking-wide">Job Details</span>
          <span className="text-[10px] text-[var(--kh-text-muted)]">apply now</span>
        </div>

        <button
          type="button"
          onClick={() => {
            const href = getLocationHref(job.location);
            if (href) window.open(href, "_blank", "noopener,noreferrer");
          }}
          className="text-left text-2xl font-semibold text-[var(--kh-text)] md:text-3xl hover:underline"
        >
          {job.title} - {job.location}
        </button>
      </header>

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Job Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Info Card */}
          <div className="kh-card">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    job.type === "full-time"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {job.type === "full-time" ? "Full Time" : "Part Time"}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    job.workingStatus === "open"
                      ? "bg-yellow-100 text-yellow-700"
                      : job.workingStatus === "currently-working"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {job.workingStatus === "open" ? "Open" : job.workingStatus === "currently-working" ? "Currently Working" : "Filled"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--kh-text)]">{job.salary}</p>
                  <p className="text-xs text-[var(--kh-text-muted)]">per month</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <span className="text-sm text-[var(--kh-text-secondary)]">{job.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🕒</span>
                  <span className="text-sm text-[var(--kh-text-secondary)]">{job.workingHours}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--kh-border)]">
                <span className="kp-coin">🟡</span>
                <span className="text-sm font-semibold text-[var(--kh-text)]">
                  Earn +{job.pointsEarn} KP per month
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="kh-card">
            <h3 className="text-lg font-semibold text-[var(--kh-text)] mb-3">Job Description</h3>
            <p className="text-sm text-[var(--kh-text-secondary)] whitespace-pre-wrap">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div className="kh-card">
              <h3 className="text-lg font-semibold text-[var(--kh-text)] mb-3">Requirements</h3>
              <ul className="space-y-2">
                {job.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-[var(--kh-text-secondary)]">
                    <span className="text-[var(--kh-blue)] mt-1">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Application Form */}
        <div className="lg:col-span-1">
          <div className="kh-card sticky top-4">
            <h3 className="text-lg font-semibold text-[var(--kh-text)] mb-4">
              {existingApplication ? "Update Application" : "Apply for this Job"}
            </h3>

            {existingApplication && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                existingApplication.status === "pending"
                  ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                  : existingApplication.status === "reviewed"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : existingApplication.status === "accepted"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                Status: {existingApplication.status.charAt(0).toUpperCase() + existingApplication.status.slice(1)}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Age *
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="Your age"
                  min="18"
                  max="65"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  WhatsApp Number *
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="+966 XX XXX XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-3">
                  Do you have a valid Iqama? *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="iqama"
                      checked={hasValidIqama === true}
                      onChange={() => setHasValidIqama(true)}
                      className="text-[var(--kh-blue)]"
                    />
                    <span className="text-sm text-[var(--kh-text-secondary)]">Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="iqama"
                      checked={hasValidIqama === false}
                      onChange={() => setHasValidIqama(false)}
                      className="text-[var(--kh-blue)]"
                    />
                    <span className="text-sm text-[var(--kh-text-secondary)]">No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  CV/Resume {!existingApplication && "*"}
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCvUpload}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[var(--kh-text-muted)] mt-1">
                  PDF or Word documents only, max 5MB
                </p>
                {cvPreview && (
                  <div className="mt-2 p-2 bg-[var(--kh-bg-subtle)] rounded text-xs">
                    📄 CV uploaded
                  </div>
                )}
              </div>

              <button
                onClick={submitApplication}
                disabled={applying || !user}
                className="w-full rounded-lg bg-[var(--kh-blue)] py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {applying
                  ? "Submitting..."
                  : existingApplication
                  ? "Update Application"
                  : "Submit Application"
                }
              </button>

              {!user && (
                <p className="text-xs text-[var(--kh-text-muted)] text-center">
                  Please log in to apply for jobs
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}