import { DECK_CARD_IDS, STARTER_DECK } from '@factor/content';
import { expect, test } from 'vitest';
import { cardSummaries, cardSummary, isComplete, matchUrl, storedDeck, toggleCard } from '../src/deck-builder.ts';

test('tapping a card adds it, tapping it again takes it out, and a full deck takes no more', () => {
  let draft = toggleCard([], 'warden');
  expect(draft).toEqual(['warden']);
  draft = toggleCard(draft, 'flare');
  expect(toggleCard(draft, 'warden')).toEqual(['flare']);
  const full = [...STARTER_DECK];
  expect(toggleCard(full, 'meteor')).toEqual(full);
  expect(toggleCard(full, 'meteor')).not.toBe(full);
  expect(isComplete(full)).toBe(true);
  expect(isComplete(full.slice(1))).toBe(false);
});

test('the kept deck is used if it is still a deck, the starter deck if not', () => {
  const mine = ['hive', 'charger', 'airship', 'wisps', 'meteor', 'spark', 'reaver', 'duelist'];
  expect(storedDeck(JSON.stringify(mine))).toEqual(mine);
  expect(storedDeck(null)).toEqual(STARTER_DECK);
  expect(storedDeck('not json')).toEqual(STARTER_DECK);
  expect(storedDeck(JSON.stringify(mine.slice(1)))).toEqual(STARTER_DECK);
  expect(storedDeck(JSON.stringify([...mine.slice(1), 'mite']))).toEqual(STARTER_DECK);
});

test('every deck card has a summary of plain facts drawn from its stats', () => {
  const summaries = cardSummaries();
  expect(summaries.map((summary) => summary.id)).toEqual(DECK_CARD_IDS);
  expect(cardSummary('rabble')).toMatchObject({ name: 'Rabble', cost: 3, kind: 'Troop' });
  expect(cardSummary('rabble').facts[0]).toMatch(/^×4 · \d+ hp · \d+ damage$/);
  expect(cardSummary('harrier').facts).toContain('flies · hits air and ground');
  expect(cardSummary('juggernaut').facts).toContain('hits buildings only');
  expect(cardSummary('hive')).toMatchObject({ kind: 'Building' });
  expect(cardSummary('hive').facts[1]).toMatch(/^spawns mites every 5 s$/);
  expect(cardSummary('meteor')).toMatchObject({ kind: 'Spell' });
  expect(cardSummary('meteor').facts).toContain('30% to towers');
  for (const summary of summaries) {
    expect(summary.facts.length).toBeGreaterThan(0);
    expect(summary.facts.every((fact) => !fact.includes('undefined') && !fact.includes('NaN'))).toBe(true);
  }
});

test('battle opens a live match on its seed', () => {
  expect(matchUrl(42)).toBe('?play&seed=42');
});
