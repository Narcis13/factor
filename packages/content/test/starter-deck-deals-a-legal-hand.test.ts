import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import { CARD_IDS, CARDS, MATCH_RULES, matchSetup, STARTER_DECK } from '../src/index.ts';

test('the 4 Stage 1 cards each cost something playable', () => {
  expect(CARD_IDS).toEqual(['juggernaut', 'warden', 'slinger', 'flare']);
  for (const id of CARD_IDS) {
    expect(CARDS[id].cost).toBeGreaterThan(0);
    expect(CARDS[id].cost).toBeLessThanOrEqual(MATCH_RULES.energy.max);
  }
});

test('the starter deck is a full deck holding each card twice', () => {
  expect(STARTER_DECK).toHaveLength(MATCH_RULES.deckSize);
  for (const id of CARD_IDS) {
    expect(STARTER_DECK.filter((card) => card === id)).toHaveLength(2);
  }
});

test('a match on the starter decks deals each side 4 cards plus a queue, with 5 energy', () => {
  const { players, cards } = createMatch(matchSetup(0));
  expect(cards).toEqual(CARDS);
  for (const player of players) {
    expect(player.energy).toBe(5);
    expect(player.hand).toHaveLength(4);
    expect([...player.hand, ...player.queue].sort()).toEqual([...STARTER_DECK].sort());
  }
});

test('matchSetup takes the decks it is given, as copies', () => {
  const flares = STARTER_DECK.map(() => 'flare' as const);
  const setup = matchSetup(0, [flares, STARTER_DECK]);
  expect(setup.decks[0]).toEqual(flares);
  expect(setup.decks[0]).not.toBe(flares);
  expect(createMatch(setup).players[0].hand).toEqual(['flare', 'flare', 'flare', 'flare']);
});
