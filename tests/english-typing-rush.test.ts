import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceTypingGame, initialTypingGame, pauseTypingGame, resumeTypingGame, startTypingGame, submitTypingWord, typingStats, activateTypingPower, type TypingState } from "../lib/english-typing-rush";
const random = () => 0;
const tick = (state: TypingState, count: number) => { for (let i = 0; i < count; i++) state = advanceTypingGame(state, 0.1, random); return state; };

test("English words move and spawn at each pace without duplicate words", () => {
  for (const pace of ["easy", "steady", "fast"] as const) {
    const game = tick(startTypingGame(pace, random), 40);
    assert.ok(game.words.length > 1);
    assert.ok(game.words[0].y > 0);
    assert.equal(new Set(game.words.map(word => word.text)).size, game.words.length);
  }
});
test("typing awards one catch; wrong and empty submissions cannot add points", () => {
  const start = startTypingGame("steady", random);
  assert.equal(submitTypingWord(start, " "), start);
  const incorrect = submitTypingWord(start, "wrong");
  assert.equal(incorrect.score, 0); assert.equal(incorrect.attempts, 1);
  const caught = submitTypingWord(incorrect, ` ${start.words[0].text.toUpperCase()} `);
  assert.equal(caught.score, 10); assert.equal(caught.caught, 1); assert.equal(caught.words.length, 0);
  assert.equal(typingStats(caught).accuracy, 50);
  assert.equal(submitTypingWord(caught, start.words[0].text).score, 10);
});
test("freeze lasts five play seconds, stops movement and spawning, but allows typing", () => {
  const frozen = activateTypingPower(startTypingGame("steady", random), "freeze");
  const after = tick(frozen, 40);
  assert.equal(after.words[0].y, 0); assert.equal(after.words.length, 1);
  assert.equal(after.spawnElapsed, 0); assert.ok(after.freezeLeft > 0.9);
  assert.equal(activateTypingPower(after, "freeze"), after);
  assert.equal(submitTypingWord(after, after.words[0].text).score, 10);
  assert.ok(tick(after, 20).words[0].y > 0);
});
test("wind converts every active word into points without typing credit or refills", () => {
  const start = tick(startTypingGame("steady", random), 60);
  const windy = activateTypingPower({ ...start, caught: 9 }, "wind");
  assert.equal(windy.score, start.words.length * 10); assert.equal(windy.words.length, 0);
  assert.equal(windy.caught, 9); assert.equal(windy.correctCharacters, 0); assert.equal(windy.attempts, 0);
  assert.equal(windy.charges.wind, 0); assert.equal(windy.charges.freeze, 1);
  assert.equal(activateTypingPower(windy, "wind"), windy); assert.equal(typingStats(windy).wpm, 0);
});
test("shield protects crossings before expiry and charges lives after expiry", () => {
  const start = startTypingGame("steady", random);
  const nearFloor = { ...start, words: [{ ...start.words[0], y: 0.995, speed: 0.1 }] };
  assert.equal(advanceTypingGame(activateTypingPower(nearFloor, "shield"), 0.1, random).lives, 5);
  assert.equal(advanceTypingGame({ ...nearFloor, shieldLeft: 0.04 }, 0.1, random).lives, 4);
  assert.equal(advanceTypingGame({ ...nearFloor, shieldLeft: 0.06 }, 0.1, random).lives, 5);
  assert.equal(tick(activateTypingPower(start, "shield"), 51).shieldLeft, 0);
});
test("pause freezes clock and effects; actions are blocked until resume", () => {
  const active = activateTypingPower(activateTypingPower(startTypingGame("steady", random), "freeze"), "shield");
  const paused = pauseTypingGame(active);
  assert.equal(tick(paused, 100), paused);
  assert.equal(activateTypingPower(paused, "wind"), paused);
  assert.equal(submitTypingWord(paused, paused.words[0].text), paused);
  const resumed = tick(resumeTypingGame(paused), 1);
  assert.ok(resumed.freezeLeft < 5); assert.ok(resumed.elapsed > 0);
});
test("ten typed words refill each power, capped at two, and reset restores defaults", () => {
  const start = startTypingGame("steady", random);
  const state = { ...start, caught: 9, charges: { freeze: 0, wind: 2, shield: 1 } };
  const next = submitTypingWord(state, state.words[0].text);
  assert.deepEqual(next.charges, { freeze: 1, wind: 2, shield: 2 });
  const reset = initialTypingGame("fast");
  assert.equal(reset.score, 0); assert.equal(reset.status, "idle"); assert.equal(reset.lives, 5);
  assert.deepEqual(reset.charges, { freeze: 1, wind: 1, shield: 1 });
});
test("misses end the round once; delayed frames are bounded and WPM excludes pause", () => {
  const start = startTypingGame("steady", random);
  const final = advanceTypingGame({ ...start, lives: 1, words: [{ ...start.words[0], y: 0.999 }] }, 0.1, random);
  assert.equal(final.status, "over"); assert.equal(final.lives, 0);
  assert.equal(tick(final, 100), final); assert.equal(activateTypingPower(final, "shield"), final);
  assert.equal(advanceTypingGame(start, 30, random).elapsed, 0.1);
  assert.equal(typingStats({ ...start, elapsed: 60, correctCharacters: 150 }).wpm, 30);
  assert.equal(advanceTypingGame(start, NaN), start);
});
