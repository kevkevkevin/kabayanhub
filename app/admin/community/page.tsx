"use client";
import Moderation from "../../components/social/Moderation";
import { useAdmin } from "../components/AdminShell";

export default function AdminCommunityPage() {
  const user = useAdmin();
  return <div className="admin-page-stack"><header className="admin-page-heading"><p className="kh-eyebrow">COMMUNITY CARE</p><h1>Keep the hub welcoming.</h1><p>Review reported posts and take action when a conversation needs attention.</p></header><Moderation uid={user.uid} /><aside className="admin-note"><strong>A little care goes a long way.</strong><p>Read the reported post before deciding. Dismiss a report if no action is needed, or remove a post that violates community guidelines. Social interactions do not earn Kabayan Points.</p></aside></div>;
}
