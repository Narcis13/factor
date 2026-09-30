import { createRandomBot, type RandomBot } from '@factor/bot';
import { BOT_TUNING, matchSetup } from '@factor/content';
import { createMatch, hashState, step, type Command, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { advance, createLoop, queuePlay, runTo, TICK_MS, type MatchLoop } from '../src/match-loop.ts';

const SEED = 3;
const START = createMatch(matchSetup(SEED));

function botLoop(): MatchLoop {
  return createLoop(START, [createRandomBot(1, SEED, START, BOT_TUNING)]);
}

/** Replays `commands` from the start to `tick`, feeding each at its own tick. */
function replay(commands: readonly Command[], tick: number): SimState {
  let state = START;
  while (state.tick < tick) {
    const now = state.tick;
    state = step(state, commands.filter((command) => command.tick === now));
  }
  return state;
}

/** Advances the loop by `count` ticks, one frame per tick. */
function ticks(loop: MatchLoop, count: number): void {
  for (let i = 0; i < count; i++) {
    advance(loop, TICK_MS);
  }
}

test('the bot plays side 1 in real time, and its commands are recorded', () => {
  const loop = botLoop();
  for (let frame = 0; frame < 20 * 60; frame++) {
    advance(loop, 1000 / 60);
  }
  const tick = loop.current.tick;
  expect(tick).toBeGreaterThanOrEqual(399);
  const sides = loop.commands.map((command) => command.side);
  expect(sides.length).toBeGreaterThan(2);
  expect(sides.every((side) => side === 1)).toBe(true);
  expect(loop.current.units.some((unit) => unit.side === 1) || loop.current.blasts.length > 0).toBe(true);
  expect(hashState(replay(loop.commands, tick))).toBe(hashState(loop.current));
});

test('taps and the bot land in the same log, and it replays to the same state', () => {
  const loop = botLoop();
  ticks(loop, 60);
  queuePlay(loop, 0, 0, 9000, 4500);
  ticks(loop, 200);
  const tick = loop.current.tick;
  expect(loop.commands.filter((command) => command.side === 0)).toEqual([{ tick: 60, side: 0, handSlot: 0, x: 9000, y: 4500 }]);
  expect(loop.commands.some((command) => command.side === 1)).toBe(true);
  expect(hashState(replay(loop.commands, tick))).toBe(hashState(loop.current));
});

test('runTo plays the bot exactly as the live loop does without taps', () => {
  const live = botLoop();
  ticks(live, 300);
  const frozen = botLoop();
  runTo(frozen, 300);
  expect(frozen.current.tick).toBe(300);
  expect(frozen.commands).toEqual(live.commands);
  expect(hashState(frozen.current)).toBe(hashState(live.current));
  expect(frozen.blasts).toEqual(live.blasts);
});

test('runTo stops at the end of the match, and the bot has nothing left to say', () => {
  const loop = botLoop();
  runTo(loop, Number.MAX_SAFE_INTEGER);
  expect(loop.current.result).not.toBeNull();
  const before = loop.bots.map((bot: RandomBot) => ({ ...bot }));
  expect(advance(loop, 10 * TICK_MS)).toBe(0);
  expect(loop.bots).toEqual(before);
});
