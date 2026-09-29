import { expect, test } from 'vitest';
import { hashState, step, type Command } from '../src/index.ts';
import { newMatch } from './fixtures.ts';

test('the tick advances by exactly one per step', () => {
  const state = newMatch(5);
  expect(state.tick).toBe(0);
  expect(step(state, []).tick).toBe(1);
});

test('a command stamped for another tick is rejected as wrong-tick', () => {
  const late: Command = { tick: 7, side: 0, handSlot: 0, x: 5000, y: 4000 };
  const next = step(newMatch(5), [late]);
  expect(next.rejected).toEqual([{ command: late, reason: 'wrong-tick' }]);
});

test.each([-1, 4, 3 / 2, Number.NaN])('hand slot %s is rejected as bad-slot', (handSlot) => {
  const play: Command = { tick: 0, side: 1, handSlot, x: 5000, y: 16_000 };
  const next = step(newMatch(5), [play]);
  expect(next.rejected).toEqual([{ command: play, reason: 'bad-slot' }]);
});

test.each([
  { x: -1, y: 4000 },
  { x: 10_000, y: 4000 },
  { x: 5000, y: -1 },
  { x: 5000, y: 20_000 },
])('a point outside the arena ($x, $y) is rejected as out-of-bounds', ({ x, y }) => {
  const play: Command = { tick: 0, side: 0, handSlot: 0, x, y };
  expect(step(newMatch(5), [play]).rejected).toEqual([{ command: play, reason: 'out-of-bounds' }]);
});

test('the corners of the arena are in bounds', () => {
  const corners: Command[] = [
    { tick: 0, side: 0, handSlot: 0, x: 0, y: 0 },
    { tick: 0, side: 1, handSlot: 0, x: 9999, y: 19_999 },
  ];
  expect(step(newMatch(5), corners).rejected.map((r) => r.reason)).not.toContain('out-of-bounds');
});

test('a rejected command changes nothing but the record', () => {
  const start = newMatch(5);
  const bad: Command[] = [
    { tick: 0, side: 0, handSlot: 9, x: 5000, y: 4000 },
    { tick: 0, side: 1, handSlot: 0, x: 5000, y: 99_999 },
  ];
  expect(step(start, bad).players).toEqual(step(start, []).players);
});

test('rejections are recorded only in the state right after the step', () => {
  const play: Command = { tick: 0, side: 0, handSlot: -1, x: 5000, y: 4000 };
  const after = step(newMatch(5), [play]);
  expect(after.rejected).toHaveLength(1);
  expect(step(after, []).rejected).toEqual([]);
});

test('commands resolve side 0 first, whatever order they arrive in', () => {
  const blue: Command = { tick: 0, side: 0, handSlot: 7, x: 5000, y: 4000 };
  const red: Command = { tick: 0, side: 1, handSlot: 7, x: 5000, y: 16_000 };
  const redFirst = step(newMatch(5), [red, blue]);
  const blueFirst = step(newMatch(5), [blue, red]);
  expect(redFirst.rejected.map((entry) => entry.command.side)).toEqual([0, 1]);
  expect(hashState(redFirst)).toBe(hashState(blueFirst));
});
