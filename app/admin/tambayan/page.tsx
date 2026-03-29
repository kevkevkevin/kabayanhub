// app/admin/tambayan/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

type TambayanConfig = {
  marqueeText: string;
  adImage1: string;
  adImage2: string;
  earningPointsEnabled: boolean;
};

export default function AdminTambayanPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [marqueeText, setMarqueeText] = useState("");
  const [adImage1, setAdImage1] = useState("");
  const [adImage2, setAdImage2] = useState("");
  const [adImage1Preview, setAdImage1Preview] = useState("");
  const [adImage2Preview, setAdImage2Preview] = useState("");
  const [earningPointsEnabled, setEarningPointsEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setIsAdmin(false);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.role === "admin") {
            setIsAdmin(true);
          } else {
            router.push("/");
          }
        } else {
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

  // Load config
  useEffect(() => {
    if (!isAdmin) return;

    const loadConfig = async () => {
      try {
        const ref = doc(db, "tambayanConfig", "display");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as TambayanConfig;
          setMarqueeText(data.marqueeText || "");
          setAdImage1(data.adImage1 || "");
          setAdImage2(data.adImage2 || "");
          setAdImage1Preview(data.adImage1 || "");
          setAdImage2Preview(data.adImage2 || "");
          setEarningPointsEnabled(data.earningPointsEnabled || false);
        }
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    };

    loadConfig();
  }, [isAdmin]);

  const handleImageUpload = async (
    file: File,
    imageNum: number
  ): Promise<string> => {
    // For now, we'll store the base64 data URL directly
    // In production, you might want to use Firebase Storage instead
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleAdImage1Change = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await handleImageUpload(file, 1);
      setAdImage1(dataUrl);
      setAdImage1Preview(dataUrl);
      setError(null);
    } catch (err) {
      console.error("Failed to process image:", err);
      setError("Failed to process image");
    }
  };

  const handleAdImage2Change = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await handleImageUpload(file, 2);
      setAdImage2(dataUrl);
      setAdImage2Preview(dataUrl);
      setError(null);
    } catch (err) {
      console.error("Failed to process image:", err);
      setError("Failed to process image");
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    if (!marqueeText.trim()) {
      setError("Marquee text cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const ref = doc(db, "tambayanConfig", "display");
      await setDoc(
        ref,
        {
          marqueeText: marqueeText.trim(),
          adImage1: adImage1 || "",
          adImage2: adImage2 || "",
          earningPointsEnabled: earningPointsEnabled,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setStatus("Tambayan config updated successfully! ✅");
    } catch (e) {
      console.error("Failed to save config:", e);
      setError("Failed to save config. Check permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAdImage = (imageNum: number) => {
    if (imageNum === 1) {
      setAdImage1("");
      setAdImage1Preview("");
    } else {
      setAdImage2("");
      setAdImage2Preview("");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-[var(--kh-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6 md:space-y-8 page-fade">
        <p className="text-sm text-red-600">
          You do not have admin access. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 page-fade">
      {/* Header */}
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--kh-yellow-soft)] px-3 py-1 text-[10px] text-[var(--kh-text)]">
          <span className="kp-coin kp-coin-delay-2">⚙️</span>
          <span className="font-semibold uppercase tracking-wide">
            Admin Panel
          </span>
          <span className="text-[10px] text-[var(--kh-text-muted)]">
            Tambayan Settings
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-[var(--kh-text)] md:text-3xl">
          Tambayan Configuration 🎨
        </h1>
        <p className="max-w-2xl text-sm text-[var(--kh-text-secondary)]">
          Manage the marquee text and advertisement images displayed on the
          Tambayan Live page.
        </p>
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

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Marquee section */}
        <div className="kh-card card-hover">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                📢 Marquee Text
              </h2>
              <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
                This text scrolls continuously on the Tambayan page. Keep it
                short and engaging!
              </p>
            </div>

            <div>
              <label className="text-[11px] font-medium text-[var(--kh-text-secondary)]">
                Announcement Text
              </label>
              <textarea
                value={marqueeText}
                onChange={(e) => setMarqueeText(e.target.value)}
                maxLength={200}
                rows={4}
                className="mt-2 w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-bg)] px-3 py-2 text-sm text-[var(--kh-text)] outline-none focus:border-[var(--kh-blue)]"
                placeholder="Enter the marquee announcement text..."
              />
              <p className="mt-1 text-[10px] text-[var(--kh-text-muted)]">
                {marqueeText.length}/200 characters
              </p>
            </div>

            {/* Marquee Preview */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
              <div className="text-[10px] font-semibold text-[var(--kh-text-secondary)] mb-2">
                Preview
              </div>
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(100%); }
                  100% { transform: translateX(-100%); }
                }
                .marquee-text {
                  animation: marquee 15s linear infinite;
                  white-space: nowrap;
                }
              `}</style>
              <div className="overflow-hidden rounded-lg bg-[var(--kh-bg)] h-10 flex items-center">
                <div className="marquee-text text-sm font-medium text-[var(--kh-text)]">
                  {marqueeText || "Your text here..."}
                  <span className="ml-8">•</span>
                  <span className="ml-8">{marqueeText || "Your text here..."}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advertisement section */}
        <div className="kh-card card-hover">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--kh-text)]">
                📸 Advertisement Images
              </h2>
              <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
                Upload 2 images to display as advertisements. Recommended size:
                400x300 or similar.
              </p>
            </div>

            {/* Earning Points Toggle */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--kh-text)]">
                    🎁 Enable Earning Points
                  </h3>
                  <p className="mt-1 text-[11px] text-[var(--kh-text-muted)]">
                    Randomly reward 50 KP to one active chatter every 10 minutes
                  </p>
                </div>
                <button
                  onClick={() => setEarningPointsEnabled(!earningPointsEnabled)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    earningPointsEnabled
                      ? "bg-emerald-500 text-white"
                      : "bg-[var(--kh-bg-subtle)] text-[var(--kh-text)]"
                  }`}
                >
                  {earningPointsEnabled ? "✓ Enabled" : "○ Disabled"}
                </button>
              </div>
            </div>

            {/* Ad 1 */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
              <div className="text-[11px] font-semibold text-[var(--kh-text)] mb-2">
                Advertisement 1
              </div>

              {adImage1Preview ? (
                <div className="relative rounded-lg overflow-hidden mb-2">
                  <img
                    src={adImage1Preview}
                    alt="Ad 1 Preview"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    onClick={() => handleClearAdImage(1)}
                    className="absolute top-2 right-2 rounded-full bg-red-500 text-white px-2 py-1 text-xs hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-[var(--kh-border)] bg-[var(--kh-bg)]/50 h-32 flex items-center justify-center mb-2">
                  <p className="text-xs text-[var(--kh-text-muted)]">
                    No image selected
                  </p>
                </div>
              )}

              <label className="text-[10px] font-medium text-[var(--kh-text-secondary)] block mb-2">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAdImage1Change}
                className="w-full text-[10px] text-[var(--kh-text-muted)]"
              />
            </div>

            {/* Ad 2 */}
            <div className="rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-bg-card)] p-3">
              <div className="text-[11px] font-semibold text-[var(--kh-text)] mb-2">
                Advertisement 2
              </div>

              {adImage2Preview ? (
                <div className="relative rounded-lg overflow-hidden mb-2">
                  <img
                    src={adImage2Preview}
                    alt="Ad 2 Preview"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    onClick={() => handleClearAdImage(2)}
                    className="absolute top-2 right-2 rounded-full bg-red-500 text-white px-2 py-1 text-xs hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-[var(--kh-border)] bg-[var(--kh-bg)]/50 h-32 flex items-center justify-center mb-2">
                  <p className="text-xs text-[var(--kh-text-muted)]">
                    No image selected
                  </p>
                </div>
              )}

              <label className="text-[10px] font-medium text-[var(--kh-text-secondary)] block mb-2">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAdImage2Change}
                className="w-full text-[10px] text-[var(--kh-text-muted)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-full bg-[var(--kh-blue)] px-6 py-2 text-sm font-semibold text-white shadow-[var(--kh-card-shadow)] hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border border-[var(--kh-border)] bg-[var(--kh-bg-subtle)] px-6 py-2 text-sm font-semibold text-[var(--kh-text)] hover:bg-[var(--kh-bg-card)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
