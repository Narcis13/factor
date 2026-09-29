import { expect, test } from 'vitest';
import { hashState, step, type Command } from '../src/index.ts';
import { newMatch } from './fixtures.ts';

test('the tick advances by exactly one per step', () => {
  const state = newMatch(5);
  expect(state.tick).toBe(0);
  expect(step(state, []).tick).toBe(1);
});

test('a command stamped for another tick is rejected as wrong-tick', () => {
  const late: Command = { tick: 7, side: 0, handSlot: 0, x: 9000, y: 4000 };
  const next = step(newMatch(5), [late]);
  expect(next.rejected).toEqual([{ command: late, reason: 'wrong-tick' }]);
});

test('with empty hands, a command for this tick is rejected as empty-slot', () => {
  const play: Command = { tick: 0, side: 1, handSlot: 2, x: 9000, y: 28000 };
  const next = step(newMatch(5), [play]);
  expect(next.rejected).toEqual([{ command: play, reason: 'empty-slot' }]);
});

test('rejections are recorded only in the state right after the step', () => {
  const play: Command = { tick: 0, side: 0, handSlot: 0, x: 9000, y: 4000 };
  const after = step(newMatch(5), [play]);
  expect(after.rejected).toHaveLength(1);
  expect(step(after, []).rejected).toEqual([]);
});

test('commands resolve side 0 first, whatever order they arrive in', () => {
  const blue: Command = { tick: 0, side: 0, handSlot: 0, x: 9000, y: 4000 };
  const red: Command = { tick: 0, side: 1, handSlot: 0, x: 9000, y: 28000 };
  const redFirst = step(newMatch(5), [red, blue]);
  const blueFirst = step(newMatch(5), [blue, red]);
  expect(redFirst.rejected.map((entry) => entry.command.side)).toEqual([0, 1]);
  expect(hashState(redFirst)).toBe(hashState(blueFirst));
});
