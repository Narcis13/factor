import { expect, test } from 'vitest';
import { nextUint32, seedRng } from '../src/index.ts';

function firstFive(seed: number): number[] {
  const rng = seedRng(seed);
  return [1, 2, 3, 4, 5].map(() => nextUint32(rng));
}

// Cross-checked against an independent Python sfc32 in S2. Changing these breaks every replay.
test.each([
  { seed: 0, expected: [1363572419, 145230303, 808754475, 4216505632, 947923937] },
  { seed: 42, expected: [1264412219, 1947509147, 3919439299, 1251167922, 656401615] },
  { seed: 0xffffffff, expected: [1984736529, 3747275468, 1287205723, 2021412065, 2215341480] },
])('seed $seed always produces the same sequence', ({ seed, expected }) => {
  expect(firstFive(seed)).toEqual(expected);
});

test('outputs are uint32 and the generator state stays uint32', () => {
  const rng = seedRng(7);
  for (let i = 0; i < 10_000; i++) {
    const value = nextUint32(rng);
    for (const word of [value, rng.a, rng.b, rng.c, rng.counter]) {
      expect(Number.isInteger(word) && word >= 0 && word <= 0xffffffff).toBe(true);
    }
  }
});

test.each([-1, 0x100000000, 3 / 2, Number.NaN])('seed %s is rejected', (seed) => {
  expect(() => seedRng(seed)).toThrow(/uint32/);
});
