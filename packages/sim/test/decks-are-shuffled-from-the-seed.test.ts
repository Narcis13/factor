import { expect, test } from 'vitest';
import { createMatch, hashState, nextBelow, seedRng, type MatchRules, type MatchSetup } from '../src/index.ts';
import { CARDS, DECK, dud, matchSetup, newMatch, RULES } from './fixtures.ts';

function order(seed: number, side: 0 | 1 = 0): string[] {
  const { hand, queue } = newMatch(seed).players[side];
  return [...hand, ...queue];
}

test('each side holds its whole deck: 4 in hand, 4 in the queue', () => {
  for (const side of [0, 1] as const) {
    const { hand, queue } = newMatch(9).players[side];
    expect(hand).toHaveLength(4);
    expect(queue).toHaveLength(4);
    expect([...hand, ...queue].sort()).toEqual([...DECK].sort());
  }
});

// Pinned: changing the shuffle or the order it draws in breaks every replay.
test('the shuffle is fixed per seed', () => {
  expect(order(1234, 0)).toEqual(['c6', 'c2', 'c7', 'c1', 'c4', 'c8', 'c3', 'c5']);
  expect(order(1234, 1)).toEqual(['c8', 'c2', 'c4', 'c6', 'c5', 'c1', 'c7', 'c3']);
  expect(order(1234)).toEqual(order(1234));
});

test('different seeds deal different orders, and the two sides are shuffled separately', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  expect(new Set(seeds.map((seed) => order(seed).join())).size).toBe(seeds.length);
  expect(seeds.filter((seed) => order(seed, 0).join() === order(seed, 1).join())).toEqual([]);
});

test('every card is equally likely to be dealt first', () => {
  const firsts: Record<string, number> = {};
  for (let seed = 0; seed < 8000; seed++) {
    const first = order(seed)[0] ?? '';
    firsts[first] = (firsts[first] ?? 0) + 1;
  }
  // 1000 each on average; ±15% is over 5 standard deviations.
  for (const id of DECK) {
    expect(firsts[id]).toBeGreaterThan(850);
    expect(firsts[id]).toBeLessThan(1150);
  }
});

test('the state holds the stats of the cards in the decks, and no others', () => {
  const decks: MatchSetup['decks'] = [DECK, DECK.map(() => 'c1')];
  const extra = { ...CARDS, c9: dud(9) };
  const state = createMatch({ ...matchSetup(1), cards: extra, decks });
  expect(state.cards).toEqual(CARDS);
  expect(state.cards.c1).not.toBe(CARDS.c1);
});

test('decks and card stats are part of the hash', () => {
  const base = hashState(newMatch(1));
  const cheaper = { ...CARDS, c8: dud(7) };
  expect(hashState(createMatch({ ...matchSetup(1), cards: cheaper }))).not.toBe(base);
  const swapped: MatchSetup['decks'] = [DECK, [...DECK.slice(1), 'c1']];
  expect(hashState(createMatch({ ...matchSetup(1), decks: swapped }))).not.toBe(base);
});

test.each<{ label: string; change: Partial<MatchSetup>; message: RegExp }>([
  { label: 'a short deck', change: { decks: [DECK.slice(1), DECK] }, message: /Side 0's deck has 7 cards, not 8/ },
  { label: 'a long deck', change: { decks: [DECK, [...DECK, 'c1']] }, message: /Side 1's deck has 9 cards/ },
  { label: 'an unknown card', change: { decks: [DECK, [...DECK.slice(1), 'c9']] }, message: /Unknown card: c9/ },
  {
    label: 'a card named after an Object method',
    change: { decks: [DECK, [...DECK.slice(1), 'toString']] },
    message: /Unknown card: toString/,
  },
  { label: 'a cost above max energy', change: { cards: { ...CARDS, c8: dud(11) } }, message: /c8 cost/ },
  { label: 'a negative cost', change: { cards: { ...CARDS, c1: dud(-1) } }, message: /c1 cost/ },
  { label: 'a fractional cost', change: { cards: { ...CARDS, c1: dud(3 / 2) } }, message: /c1 cost/ },
])('$label is rejected', ({ change, message }) => {
  expect(() => createMatch({ ...matchSetup(1), ...change })).toThrow(message);
});

test.each<{ label: string; rules: MatchRules }>([
  { label: 'a hand as big as the deck', rules: { ...RULES, handSize: 8 } },
  { label: 'an empty hand', rules: { ...RULES, handSize: 0 } },
  { label: 'a start above max energy', rules: { ...RULES, energy: { ...RULES.energy, start: 11 } } },
  { label: 'no max energy', rules: { ...RULES, energy: { ...RULES.energy, max: 0, start: 0 } } },
  { label: 'instant regeneration', rules: { ...RULES, energy: { ...RULES.energy, ticksPerEnergy: 0 } } },
  { label: 'a fractional regeneration', rules: { ...RULES, energy: { ...RULES.energy, ticksPerEnergy: 5 / 2 } } },
  { label: 'a negative double-rate tick', rules: { ...RULES, energy: { ...RULES.energy, doubleFromTick: -1 } } },
])('rules with $label are rejected', ({ rules }) => {
  expect(() => newMatch(1, rules)).toThrow(RangeError);
});

test('nextBelow stays below its bound and rejects bad bounds', () => {
  const rng = seedRng(3);
  for (const bound of [1, 2, 3, 7, 8, 1000, 0x100000000]) {
    for (let i = 0; i < 200; i++) {
      const value = nextBelow(rng, bound);
      expect(Number.isSafeInteger(value) && value >= 0 && value < bound).toBe(true);
    }
  }
  for (const bound of [0, -1, 5 / 2, 0x100000001]) {
    expect(() => nextBelow(rng, bound)).toThrow(RangeError);
  }
});
