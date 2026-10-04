import { expect, test } from 'vitest';
import { DECK_CARD_IDS, dealDeck, parseDeck, STARTER_DECK } from '../src/index.ts';

test('a dealt deck is eight different deck cards, the same for the same seed', () => {
  for (let seed = 0; seed < 50; seed++) {
    const deck = dealDeck(seed);
    expect(deck).toHaveLength(8);
    expect(new Set(deck).size).toBe(8);
    expect(deck.every((card) => DECK_CARD_IDS.includes(card))).toBe(true);
    expect(dealDeck(seed)).toEqual(deck);
  }
  expect(dealDeck(1)).not.toEqual(dealDeck(2));
  expect(new Set(Array.from({ length: 50 }, (_, seed) => dealDeck(seed)).flat()).size).toBe(16);
});

test('only eight different known deck cards parse as a deck', () => {
  expect(parseDeck([...STARTER_DECK])).toEqual(STARTER_DECK);
  expect(parseDeck(STARTER_DECK.slice(1))).toBeNull();
  expect(parseDeck([...STARTER_DECK.slice(1), STARTER_DECK[1]])).toBeNull();
  expect(parseDeck([...STARTER_DECK.slice(1), 'mite'])).toBeNull();
  expect(parseDeck([...STARTER_DECK.slice(1), 'dragon'])).toBeNull();
  expect(parseDeck('juggernaut')).toBeNull();
  expect(parseDeck(null)).toBeNull();
});
