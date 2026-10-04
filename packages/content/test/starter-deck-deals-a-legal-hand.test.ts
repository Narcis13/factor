import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import { CARD_IDS, CARDS, DECK_CARD_IDS, MATCH_RULES, matchSetup, STARTER_DECK } from '../src/index.ts';

test('sixteen deck cards, each costing something playable; the hive’s mite is never dealt', () => {
  expect(DECK_CARD_IDS).toEqual([
    'juggernaut', 'warden', 'slinger', 'flare', 'harrier', 'rabble', 'bombardier', 'bastion',
    'hive', 'charger', 'airship', 'wisps', 'meteor', 'spark', 'reaver', 'duelist',
  ]);
  expect(CARD_IDS).toEqual([...DECK_CARD_IDS, 'mite']);
  for (const id of CARD_IDS) {
    expect(CARDS[id].cost).toBeGreaterThan(0);
    expect(CARDS[id].cost).toBeLessThanOrEqual(MATCH_RULES.energy.max);
  }
});

test('the starter deck is eight different deck cards, one per Stage 2 archetype', () => {
  expect(STARTER_DECK).toEqual(DECK_CARD_IDS.slice(0, MATCH_RULES.deckSize));
  expect(new Set(STARTER_DECK).size).toBe(MATCH_RULES.deckSize);
});

test('a match on the starter decks deals each side 4 cards plus a queue, with 5 energy', () => {
  const { players, cards } = createMatch(matchSetup(0));
  // The match carries its decks' cards, and no others.
  expect(cards).toEqual(Object.fromEntries([...STARTER_DECK].sort().map((id) => [id, CARDS[id]])));
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
