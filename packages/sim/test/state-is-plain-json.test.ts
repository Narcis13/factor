import { expect, test } from 'vitest';
import { hashState, step, type Command, type SimState } from '../src/index.ts';
import { newMatch } from './fixtures.ts';

const PLAY: Command = { tick: 3, side: 1, handSlot: 0, x: 9000, y: 28000 };

function advance(state: SimState, ticks: number): SimState {
  let current = state;
  for (let i = 0; i < ticks; i++) {
    const tick = current.tick;
    current = step(current, PLAY.tick === tick ? [PLAY] : []);
  }
  return current;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

test('state survives a JSON round trip unchanged', () => {
  const state = advance(newMatch(99), 4);
  const copy = JSON.parse(JSON.stringify(state)) as SimState;
  expect(copy).toEqual(state);
  expect(hashState(copy)).toBe(hashState(state));
});

test('a match resumed from JSON continues exactly like the original', () => {
  const start = advance(newMatch(99), 2);
  const resumed = JSON.parse(JSON.stringify(start)) as SimState;
  expect(hashState(advance(resumed, 50))).toBe(hashState(advance(start, 50)));
});

test('step never mutates the state or commands it is given', () => {
  const state = deepFreeze(advance(newMatch(99), 3));
  const before = hashState(state);
  const next = step(state, deepFreeze([PLAY]));
  expect(hashState(state)).toBe(before);
  expect(next.rng).not.toBe(state.rng);
  expect(next.rejected[0]?.command).not.toBe(PLAY);
});
