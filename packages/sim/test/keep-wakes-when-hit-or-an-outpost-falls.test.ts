import { expect, test } from 'vitest';
import { createMatch, step, type CardId, type CardStats, type SimState } from '../src/index.ts';
import { CARDS, DECK, matchSetup, newMatch, place, runChecked as run, TOWER_STATS, TROOP_DECK, TROOPS, troopMatch, walkMatch } from './fixtures.ts';

// Fixture numbers: towers hit for 10 every 10 ticks, 5 ticks after locking on, 2 tiles past their
// footprint. Side 0's Keep (id 0) stands on 4000–6000 × 1000–3000 and its left Outpost (id 1) on
// 1000–3000 × 4000–6000; side 1's Keep is id 3 and its left Outpost id 4. An archer (hp 200, radius 400,
// range 3000) hits for 20; a walker (hp 500, radius 500, melee) for 50.

const keep = (state: SimState | undefined, id: 0 | 3) => state?.towers.find((tower) => tower.id === id);

test('the Keeps start dormant and the Outposts active', () => {
  const { towers } = newMatch(1);
  expect(towers.map((tower) => [tower.kind, tower.dormant])).toEqual([
    ['keep', true],
    ['outpost', false],
    ['outpost', false],
    ['keep', true],
    ['outpost', false],
    ['outpost', false],
  ]);
});

test('a dormant Keep ignores an enemy in its range while an Outpost locks on to it', () => {
  // Still deploying at (5000, 4000): 500 from the Keep's footprint and 1500 from the Outpost's.
  const states = run(place(troopMatch(5), { side: 1, card: 'walker', x: 5000, y: 4000, deployTicks: 20 }), 15);
  for (const state of states) {
    expect(keep(state, 0)).toMatchObject({ dormant: true, targetId: null, hp: 300 });
  }
  expect(states[1]?.towers[1]?.targetId).toBe(6);
});

test('hits for no damage leave a Keep dormant', () => {
  const states = run(place(walkMatch(5), { side: 1, card: 'walker', x: 5000, y: 3500 }), 100);
  expect(states[100]?.units[0]?.targetId).toBe(0);
  expect(keep(states[100], 0)).toMatchObject({ dormant: true, hp: 300, targetId: null });
});

test('a Keep wakes on the tick a unit damages it, and locks on and fires from the next tick', () => {
  // Only the Keeps deal damage. The archer at (5000, 4800) is 1400 from the Keep and 1600 from the Outposts,
  // so it takes the Keep: it locks on at tick 1 and first hits at tick 6.
  const towerStats = { ...TOWER_STATS, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  const start = createMatch({ ...matchSetup(5), towerStats, cards: TROOPS, decks: [TROOP_DECK, TROOP_DECK] });
  const states = run(place(start, { side: 1, card: 'archer', x: 5000, y: 4800 }), 40);
  expect(keep(states[5], 0)).toMatchObject({ dormant: true, hp: 300 });
  expect(keep(states[6], 0)).toMatchObject({ dormant: false, hp: 280, targetId: null });
  expect(keep(states[7], 0)).toMatchObject({ dormant: false, targetId: 6, cooldown: 5 });
  const archerHp = (tick: number) => states[tick]?.units[0]?.hp;
  expect([archerHp(11), archerHp(12), archerHp(22)]).toEqual([200, 190, 180]);
  expect(keep(states[40], 0)?.dormant).toBe(false);
  expect(keep(states[40], 3)?.dormant).toBe(true);
});

/** A 1-tile spell for 100 damage, half of it against towers. */
const ZAP: CardStats = { cost: 1, type: 'spell', spell: { radius: 1000, damage: 100, towerDamageBp: 5000 } };
const ZAPS: CardId[] = Array.from({ length: 8 }, () => 'zap');

test('a spell that damages a Keep wakes it; one that deals nothing, or only hits an Outpost, does not', () => {
  const start = createMatch({ ...matchSetup(5), cards: { ...CARDS, zap: ZAP }, decks: [ZAPS, DECK] });
  const dudSlot = start.players[1].hand.findIndex((card) => (start.cards[card]?.cost ?? 99) <= 5);
  const next = step(start, [
    { tick: 0, side: 0, handSlot: 0, x: 5000, y: 18_000 },
    { tick: 0, side: 1, handSlot: dudSlot, x: 5000, y: 2000 },
  ]);
  expect(next.rejected).toEqual([]);
  expect(keep(next, 3)).toMatchObject({ dormant: false, hp: 250 });
  expect(keep(next, 0)).toMatchObject({ dormant: true, hp: 300 });

  const outpostOnly = step(start, [{ tick: 0, side: 0, handSlot: 0, x: 2000, y: 15_000 }]);
  expect(outpostOnly.towers[4]?.hp).toBe(150);
  expect(keep(outpostOnly, 3)).toMatchObject({ dormant: true, hp: 300 });
});

test('a Keep wakes, unhurt, on the tick one of its Outposts falls; the other Keep sleeps on', () => {
  // Side 0's left Outpost is down to 10 hp; a side 1 walker touching it locks on at tick 1 and fells it at tick 6.
  const troops = troopMatch(5);
  const weak: SimState = { ...troops, towers: troops.towers.map((tower) => (tower.id === 1 ? { ...tower, hp: 10 } : tower)) };
  const states = run(place(weak, { side: 1, card: 'walker', x: 2000, y: 6500 }), 10);
  expect(states[5]?.towers[1]?.hp).toBe(10);
  expect(keep(states[5], 0)?.dormant).toBe(true);
  expect(states[6]?.towers[1]?.hp).toBe(0);
  expect(states[6]?.stars).toEqual([0, 1]);
  expect(keep(states[6], 0)).toMatchObject({ dormant: false, hp: 300 });
  expect(keep(states[10], 3)?.dormant).toBe(true);
});
