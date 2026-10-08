import type { Metadata } from "next";
import KpLeaderboard from "./KpLeaderboard";
import "./leaderboard.css";
export const metadata: Metadata = { title: "KP Leaderboard | Kabayan Hub", description: "Meet the top Kabayans, ranked by their current Kabayan Points balance." };
export default function LeaderboardPage() { return <KpLeaderboard />; }
