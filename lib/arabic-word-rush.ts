export type WordPair = { ar: string; en: string };
export type FallingWord = WordPair & { id: number; x: number; y: number; speed: number };
export type GameState = {
  status: "idle" | "running" | "paused" | "over";
  words: FallingWord[];
  score: number;
  misses: number;
  spawnElapsed: number;
  nextId: number;
  lastCorrect: WordPair | null;
};

export const MISS_LIMIT = 10;
export const CLAIM_SCORE = 30;
export const FALLBACK_WORDS: WordPair[] = [
  { ar: "مرحبا", en: "hello" }, { ar: "شكرا", en: "thank you" },
  { ar: "ماء", en: "water" }, { ar: "خبز", en: "bread" },
  { ar: "رز", en: "rice" }, { ar: "عمل", en: "work" },
  { ar: "بيت", en: "house" }, { ar: "سوق", en: "market" },
  { ar: "صديق", en: "friend" }, { ar: "صباح", en: "morning" },
  { ar: "مساء", en: "evening" },
];

export function normalizeEnglish(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseWordPool(value: unknown): WordPair[] {
  if (!Array.isArray(value)) return FALLBACK_WORDS;
  const valid = value.filter((word): word is WordPair =>
    word !== null && typeof word === "object" &&
    typeof word.ar === "string" && typeof word.en === "string"
  ).map(({ ar, en }) => ({ ar: ar.trim(), en: en.trim() }))
    .filter(({ ar, en }) => ar.length > 0 && en.length > 0);
  return valid.length ? valid : FALLBACK_WORDS;
}

export function initialGame(): GameState {
  return { status: "idle", words: [], score: 0, misses: 0, spawnElapsed: 0, nextId: 1, lastCorrect: null };
}

function spawn(state: GameState, pool: WordPair[], random: () => number): GameState {
  const pair = pool[Math.floor(random() * pool.length)] ?? FALLBACK_WORDS[0];
  return {
    ...state, nextId: state.nextId + 1,
    words: [...state.words, { ...pair, id: state.nextId, x: random(), y: 0, speed: 42 + random() * 20 + Math.min(state.score / 5, 25) }],
  };
}

export function startGame(pool: WordPair[], random = Math.random): GameState {
  return spawn({ ...initialGame(), status: "running" }, pool, random);
}

export function pauseGame(state: GameState): GameState {
  return state.status === "running" ? { ...state, status: "paused" } : state;
}

export function resumeGame(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "running" } : state;
}

// Pure updates: no React setters inside an updater and no stale animation closures.
export function advanceGame(state: GameState, seconds: number, height: number, pool: WordPair[], random = Math.random): GameState {
  if (state.status !== "running" || seconds <= 0 || height <= 0) return state;
  const dt = Math.min(seconds, 0.1);
  const bottom = Math.max(0, height - 80);
  const moved = state.words.map(word => ({ ...word, y: word.y + word.speed * dt }));
  const remaining = moved.filter(word => word.y < bottom);
  const misses = Math.min(MISS_LIMIT, state.misses + moved.length - remaining.length);
  let next: GameState = { ...state, words: remaining, misses, spawnElapsed: state.spawnElapsed + dt };
  if (misses >= MISS_LIMIT) return { ...next, status: "over" };
  const interval = Math.max(1.1, 1.9 - state.score / 200);
  if (next.spawnElapsed >= interval) {
    next = spawn({ ...next, spawnElapsed: next.spawnElapsed - interval }, pool, random);
  }
  return next;
}

export function catchWord(state: GameState, typed: string): GameState {
  if (state.status !== "running") return state;
  const answer = normalizeEnglish(typed);
  if (!answer) return state;
  // Catch the lowest matching word first, even when duplicates fall at different speeds.
  const match = state.words.filter(word => normalizeEnglish(word.en) === answer)
    .sort((a, b) => b.y - a.y)[0];
  if (!match) return state;
  return { ...state, words: state.words.filter(word => word.id !== match.id), score: state.score + 5, lastCorrect: { ar: match.ar, en: match.en } };
}

export function getISOWeekKey(date = new Date()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(((+day - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
