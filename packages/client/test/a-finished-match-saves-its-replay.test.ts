import { createRandomBot } from '@factor/bot';
import { BOT_TUNING, loadReplay, matchSetup, saveReplay, STARTER_DECKS, type Replay } from '@factor/content';
import { createMatch, hashState, step, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { advance, createLoop, queuePlay, runTo, TICK_MS } from '../src/match-loop.ts';
import { loopReplay } from '../src/match-replay.ts';

const SEED = 6;

/** Plays a replay from its seed, feeding each command at its tick, to the end of the match. */
function playBack(replay: Replay): SimState {
  let state = createMatch(matchSetup(replay.seed, replay.decks));
  while (state.result === null) {
    const now = state.tick;
    state = step(state, replay.commands.filter((command) => command.tick === now));
  }
  return state;
}

test("a live match's replay, saved and loaded back, ends the same way on the same tick", () => {
  const start = createMatch(matchSetup(SEED, STARTER_DECKS));
  const loop = createLoop(start, [createRandomBot(1, SEED, start, BOT_TUNING)]);
  for (let i = 0; i < 40; i++) {
    runTo(loop, loop.current.tick + 60);
    queuePlay(loop, 0, i % 4, 3500 + (i % 2) * 11000, 12500);
    advance(loop, TICK_MS);
  }
  runTo(loop, Number.MAX_SAFE_INTEGER);
  expect(loop.current.result).not.toBeNull();
  expect(loop.commands.filter((command) => command.side === 0)).toHaveLength(40);

  const replay = loadReplay(saveReplay(loopReplay(SEED, STARTER_DECKS, loop)));
  expect(replay.seed).toBe(SEED);
  expect(replay.decks).toEqual(STARTER_DECKS);
  expect(replay.commands).toEqual(loop.commands);
  const final = playBack(replay);
  expect(final.tick).toBe(loop.current.tick);
  expect(final.result).toEqual(loop.current.result);
  expect(hashState(final)).toBe(hashState(loop.current));
});

test('the replay is a copy: the loop and the saved replay never share commands or decks', () => {
  const start = createMatch(matchSetup(SEED));
  const loop = createLoop(start);
  queuePlay(loop, 0, 0, 9000, 4500);
  advance(loop, TICK_MS);
  const replay = loopReplay(SEED, STARTER_DECKS, loop);
  const first = replay.commands[0];
  if (first === undefined) {
    throw new Error('no command recorded');
  }
  first.x = 1;
  replay.decks[0].pop();
  expect(loop.commands[0]?.x).toBe(9000);
  expect(STARTER_DECKS[0]).toHaveLength(8);
});
