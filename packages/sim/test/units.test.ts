import { expect, test } from 'vitest';
import { TICKS_PER_SECOND } from '../src/index.ts';

test('a tick is a whole number of milliseconds', () => {
  expect(1000 % TICKS_PER_SECOND).toBe(0);
});
