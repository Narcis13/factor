import { MILLI_PER_TILE } from '@factor/sim';
import { expect, test } from 'vitest';

test('client resolves the sim through the workspace', () => {
  expect(MILLI_PER_TILE).toBe(1000);
});
