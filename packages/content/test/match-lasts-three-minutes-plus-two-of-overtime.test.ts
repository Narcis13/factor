import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import { MATCH_RULES, matchSetup } from '../src/index.ts';

test('regulation is 3:00 and overtime up to 2:00, at 20 ticks/s', () => {
  expect(MATCH_RULES.regulationTicks).toBe(3600);
  expect(MATCH_RULES.overtimeTicks).toBe(2400);
});

test('energy starts at 5 of 10 and regenerates one per 2.8 s, twice as fast from 2:00 on', () => {
  expect(MATCH_RULES.energy).toEqual({ start: 5, max: 10, ticksPerEnergy: 56, doubleFromTick: 2400 });
});

test('decks hold 8 cards, 4 of them in hand', () => {
  expect([MATCH_RULES.deckSize, MATCH_RULES.handSize]).toEqual([8, 4]);
});

test('the sim accepts the match rules', () => {
  expect(createMatch(matchSetup(0)).rules).toEqual(MATCH_RULES);
});
