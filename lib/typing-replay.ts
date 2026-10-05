import { activateTypingPower, advanceTypingGame, seededTypingRandom, startTypingGame, submitTypingWord, TYPING_TICK_SECONDS, type Difficulty, type Power } from "./english-typing-rush";

export type TypingAction = { tick: number; kind: "word"; answer: string } | { tick: number; kind: "power"; power: Power };
export const MAX_ROUND_TICKS = 144000; // Two hours of active play.
export const MAX_ROUND_ACTIONS = 12000;
export function replayTypingRound(seed: number, difficulty: Difficulty, events: unknown, endTick: unknown) {
  if (!Number.isInteger(endTick) || (endTick as number) < 1 || (endTick as number) > MAX_ROUND_TICKS || !Array.isArray(events) || events.length > MAX_ROUND_ACTIONS) throw new Error("Invalid round recording");
  const random = seededTypingRandom(seed);
  let game = startTypingGame(difficulty, random);
  let tick = 0;
  for (const event of events) {
    if (!event || !Number.isInteger(event.tick) || event.tick < tick || event.tick > (endTick as number)) throw new Error("Invalid action timing");
    while (tick < event.tick) {
      if (game.status !== "running") throw new Error("Actions after round end");
      game = advanceTypingGame(game, TYPING_TICK_SECONDS, random); tick++;
    }
    if (game.status !== "running") throw new Error("Actions after round end");
    if (event.kind === "word" && typeof event.answer === "string" && event.answer.length <= 24) game = submitTypingWord(game, event.answer);
    else if (event.kind === "power" && ["freeze", "wind", "shield"].includes(event.power)) {
      const next = activateTypingPower(game, event.power);
      if (next === game) throw new Error("Unavailable power-up");
      game = next;
    } else throw new Error("Invalid game action");
  }
  while (tick < (endTick as number)) {
    if (game.status !== "running") throw new Error("Invalid round duration");
    game = advanceTypingGame(game, TYPING_TICK_SECONDS, random); tick++;
  }
  if (game.status !== "over") throw new Error("Finish the round before claiming");
  return game;
}
