import type { Metadata } from "next";
import KabayanCascade from "../components/arcade/KabayanCascade";
import "./cascade.css";

export const metadata: Metadata = { title: "Kabayan Cascade | Kabayan Hub", description: "A Kabayan-themed cascade arcade game with free Kabayan Coins, mascot scatters, and bonus spins. Play coins have no cash or reward value." };
export default function CascadePage() { return <KabayanCascade />; }
