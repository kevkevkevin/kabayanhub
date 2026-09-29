"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { socialError } from "../../../lib/social";

type Report = { id: string; postId: string; reason: string };
export default function Moderation({ uid }: { uid: string }) {
  const [admin, setAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; getDoc(doc(db, "users", uid)).then(snap => { if (active) setAdmin(snap.data()?.role === "admin"); }).catch(() => {}); return () => { active = false; }; }, [uid]);
  async function load() { setBusy(true); setError(""); try { const snap = await getDocs(query(collection(db, "socialReports"), where("status", "==", "open"), orderBy("createdAt", "asc"), limit(20))); setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report))); setLoaded(true); } catch (err) { setError(socialError(err)); } finally { setBusy(false); } }
  async function resolve(report: Report, remove: boolean) { setBusy(true); setError(""); try { if (remove) await deleteDoc(doc(db, "socialPosts", report.postId)); await updateDoc(doc(db, "socialReports", report.id), { status: remove ? "removed" : "reviewed", reviewedAt: serverTimestamp() }); setReports(items => items.filter(item => item.id !== report.id)); } catch (err) { setError(socialError(err)); } finally { setBusy(false); } }
  if (!admin) return null;
  return <section className="kh-card social-moderation"><h2>Community reports</h2><button disabled={busy} className="kh-text-button" onClick={load}>{loaded ? "Refresh reports" : "Review reports"}</button>{error && <p role="alert">{error}</p>}{reports.map(report => <div key={report.id}><Link href={`/community?post=${report.postId}`}>View reported post ↗</Link><p>{report.reason}</p><button disabled={busy} onClick={() => resolve(report, false)}>Dismiss</button><button disabled={busy} onClick={() => resolve(report, true)}>Remove post</button></div>)}{loaded && !reports.length && <p>No open reports.</p>}</section>;
}
