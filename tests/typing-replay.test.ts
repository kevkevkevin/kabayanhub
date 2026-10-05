import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceTypingGame, activateTypingPower, scoreSpeedMultiplier, seededTypingRandom, startTypingGame, submitTypingWord, typingReward, TYPING_TICK_SECONDS } from "../lib/english-typing-rush";
import { replayTypingRound, type TypingAction } from "../lib/typing-replay";

test("score conversion and difficulty increase at 500, 700, 800 and beyond", () => {
  for (const [score, reward] of [[0,0],[100,10],[500,50],[700,70],[800,80],[995,99]]) assert.equal(typingReward(score),reward);
  assert.equal(scoreSpeedMultiplier(490),1); assert.equal(scoreSpeedMultiplier(500),1.25);
  assert.equal(scoreSpeedMultiplier(700),1.5); assert.equal(scoreSpeedMultiplier(800),1.7);
  assert.ok(scoreSpeedMultiplier(900)>scoreSpeedMultiplier(800)); assert.equal(scoreSpeedMultiplier(10000),3);
  const game = startTypingGame("steady",()=>0);
  const base=advanceTypingGame(game,0.1,()=>0);
  const faster=advanceTypingGame({...game,score:800},0.1,()=>0);
  assert.ok(faster.words[0].y>base.words[0].y); // Existing words speed up too.
});
test("server replays a full round including typing, freeze, shield and wind", () => {
  const random=seededTypingRandom(42);
  let game=startTypingGame("steady",random); let tick=0;
  const events: TypingAction[]=[];
  while(game.status==="running" && tick<5000){
    if(tick===0 || tick===1){
      const power=tick===0?"freeze":"shield";
      events.push({tick,kind:"power",power}); game=activateTypingPower(game,power);
    }
    if(game.caught<10 && game.words.length){
      const answer=game.words[0].text; events.push({tick,kind:"word",answer}); game=submitTypingWord(game,answer);
    } else if(game.caught>=10 && game.words.length>=3 && game.charges.wind>0){
      events.push({tick,kind:"power",power:"wind"}); game=activateTypingPower(game,"wind");
    }
    game=advanceTypingGame(game,TYPING_TICK_SECONDS,random);tick++;
  }
  assert.equal(game.status,"over"); assert.ok(game.score>=100); assert.ok(game.swept>0);
  assert.deepEqual(replayTypingRound(42,"steady",events,tick),game);
  assert.throws(()=>replayTypingRound(42,"steady",events,tick-1));
  assert.throws(()=>replayTypingRound(42,"steady",events,tick+1));
});
test("unfinished, reordered, excessive and impossible power-up recordings are rejected", () => {
  assert.throws(()=>replayTypingRound(1,"easy",[],1));
  assert.throws(()=>replayTypingRound(1,"easy",[],144001));
  assert.throws(()=>replayTypingRound(1,"easy",[{tick:-1,kind:"word",answer:"hello"}],100));
  assert.throws(()=>replayTypingRound(1,"easy",[{tick:1,kind:"power",power:"freeze"},{tick:0,kind:"word",answer:"hello"}],100));
  assert.throws(()=>replayTypingRound(1,"easy",[{tick:0,kind:"power",power:"wind"},{tick:1,kind:"power",power:"wind"}],100));
  assert.throws(()=>replayTypingRound(1,"easy",Array(12001).fill({}),100));
});
