import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import { MATCH_RULES } from '../src/index.ts';

test('regulation is 3:00 and overtime up to 2:00, at 20 ticks/s', () => {
  expect(MATCH_RULES).toEqual({ regulationTicks: 3600, overtimeTicks: 2400 });
});

test('the sim accepts the match rules', () => {
  expect(createMatch({ seed: 0, rules: MATCH_RULES }).rules).toEqual(MATCH_RULES);
});
