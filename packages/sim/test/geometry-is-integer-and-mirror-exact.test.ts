import { expect, test } from 'vitest';
import { distanceToRect, divRound, isqrt, moveToward } from '../src/geometry.ts';

test('isqrt is the floor of the square root, right at the perfect squares', () => {
  for (let n = 0; n < 2000; n++) {
    const root = isqrt(n);
    expect(root * root).toBeLessThanOrEqual(n);
    expect((root + 1) * (root + 1)).toBeGreaterThan(n);
  }
  // Around the largest squared distance the arena can hold, and beyond.
  expect(isqrt(32_000 * 32_000 + 18_000 * 18_000)).toBe(36_715);
  expect(isqrt(94_906_265 * 94_906_265)).toBe(94_906_265);
  expect(isqrt(94_906_265 * 94_906_265 - 1)).toBe(94_906_264);
});

test('divRound rounds to nearest, halves away from zero, so negating the input negates the output', () => {
  expect([divRound(5, 2), divRound(4, 3), divRound(5, 3), divRound(0, 7)]).toEqual([3, 1, 2, 0]);
  for (let a = -50; a <= 50; a++) {
    for (const b of [1, 2, 3, 7]) {
      expect(divRound(-a, b)).toBe(0 - divRound(a, b));
    }
  }
});

test('moveToward lands on the target when it is within reach, and moves about `length` otherwise', () => {
  const point = { x: 0, y: 0 };
  moveToward(point, { x: 30, y: 40 }, 50);
  expect(point).toEqual({ x: 30, y: 40 });
  const far = { x: 0, y: 0 };
  moveToward(far, { x: 3000, y: 4000 }, 50);
  expect(far).toEqual({ x: 30, y: 40 });
  const mirrored = { x: 0, y: 0 };
  moveToward(mirrored, { x: 3000, y: -4000 }, 50);
  expect(mirrored).toEqual({ x: 30, y: -40 });
});

test('distance to a rectangle is 0 inside it and measured to the nearest edge or corner outside', () => {
  const rect = { x: 1000, y: 1000, width: 2000, height: 2000 };
  expect(distanceToRect({ x: 2000, y: 2000 }, rect)).toBe(0);
  expect(distanceToRect({ x: 2000, y: 500 }, rect)).toBe(500);
  expect(distanceToRect({ x: 3300, y: 3400 }, rect)).toBe(500);
});
