export type Power = "freeze" | "wind" | "shield";
export type Difficulty = "easy" | "steady" | "fast";
export type TypingWord = { id: number; text: string; x: number; y: number; speed: number };
export type TypingState = {
  status: "idle" | "running" | "paused" | "over";
  difficulty: Difficulty;
  words: TypingWord[];
  score: number;
  lives: number;
  caught: number;
  swept: number;
  correctCharacters: number;
  attempts: number;
  elapsed: number;
  spawnElapsed: number;
  nextId: number;
  freezeLeft: number;
  shieldLeft: number;
  charges: Record<Power, number>;
};
export const LIFE_LIMIT = 5;
export const WORD_POINTS = 10;
export const POWER_SECONDS = 5;
export const REFILL_WORDS = 10;
const WORDS = "hello home work kind help hope calm book rain sun team smile water happy family friend morning travel coffee market school garden window people yellow future listen learn dream thank light world house phone music lunch office clean fresh quick green street ticket nature ocean bright simple welcome little brother sister together journey message weekend courage practice community tomorrow beautiful keyboard sandwich sunshine language celebrate discover remember confident opportunity".split(" ");
const SPEED = { easy: 0.048, steady: 0.069, fast: 0.095 };
const INTERVAL = { easy: 2.9, steady: 2.25, fast: 1.75 };

export function initialTypingGame(difficulty: Difficulty = "steady"): TypingState {
  return { status: "idle", difficulty, words: [], score: 0, lives: LIFE_LIMIT, caught: 0, swept: 0, correctCharacters: 0, attempts: 0, elapsed: 0, spawnElapsed: 0, nextId: 1, freezeLeft: 0, shieldLeft: 0, charges: { freeze: 1, wind: 1, shield: 1 } };
}
function spawn(state: TypingState, random: () => number): TypingState {
  const maxLength = state.difficulty === "easy" ? 6 : state.difficulty === "steady" ? 9 : 12;
  const pool = WORDS.filter(word => word.length <= maxLength && !state.words.some(active => active.text === word));
  if (!pool.length) return state;
  const text = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  // Three lanes fit a phone, and recently spawned words keep their own space.
  const lanes = [0, 0.5, 1].filter(x => !state.words.some(word => word.x === x && word.y < 0.18));
  if (!lanes.length) return state;
  const x = lanes[Math.min(lanes.length - 1, Math.floor(random() * lanes.length))];
  const speed = SPEED[state.difficulty] + Math.min(state.caught * 0.0007, 0.04);
  return { ...state, nextId: state.nextId + 1, words: [...state.words, { id: state.nextId, text, x, y: 0, speed }] };
}
export function startTypingGame(difficulty: Difficulty, random = Math.random): TypingState {
  return spawn({ ...initialTypingGame(difficulty), status: "running" }, random);
}
export function pauseTypingGame(state: TypingState): TypingState {
  return state.status === "running" ? { ...state, status: "paused" } : state;
}
export function resumeTypingGame(state: TypingState): TypingState {
  return state.status === "paused" ? { ...state, status: "running" } : state;
}
export function advanceTypingGame(state: TypingState, seconds: number, random = Math.random): TypingState {
  if (state.status !== "running" || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.1);
  const frozen = Math.min(state.freezeLeft, dt);
  const movement = dt - frozen;
  let lives = state.lives;
  const words = state.words.flatMap(word => {
    const y = word.y + word.speed * movement;
    if (y < 1) return [{ ...word, y }];
    const crossingTime = frozen + (1 - word.y) / word.speed;
    if (state.shieldLeft <= 0 || crossingTime > state.shieldLeft + 1e-9) lives--;
    return [];
  });
  let next: TypingState = { ...state, words, lives: Math.max(0, lives), elapsed: state.elapsed + dt, spawnElapsed: state.spawnElapsed + movement, freezeLeft: Math.max(0, state.freezeLeft - dt), shieldLeft: Math.max(0, state.shieldLeft - dt) };
  if (next.lives === 0) return { ...next, status: "over" };
  const interval = Math.max(1.05, INTERVAL[state.difficulty] - state.caught * 0.015);
  if (movement > 0 && next.spawnElapsed >= interval) next = spawn({ ...next, spawnElapsed: next.spawnElapsed - interval }, random);
  return next;
}
export function submitTypingWord(state: TypingState, answer: string): TypingState {
  if (state.status !== "running" || !answer.trim()) return state;
  const word = state.words.filter(word => word.text === answer.trim().toLowerCase()).sort((a, b) => b.y - a.y)[0];
  if (!word) return { ...state, attempts: state.attempts + 1 };
  const caught = state.caught + 1;
  const charges = caught % REFILL_WORDS === 0 ? { freeze: Math.min(2, state.charges.freeze + 1), wind: Math.min(2, state.charges.wind + 1), shield: Math.min(2, state.charges.shield + 1) } : state.charges;
  return { ...state, words: state.words.filter(item => item.id !== word.id), score: state.score + WORD_POINTS, caught, correctCharacters: state.correctCharacters + word.text.length, attempts: state.attempts + 1, charges };
}
export function activateTypingPower(state: TypingState, power: Power): TypingState {
  if (state.status !== "running" || state.charges[power] <= 0) return state;
  if ((power === "freeze" && state.freezeLeft > 0) || (power === "shield" && state.shieldLeft > 0) || (power === "wind" && !state.words.length)) return state;
  const next = { ...state, charges: { ...state.charges, [power]: state.charges[power] - 1 } };
  if (power === "freeze") return { ...next, freezeLeft: POWER_SECONDS };
  if (power === "shield") return { ...next, shieldLeft: POWER_SECONDS };
  return { ...next, words: [], swept: state.swept + state.words.length, score: state.score + state.words.length * WORD_POINTS };
}
export function typingStats(state: TypingState) {
  return { wpm: state.elapsed >= 1 ? Math.round((state.correctCharacters / 5) / (state.elapsed / 60)) : 0, accuracy: state.attempts ? Math.round(state.caught / state.attempts * 100) : 100 };
}
