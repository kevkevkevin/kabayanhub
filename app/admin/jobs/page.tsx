// app/admin/jobs/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";

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
  jobTitle: string;
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

type UserDetails = {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  role?: string;
  createdAt?: any;
};

export default function AdminJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Job Applications
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [showApplications, setShowApplications] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [pointsEarn, setPointsEarn] = useState("");
  const [salary, setSalary] = useState("");
  const [type, setType] = useState<"full-time" | "part-time">("full-time");
  const [workingStatus, setWorkingStatus] = useState<"open" | "currently-working" | "filled">("open");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("Auth state changed:", u ? "logged in" : "logged out"); // Debug log
      setUser(u || null);
      setIsAdmin(false);

      if (!u) {
        setLoading(false);
        router.push("/");
        return;
      }

      console.log("User ID:", u.uid); // Debug log
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          console.log("User data:", data); // Debug log
          console.log("User role:", data?.role); // Debug log
          if (data?.role === "admin") {
            setIsAdmin(true);
          } else {
            console.log("User is not admin, redirecting"); // Debug log
            router.push("/");
          }
        } else {
          console.log("User document does not exist, redirecting"); // Debug log
          router.push("/");
        }
      } catch (e) {
        console.error("Failed to verify admin", e);
        router.push("/");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // Load jobs
  useEffect(() => {
    if (!isAdmin) return;

    const loadJobs = async () => {
      try {
        const snap = await getDocs(collection(db, "jobs"));
        const jobsList: Job[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
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
            active: data.active !== false,
            createdAt: data.createdAt,
          });
        });
        setJobs(jobsList.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));
      } catch (e) {
        console.error("Failed to load jobs:", e);
        setError("Failed to load jobs");
      }
    };

    loadJobs();
  }, [isAdmin]);

  const resetForm = () => {
    setTitle("");
    setLocation("");
    setWorkingHours("");
    setShortDesc("");
    setPointsEarn("");
    setSalary("");
    setType("full-time");
    setWorkingStatus("open");
    setDescription("");
    setRequirements("");
    setActive(true);
    setEditingJob(null);
    setShowAddForm(false);
  };

  const startEdit = (job: Job) => {
    setEditingJob(job);
    setTitle(job.title);
    setLocation(job.location);
    setWorkingHours(job.workingHours);
    setShortDesc(job.shortDesc);
    setPointsEarn(job.pointsEarn.toString());
    setSalary(job.salary);
    setType(job.type);
    setWorkingStatus(job.workingStatus);
    setDescription(job.description);
    setRequirements(job.requirements.join("\n"));
    setActive(job.active);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!title.trim() || !location.trim() || !description.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const jobData = {
        title: title.trim(),
        location: location.trim(),
        workingHours: workingHours.trim(),
        shortDesc: shortDesc.trim(),
        pointsEarn: parseInt(pointsEarn) || 0,
        salary: salary.trim(),
        type,
        workingStatus,
        description: description.trim(),
        requirements: requirements.split("\n").filter(req => req.trim()),
        active,
        updatedAt: serverTimestamp(),
      };

      if (editingJob) {
        // Update existing job
        await updateDoc(doc(db, "jobs", editingJob.id), jobData);
        setStatus("Job updated successfully! ✅");
      } else {
        // Create new job
        const newJobRef = doc(collection(db, "jobs"));
        await setDoc(newJobRef, {
          ...jobData,
          createdAt: serverTimestamp(),
        });
        setStatus("Job created successfully! ✅");
      }

      // Reload jobs
      const snap = await getDocs(collection(db, "jobs"));
      const jobsList: Job[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
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
          active: data.active !== false,
          createdAt: data.createdAt,
        });
      });
      setJobs(jobsList.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));

      resetForm();
    } catch (e) {
      console.error("Failed to save job:", e);
      setError("Failed to save job. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "jobs", jobId), {
        active: !currentStatus,
        updatedAt: serverTimestamp(),
      });

      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, active: !currentStatus } : job
      ));

      setStatus(`Job ${!currentStatus ? "activated" : "deactivated"} successfully! ✅`);
    } catch (e) {
      console.error("Failed to toggle job status:", e);
      setError("Failed to update job status");
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "jobs", jobId));
      setJobs(jobs.filter(job => job.id !== jobId));
      setStatus("Job deleted successfully! ✅");
    } catch (e) {
      console.error("Failed to delete job:", e);
      setError("Failed to delete job");
    }
  };

  // Load job applications
  const loadJobApplications = async () => {
    try {
      const snap = await getDocs(collection(db, "jobApplications"));
      const applications: JobApplication[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        applications.push({
          id: doc.id,
          jobId: data.jobId || "",
          jobTitle: data.jobTitle || "",
          uid: data.uid || "",
          name: data.name || "",
          age: data.age || 0,
          mobile: data.mobile || "",
          email: data.email || "",
          hasValidIqama: data.hasValidIqama || false,
          cvUrl: data.cvUrl || "",
          status: data.status || "pending",
          appliedAt: data.appliedAt,
        });
      });
      setJobApplications(applications.sort((a, b) => (b.appliedAt?.toDate?.() || 0) - (a.appliedAt?.toDate?.() || 0)));
    } catch (e) {
      console.error("Failed to load applications:", e);
      setError("Failed to load applications");
    }
  };

  // View user details
  const viewUserDetails = async (uid: string) => {
    setLoadingUserDetails(true);
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setSelectedUser({
          uid,
          displayName: userData.displayName,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          createdAt: userData.createdAt,
        });
        setShowUserModal(true);
      }
    } catch (e) {
      console.error("Failed to load user details:", e);
      setError("Failed to load user details");
    } finally {
      setLoadingUserDetails(false);
    }
  };

  // Update application status
  const updateApplicationStatus = async (applicationId: string, newStatus: "pending" | "reviewed" | "accepted" | "rejected") => {
    try {
      await updateDoc(doc(db, "jobApplications", applicationId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setJobApplications(applications =>
        applications.map(app =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
      setStatus(`Application status updated to ${newStatus}! ✅`);
    } catch (e) {
      console.error("Failed to update application status:", e);
      setError("Failed to update application status");
    }
  };

  if (loading) {
    console.log("Rendering loading state"); // Debug log
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-[var(--kh-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    console.log("Rendering not admin state, isAdmin:", isAdmin, "user:", user?.uid); // Debug log
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-red-600">
          Redirecting...
        </p>
      </div>
    );
  }

  console.log("Rendering admin content, isAdmin:", isAdmin); // Debug log

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
          <span className="kp-coin kp-coin-delay-2">⚙️</span>
          <span className="font-semibold uppercase tracking-wide">Admin Panel</span>
          <span className="text-[10px] text-[var(--kh-text-muted)]">Job Management</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
              Job Board Management 💼
            </h1>
            <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
              Create and manage job listings for the Kabayan Hub job board.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            {showAddForm ? "Cancel" : "+ Add Job"}
          </button>
        </div>
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

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-6">
          <h2 className="text-lg font-semibold text-[var(--kh-text)] mb-4">
            {editingJob ? "Edit Job" : "Add New Job"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="e.g. Restaurant Server"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="e.g. Riyadh, Saudi Arabia"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Working Hours
                </label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="e.g. 9 AM - 5 PM, Monday-Friday"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Salary
                </label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="e.g. SAR 3,000-4,000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Points Earned (per month)
                </label>
                <input
                  type="number"
                  value={pointsEarn}
                  onChange={(e) => setPointsEarn(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                  placeholder="e.g. 500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Job Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "full-time" | "part-time")}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                >
                  <option value="full-time">Full Time</option>
                  <option value="part-time">Part Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                  Position Status
                </label>
                <select
                  value={workingStatus}
                  onChange={(e) => setWorkingStatus(e.target.value as "open" | "currently-working" | "filled")}
                  className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="currently-working">Currently Working</option>
                  <option value="filled">Filled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                placeholder="Brief job description for the card"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                Full Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                placeholder="Detailed job description..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--kh-text-secondary)] mb-1">
                Requirements (one per line)
              </label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm"
                placeholder="Valid Iqama&#10;Previous experience&#10;Good communication skills"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="active" className="text-sm text-[var(--kh-text-secondary)]">
                Active (visible to users)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--kh-blue)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingJob ? "Update Job" : "Create Job"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2 text-sm font-medium text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Jobs List */}
      <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-6">
        <h2 className="text-lg font-semibold text-[var(--kh-text)] mb-4">
          Job Listings ({jobs.length})
        </h2>

        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--kh-text-muted)]">No jobs created yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--kh-text)]">{job.title}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        job.type === "full-time"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {job.type}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        job.workingStatus === "open"
                          ? "bg-yellow-100 text-yellow-700"
                          : job.workingStatus === "currently-working"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {job.workingStatus === "open" ? "Open" : job.workingStatus === "currently-working" ? "Currently Working" : "Filled"}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        job.active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {job.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--kh-text-secondary)]">{job.location}</p>
                    <p className="text-sm text-[var(--kh-text-secondary)] mt-1">{job.shortDesc}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(job)}
                      className="rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-1 text-xs font-medium text-[var(--kh-text)] hover:bg-[var(--kh-bg-subtle)]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleJobStatus(job.id, job.active)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium ${
                        job.active
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {job.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-[var(--kh-text-secondary)]">
                  <span>💰 {job.salary}</span>
                  <span>🕒 {job.workingHours}</span>
                  <span>🟡 +{job.pointsEarn} KP/month</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Applications Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--kh-text)]">Job Applications 📋</h2>
            <p className="text-sm text-[var(--kh-text-secondary)]">
              Review and manage job applications from users.
            </p>
          </div>
          <button
            onClick={() => {
              setShowApplications(!showApplications);
              if (!showApplications && jobApplications.length === 0) {
                loadJobApplications();
              }
            }}
            className="rounded-lg bg-[var(--kh-green)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            {showApplications ? "Hide Applications" : "View Applications"}
          </button>
        </div>

        {showApplications && (
          <div className="space-y-4">
            {jobApplications.length === 0 ? (
              <div className="rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] p-6 text-center">
                <p className="text-sm text-[var(--kh-text-secondary)]">No job applications yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {jobApplications.map((application) => (
                  <div key={application.id} className="rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-[var(--kh-text)]">{application.name}</h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            application.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : application.status === "reviewed"
                              ? "bg-blue-100 text-blue-700"
                              : application.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {application.status}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--kh-text-secondary)] mb-1">
                          Applied for: <span className="font-medium">{application.jobTitle}</span>
                        </p>
                        <p className="text-sm text-[var(--kh-text-secondary)] mb-1">
                          Age: {application.age} | Mobile: {application.mobile}
                        </p>
                        <p className="text-sm text-[var(--kh-text-secondary)] mb-1">
                          Email: {application.email}
                        </p>
                        <p className="text-sm text-[var(--kh-text-secondary)] mb-1">
                          Valid Iqama: {application.hasValidIqama ? "Yes" : "No"}
                        </p>
                        {application.cvUrl && (
                          <p className="text-sm text-[var(--kh-text-secondary)]">
                            CV: <a href={application.cvUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--kh-blue)] hover:underline">View CV</a>
                          </p>
                        )}
                        <p className="text-xs text-[var(--kh-text-muted)] mt-2">
                          Applied: {application.appliedAt?.toDate?.().toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => viewUserDetails(application.uid)}
                          disabled={loadingUserDetails}
                          className="rounded-lg bg-[var(--kh-blue)] px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {loadingUserDetails ? "Loading..." : "View User"}
                        </button>
                        <select
                          value={application.status}
                          onChange={(e) => updateApplicationStatus(application.id, e.target.value as any)}
                          className="rounded-lg border border-[var(--kh-border)] bg-[var(--kh-bg)] px-2 py-1 text-xs"
                        >
                          <option value="pending">Pending</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-[var(--kh-bg)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--kh-text)]">User Details</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-[var(--kh-text-secondary)] hover:text-[var(--kh-text)]"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">Display Name</label>
                <p className="text-sm text-[var(--kh-text)]">{selectedUser.displayName || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">Username</label>
                <p className="text-sm text-[var(--kh-text)]">{selectedUser.username || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">Email</label>
                <p className="text-sm text-[var(--kh-text)]">{selectedUser.email || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">Role</label>
                <p className="text-sm text-[var(--kh-text)]">{selectedUser.role || "user"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">User ID</label>
                <p className="text-xs text-[var(--kh-text-secondary)] font-mono">{selectedUser.uid}</p>
              </div>
              {selectedUser.createdAt && (
                <div>
                  <label className="block text-sm font-medium text-[var(--kh-text-secondary)]">Joined</label>
                  <p className="text-sm text-[var(--kh-text-secondary)]">
                    {selectedUser.createdAt?.toDate?.().toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}