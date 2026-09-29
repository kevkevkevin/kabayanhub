import { Suspense } from "react";
import CommunityFeed from "../components/social/CommunityFeed";

export const metadata = { title: "Community | Kabayan Hub", description: "A little closer to home. Share a thought and connect with fellow Kabayans." };

export default function CommunityPage() {
  return <Suspense fallback={<p role="status">Loading the community…</p>}><CommunityFeed /></Suspense>;
}
