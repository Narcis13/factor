import { expect, test } from 'vitest';
import { createMatch, type CardId, type CardStats, type SimState } from '../src/index.ts';
import { matchSetup, place, runChecked, TOWER_STATS, TROOPS } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000. Towers hold ids 0–5 and deal nothing here.

const NEST = { hp: 500, speed: 0, radius: 600, mass: 1, range: 0, sight: 0, targets: 'ground', layer: 'ground', count: 1, damage: 0, splash: 0, projectileSpeed: 0, hitTicks: 10, firstHitTicks: 5 } as const;
const PUP = { hp: 100, speed: 50, radius: 300, mass: 1, range: 0, sight: 3000, targets: 'ground', layer: 'ground', count: 2, damage: 0, splash: 0, projectileSpeed: 0, hitTicks: 10, firstHitTicks: 5 } as const;

/** `nest`: a building that lasts 200 ticks and deploys two `pup`s every 30; `pup` itself is in no deck. */
const CARDS: Record<CardId, CardStats> = {
  ...TROOPS,
  nest: { cost: 1, type: 'building', lifetimeTicks: 200, spawn: { card: 'pup', everyTicks: 30 }, unit: NEST },
  pup: { cost: 1, type: 'troop', unit: PUP },
};
const DECK = ['nest', 'walker', 'archer', 'walker', 'archer', 'walker', 'archer', 'walker'];

function match(cards: Record<CardId, CardStats> = CARDS): SimState {
  const harmless = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  return createMatch({ ...matchSetup(5), towerStats: harmless, cards, decks: [DECK, DECK] });
}

test('the card a building spawns comes with it into the match, though no deck holds it', () => {
  expect(Object.keys(match().cards).sort()).toEqual(['archer', 'nest', 'pup', 'walker']);
});

test('a spawning building deploys its troop’s group in front of it as it stands, then every so often', () => {
  const start = place(match(), { side: 0, card: 'nest', x: 5000, y: 6000, deployTicks: 20 });
  const states = runChecked(start, 81);
  const pups = (at: number) => states[at]?.units.filter((unit) => unit.card === 'pup') ?? [];
  // Deploying for 20 ticks; it stands from tick 21 (age 1) and spawns then, then every 30 ticks.
  expect(pups(20)).toEqual([]);
  expect(pups(21).map(({ x, y, deployTicks, side }) => ({ x, y, deployTicks, side }))).toEqual([
    { x: 4700, y: 6900, deployTicks: 0, side: 0 },
    { x: 5300, y: 6900, deployTicks: 0, side: 0 },
  ]);
  expect(pups(50)).toHaveLength(2);
  expect(pups(51)).toHaveLength(4);
  expect(pups(81)).toHaveLength(6);
});

test('side 1’s building spawns toward side 0', () => {
  const states = runChecked(place(match(), { side: 1, card: 'nest', x: 5000, y: 14_000, deployTicks: 0 }), 1);
  expect(states[1]?.units.filter((unit) => unit.card === 'pup').map(({ y }) => y)).toEqual([13_100, 13_100]);
});

test.each([
  ['spawns a spell', { spawn: { card: 'zap', everyTicks: 30 } }, /nest spawns zap, which is not a troop/],
  ['spawns and attacks', { unit: { ...NEST, damage: 5 } }, /nest spawns, so it must not attack/],
  ['spawns never', { spawn: { card: 'pup', everyTicks: 0 } }, /nest spawn everyTicks must be an integer ≥ 1/],
])('a building that %s is refused', (_label, change, message) => {
  const nest = CARDS.nest;
  if (nest?.type !== 'building') {
    throw new Error('nest is a building');
  }
  const cards = { ...CARDS, zap: { cost: 1, type: 'spell', spell: { radius: 0, damage: 0, towerDamageBp: 0 } }, nest: { ...nest, ...change } } as Record<CardId, CardStats>;
  expect(() => match(cards)).toThrow(message);
});
