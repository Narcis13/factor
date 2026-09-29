import { TICKS_PER_SECOND } from '@factor/sim';
import { expect, test } from 'vitest';

test('content resolves the sim through the workspace', () => {
  expect(TICKS_PER_SECOND).toBe(20);
});
