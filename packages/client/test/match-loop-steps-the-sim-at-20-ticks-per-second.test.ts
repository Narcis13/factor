import { matchSetup } from '@factor/content';
import { createMatch, hashState, step, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { advance, alpha, createLoop, MAX_TICKS_PER_FRAME, queuePlay, stepTo, TICK_MS } from '../src/match-loop.ts';

const START = createMatch(matchSetup(7));

test('a tick is 50 ms of real time, whatever the frame rate', () => {
  const at60 = createLoop(START);
  const at144 = createLoop(START);
  for (let frame = 0; frame < 60; frame++) {
    advance(at60, 1000 / 60);
  }
  for (let frame = 0; frame < 144; frame++) {
    advance(at144, 1000 / 144);
  }
  // One second in, give or take the float error of summing frame times.
  expect(at60.current.tick).toBeGreaterThanOrEqual(19);
  expect(at60.current.tick).toBeLessThanOrEqual(20);
  expect(at144.current.tick).toBeGreaterThanOrEqual(19);
  expect(at144.current.tick).toBeLessThanOrEqual(20);
});

test('a frame shorter than a tick steps nothing and moves alpha toward the next tick', () => {
  const loop = createLoop(START);
  expect(advance(loop, 20)).toBe(0);
  expect(loop.current).toBe(START);
  expect(alpha(loop)).toBeCloseTo(0.4);
  expect(advance(loop, 40)).toBe(1);
  expect(loop.previous).toBe(START);
  expect(loop.current.tick).toBe(1);
  expect(alpha(loop)).toBeCloseTo(0.2);
});

test('after a stall the loop steps at most a few ticks and drops the rest of the time', () => {
  const loop = createLoop(START);
  expect(advance(loop, 10_000)).toBe(MAX_TICKS_PER_FRAME);
  expect(loop.current.tick).toBe(MAX_TICKS_PER_FRAME);
  expect(loop.pendingMs).toBe(0);
  expect(advance(loop, -5)).toBe(0);
});

test('the loop plays the same match as stepping the sim directly', () => {
  const loop = createLoop(START);
  let direct: SimState = START;
  for (let tick = 0; tick < 200; tick++) {
    advance(loop, TICK_MS);
    direct = step(direct, []);
  }
  expect(hashState(loop.current)).toBe(hashState(direct));
});

test('a queued play is stamped with the tick it is stepped on, and recorded', () => {
  const loop = createLoop(START);
  advance(loop, 3 * TICK_MS);
  queuePlay(loop, 0, 2, 4500, 6500);
  expect(loop.commands).toEqual([]);
  advance(loop, TICK_MS);
  expect(loop.commands).toEqual([{ tick: 3, side: 0, handSlot: 2, x: 4500, y: 6500 }]);
  expect(loop.queued).toEqual([]);
  expect(loop.current.rejected).toEqual([]);
  const cost = START.cards[START.players[0].hand[2] ?? ''];
  expect(cost).toBeDefined();
  // The play spent energy and cycled the card, exactly as the same command does in the sim.
  const direct = step(stepTo(START, 3), loop.commands);
  expect(hashState(loop.current)).toBe(hashState(direct));
  expect(loop.current.players[0].hand[2]).toBe(START.players[0].queue[0]);
});

test('the loop stops at the end of the match and drops later plays', () => {
  const nearEnd = stepTo(START, START.rules.regulationTicks + START.rules.overtimeTicks - 2);
  const loop = createLoop(nearEnd);
  expect(advance(loop, 4 * TICK_MS)).toBe(2);
  expect(loop.current.result).toEqual({ winner: null });
  expect(alpha(loop)).toBe(1);
  expect(advance(loop, TICK_MS)).toBe(0);
  queuePlay(loop, 0, 0, 1000, 1000);
  expect(loop.queued).toEqual([]);
});

test('stepTo stops at the tick asked for, or at the end of the match', () => {
  expect(stepTo(START, 90).tick).toBe(90);
  expect(stepTo(START, 0)).toBe(START);
  const end = START.rules.regulationTicks + START.rules.overtimeTicks;
  expect(stepTo(START, end + 500).tick).toBe(end);
});
