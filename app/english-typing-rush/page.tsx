import type { Metadata } from "next";
import EnglishTypingGame from "../components/EnglishTypingGame";
import "./typing.css";

export const metadata: Metadata = { title: "English Typing Rush | Kabayan Hub", description: "Practice typing English with falling words, live WPM, and Freeze, Wind, and Shield power-ups." };
export default function EnglishTypingRushPage() {
  return <EnglishTypingGame />;
}
