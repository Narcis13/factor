import { expect, test } from 'vitest';
import { createMatch, hashState, step, type Command } from '../src/index.ts';

// Commands spread over the match, including one on the last tick so it reaches the tick-1000 state.
const SCRIPT: Command[] = [
  { tick: 0, side: 0, handSlot: 0, x: 9000, y: 4000 },
  { tick: 120, side: 1, handSlot: 2, x: 4500, y: 26000 },
  { tick: 120, side: 0, handSlot: 1, x: 13500, y: 6000 },
  { tick: 999, side: 1, handSlot: 3, x: 9000, y: 30000 },
];

/** Runs to `ticks` and returns the hash after every tick. */
function run(seed: number, script: readonly Command[], ticks = 1000): string[] {
  let state = createMatch({ seed });
  const hashes: string[] = [];
  while (state.tick < ticks) {
    const tick = state.tick;
    state = step(state, script.filter((command) => command.tick === tick));
    hashes.push(hashState(state));
  }
  return hashes;
}

test('the same seed and commands give the same hash at every tick up to 1000', () => {
  const first = run(1234, SCRIPT);
  const second = run(1234, SCRIPT);
  expect(first).toHaveLength(1000);
  expect(second).toEqual(first);
});

test('a different seed gives a different hash at tick 1000', () => {
  expect(run(1235, SCRIPT).at(-1)).not.toBe(run(1234, SCRIPT).at(-1));
});

test('a different command gives a different hash at tick 1000', () => {
  const moved = SCRIPT.map((command) => (command.tick === 999 ? { ...command, x: 9001 } : command));
  expect(run(1234, moved).at(-1)).not.toBe(run(1234, SCRIPT).at(-1));
});
