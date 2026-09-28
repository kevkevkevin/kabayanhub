const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Run the pure TypeScript engine with Node's built-in test runner (no new dependency).
const filename = path.resolve(__dirname, "../lib/arabic-word-rush.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const engineModule = new Module(filename, module);
engineModule._compile(compiled, filename);
const { startGame, advanceGame, pauseGame, resumeGame, initialGame, catchWord, parseWordPool, getISOWeekKey, MISS_LIMIT, FALLBACK_WORDS } = engineModule.exports;
const pool = [{ ar: "مرحبا", en: "hello" }, { ar: "شكرا", en: "thank you" }];
const random = () => 0;
const tick = (game, seconds = 0.1) => advanceGame(game, seconds, 360, pool, random);

test("starting creates a word and repeated frames keep moving and spawning", () => {
  let game = startGame(pool, random);
  assert.equal(game.words.length, 1);
  for (let i = 0; i < 20; i++) game = tick(game);
  assert.equal(game.status, "running");
  assert.ok(game.words[0].y > 50);
  assert.ok(game.words.length >= 2);
});
test("pause freezes the round; resume preserves score, positions and spawn timer", () => {
  const game = { ...tick(startGame(pool, random)), score: 15 };
  const paused = pauseGame(game);
  assert.strictEqual(tick(paused), paused);
  const resumed = resumeGame(paused);
  assert.deepEqual(resumed, game);
  assert.ok(tick(resumed).words[0].y > game.words[0].y);
});
test("reset is idle, clears everything and cannot keep spawning", () => {
  const reset = initialGame();
  assert.equal(reset.status, "idle");
  assert.deepEqual(reset.words, []);
  assert.equal(reset.score, 0);
  assert.equal(reset.misses, 0);
  assert.strictEqual(tick(reset), reset);
});
test("catch ignores case and repeated spaces and awards exactly once", () => {
  const game = startGame([pool[1]], random);
  const caught = catchWord(game, "  THANK    YOU  ");
  assert.equal(caught.score, 5);
  assert.equal(caught.words.length, 0);
  assert.deepEqual(caught.lastCorrect, pool[1]);
  assert.strictEqual(catchWord(caught, "thank you"), caught);
});
test("incorrect or empty answers do not change score or words", () => {
  const game = startGame(pool, random);
  assert.strictEqual(catchWord(game, "wrong"), game);
  assert.strictEqual(catchWord(game, "  "), game);
});
test("duplicate translations catch the lowest word first", () => {
  const game = startGame(pool, random);
  game.words.push({ ...game.words[0], id: 2, y: 150 });
  const caught = catchWord(game, "hello");
  assert.equal(caught.score, 5);
  assert.deepEqual(caught.words.map(word => word.id), [1]);
});
test("catching while paused or after game over cannot increase the score", () => {
  for (const status of ["paused", "over", "idle"]) {
    const game = { ...startGame(pool, random), status };
    assert.strictEqual(catchWord(game, "hello"), game);
  }
});
test("misses are counted once and game over clamps at ten", () => {
  const game = startGame(pool, random);
  game.misses = MISS_LIMIT - 1;
  game.words = [1, 2].map(id => ({ ...game.words[0], id, y: 279 }));
  const over = tick(game);
  assert.equal(over.misses, MISS_LIMIT);
  assert.equal(over.status, "over");
  assert.strictEqual(tick(over), over);
});
test("replaying after game over starts a clean round", () => {
  const fresh = startGame(pool, random);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.misses, 0);
  assert.equal(fresh.words[0].y, 0);
  assert.equal(fresh.status, "running");
});
test("a delayed animation frame cannot instantly drop every word", () => {
  const game = tick(startGame(pool, random), 60);
  assert.equal(game.misses, 0);
  assert.ok(game.words[0].y < 10);
});
test("malformed weekly configuration falls back safely", () => {
  for (const value of [null, {}, "invalid", [], [{ ar: "", en: "hello" }]]) {
    assert.deepEqual(parseWordPool(value), FALLBACK_WORDS);
  }
  assert.deepEqual(parseWordPool([null, { ar: 3, en: "hello" }, { ar: " مرحبا ", en: " hello " }]), [pool[0]]);
});
test("ISO week keys handle the new-year boundary", () => {
  assert.equal(getISOWeekKey(new Date(2021, 0, 1)), "2020-W53");
  assert.equal(getISOWeekKey(new Date(2026, 8, 28)), "2026-W40");
});
