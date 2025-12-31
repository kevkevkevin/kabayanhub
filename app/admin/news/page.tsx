// app/admin/news/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic"; // 1. Import dynamic
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";

// 3. Dynamically import ReactQuill-New
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
import "react-quill-new/dist/quill.snow.css";

type NewsDoc = {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  tag?: string;
  createdAt?: any;
  reward?: number;
  shareReward?: number;
};

// 4. Configure Editor Toolbar (Add image support)
const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"], // ✅ Enables the image button and image pasting
    ["clean"],
  ],
};

function formatDate(value: any) {
  try {
    let d: Date | null = null;
    if (!value) return "";
    if (value instanceof Date) d = value;
    else if (value instanceof Timestamp) d = value.toDate();
    else if (typeof value?.toDate === "function") d = value.toDate();
    else if (typeof value === "string") d = new Date(value);

    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function AdminNewsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [posts, setPosts] = useState<NewsDoc[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState(""); // ReactQuill will update this string with HTML
  const [imageUrl, setImageUrl] = useState("");
  const [tag, setTag] = useState("");
  const [reward, setReward] = useState<string>("10");
  const [shareReward, setShareReward] = useState<string>("5");
  const [saving, setSaving] = useState(false);

  // ✅ Admin gate
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const role = snap.exists() ? (snap.data() as any).role : null;
        const ok = role === "admin";
        setIsAdmin(ok);
        if (!ok) {
          router.push("/dashboard");
          return;
        }
      } catch (e) {
        console.error(e);
        router.push("/dashboard");
      } finally {
        setBooting(false);
      }
    });
    return () => unsub();
  }, [router]);

  async function loadPosts() {
    setLoadingList(true);
    setError(null);
    try {
      const ref = collection(db, "news");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list: NewsDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          title: data.title || "",
          summary: data.summary || "",
          content: data.content || "",
          imageUrl: data.imageUrl || "",
          tag: data.tag || "",
          createdAt: data.createdAt,
          reward: typeof data.reward === "number" ? data.reward : undefined,
          shareReward:
            typeof data.shareReward === "number" ? data.shareReward : undefined,
        });
      });
      setPosts(list);
    } catch (e) {
      console.error(e);
      setError("Failed to load news posts. Please refresh.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!booting && isAdmin) {
      loadPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, isAdmin]);

  const headerLabel = useMemo(() => {
    return editingId ? "Update post" : "Create new post";
  }, [editingId]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSummary("");
    setContent("");
    setImageUrl("");
    setTag("");
    setReward("10");
    setShareReward("5");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!title.trim()) return setError("Title is required.");
    if (!summary.trim()) return setError("Summary is required.");
    if (!content.trim()) return setError("Content is required.");

    const rewardNum = parseFloat(reward || "0");
    const shareNum = parseFloat(shareReward || "0");

    setSaving(true);
    try {
      if (!editingId) {
        // ✅ CREATE
        await addDoc(collection(db, "news"), {
          title: title.trim(),
          summary: summary.trim(),
          content: content, // Save HTML content
          imageUrl: imageUrl.trim() || "",
          tag: tag.trim() || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reward: isNaN(rewardNum) ? 0 : rewardNum,
          shareReward: isNaN(shareNum) ? 0 : shareNum,
        });
        setStatus("News post created ✅");
        resetForm();
        await loadPosts();
      } else {
        // ✅ UPDATE
        await updateDoc(doc(db, "news", editingId), {
          title: title.trim(),
          summary: summary.trim(),
          content: content, // Save HTML content
          imageUrl: imageUrl.trim() || "",
          tag: tag.trim() || "",
          updatedAt: serverTimestamp(),
          reward: isNaN(rewardNum) ? 0 : rewardNum,
          shareReward: isNaN(shareNum) ? 0 : shareNum,
        });
        setStatus("News post updated ✅");
        resetForm();
        await loadPosts();
      }
    } catch (e) {
      console.error(e);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: NewsDoc) {
    setStatus(null);
    setError(null);
    setEditingId(p.id);
    setTitle(p.title || "");
    setSummary(p.summary || "");
    setContent(p.content || "");
    setImageUrl(p.imageUrl || "");
    setTag(p.tag || "");
    setReward(String(p.reward ?? 10));
    setShareReward(String(p.shareReward ?? 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(p: NewsDoc) {
    setStatus(null);
    setError(null);
    const ok = window.confirm(
      `Delete this post?\n\n"${p.title}"\n\nThis cannot be undone.`
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "news", p.id));
      setStatus("Deleted ✅");
      await loadPosts();
    } catch (e) {
      console.error(e);
      setError("Failed to delete. Please try again.");
    }
  }

  if (booting) {
    return (
      <div className="kh-card">
        <p className="text-sm text-[var(--kh-text-secondary)]">Loading admin…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 5. Custom Styles for React Quill to match your theme */}
      <style jsx global>{`
        .quill {
          display: flex;
          flex-direction: column;
          background-color: var(--kh-bg);
          border-radius: 1rem;
          overflow: hidden;
          border: 1px solid var(--kh-border);
        }
        .ql-toolbar {
          background-color: var(--kh-bg-subtle);
          border: none !important;
          border-bottom: 1px solid var(--kh-border) !important;
        }
        .ql-container {
          border: none !important;
          font-family: inherit;
          min-height: 250px;
        }
        .ql-editor {
          color: var(--kh-text);
          min-height: 250px;
          font-size: 0.875rem; /* text-sm */
        }
        /* Toolbar icons color fix */
        .ql-snow .ql-stroke {
          stroke: var(--kh-text-secondary);
        }
        .ql-snow .ql-fill {
          fill: var(--kh-text-secondary);
        }
        .ql-snow .ql-picker {
          color: var(--kh-text-secondary);
        }
      `}</style>

      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-blue-soft)]/60 px-3 py-1 text-[11px] font-semibold text-[var(--kh-blue)]">
          🛠️ Admin · News
        </div>
        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          News Admin
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Create blog-style posts. Use the editor to format text and paste images
          (URLs or direct copy-paste).
        </p>
      </header>

      {status && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Create / Edit form */}
      <section className="kh-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--kh-text)]">
            {headerLabel}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
            >
              Cancel edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Title
              </label>
              <input
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tagumpay at Talino..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Tag (pill label)
              </label>
              <input
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Event, Advisory, Saudi Update..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Summary (short preview)
            </label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short intro that appears in the card list..."
            />
          </div>

          {/* 6. Replaced textarea with ReactQuill */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
              Content (full article)
            </label>
            <div className="relative">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                placeholder="Write your article here... You can paste images directly or use the image button."
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr,0.8fr]">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Cover image URL (optional)
              </label>
              <input
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="e.g. /news/tagumpay 1.jpg"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Reward (KP)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Share reward (KP)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-3 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                value={shareReward}
                onChange={(e) => setShareReward(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-5 py-2.5 text-xs font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update post" : "Publish post"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/news")}
              className="inline-flex items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-5 py-2.5 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg)]"
            >
              View public News →
            </button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="kh-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--kh-text)]">
              Existing posts
            </h2>
            <p className="text-[11px] text-[var(--kh-text-muted)]">
              Click Edit to update, or Delete to remove.
            </p>
          </div>
          <span className="rounded-full bg-[var(--kh-bg-subtle)] px-3 py-1 text-[10px] text-[var(--kh-text-muted)]">
            {posts.length} posts
          </span>
        </div>

        {loadingList && (
          <p className="mt-3 text-sm text-[var(--kh-text-secondary)]">
            Loading posts…
          </p>
        )}

        {!loadingList && posts.length === 0 && (
          <p className="mt-3 text-sm text-[var(--kh-text-secondary)]">
            No posts yet. Create your first one above.
          </p>
        )}

        {!loadingList && posts.length > 0 && (
          <div className="mt-4 space-y-2">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.tag && (
                      <span className="rounded-full bg-[var(--kh-bg)]/60 px-2 py-0.5 text-[10px] font-semibold text-[var(--kh-text-secondary)]">
                        {p.tag}
                      </span>
                    )}
                    {typeof p.reward === "number" && (
                      <span className="rounded-full bg-[var(--kh-yellow)] px-2 py-0.5 text-[10px] font-black text-slate-900">
                        +{p.reward} KP
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--kh-text-muted)]">
                      {formatDate(p.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm font-semibold text-[var(--kh-text)]">
                    {p.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--kh-text-secondary)]">
                    {p.summary}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={`/news/${p.id}`}
                      className="text-[11px] font-semibold text-[var(--kh-blue)] hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open public →
                    </a>
                    {p.imageUrl ? (
                      <span className="text-[10px] text-[var(--kh-text-muted)]">
                        🖼️ has cover
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--kh-text-muted)]">
                        🖼️ no cover
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg)] px-4 py-2 text-xs font-semibold text-[var(--kh-text-secondary)] hover:bg-[var(--kh-bg-card)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}