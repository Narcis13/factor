import { expect, test } from 'vitest';
import { checkInvariants, step, type Player, type SimState, type Tower, type Unit } from '../src/index.ts';
import { idle, newMatch, RULES, troopMatch } from './fixtures.ts';

// 100 ticks of regulation and 40 of overtime, so the timer runs out at tick 140.
const healthy = newMatch(3, { ...RULES, regulationTicks: 100, overtimeTicks: 40 });

function withTower(index: number, change: Partial<Tower>): Tower[] {
  return healthy.towers.map((tower, i) => (i === index ? { ...tower, ...change } : tower));
}

function withPlayer(side: 0 | 1, change: Partial<Player>): SimState['players'] {
  const players: SimState['players'] = [healthy.players[0], healthy.players[1]];
  players[side] = { ...players[side], ...change };
  return players;
}

test('a fresh match and a finished match are healthy', () => {
  expect(checkInvariants(healthy)).toEqual([]);
  expect(checkInvariants(idle(healthy, 140))).toEqual([]);
});

test.each<{ label: string; broken: SimState; message: RegExp }>([
  { label: 'a tick past the end', broken: { ...healthy, tick: 141 }, message: /tick 141 is outside/ },
  { label: 'a negative tick', broken: { ...healthy, tick: -1 }, message: /tick -1 is outside/ },
  {
    label: 'no result when the timer runs out',
    broken: { ...healthy, tick: 140 },
    message: /timer ran out/,
  },
  {
    label: 'an rng word that is not a uint32',
    broken: { ...healthy, rng: { ...healthy.rng, c: -1 } },
    message: /rng\.c -1/,
  },
  { label: 'more than 3 stars', broken: { ...healthy, stars: [4, 0] }, message: /side 0 has 4 stars/ },
  {
    label: 'a fallen Keep with no result',
    broken: { ...healthy, towers: withTower(3, { hp: 0 }) },
    message: /side 1's Keep has fallen but the match has no result/,
  },
  {
    label: 'a tower with a fractional cooldown',
    broken: { ...healthy, towers: withTower(2, { targetId: 9, cooldown: 3 / 2 }) },
    message: /tower 2 has target 9 and cooldown 1\.5/,
  },
  { label: 'negative stars', broken: { ...healthy, stars: [0, -1] }, message: /side 1 has -1 stars/ },
  {
    label: 'a draw with untied stars',
    broken: { ...healthy, stars: [1, 0], result: { winner: null } },
    message: /draw with stars 1-0/,
  },
  {
    label: 'a winner with fewer stars',
    broken: { ...healthy, stars: [0, 1], result: { winner: 0 } },
    message: /side 0 won with fewer stars/,
  },
  {
    label: 'a tower above its max hp',
    broken: { ...healthy, towers: withTower(1, { hp: 201 }) },
    message: /tower 1 has hp 201 of 200/,
  },
  {
    label: 'a tower below 0 hp',
    broken: { ...healthy, towers: withTower(1, { hp: -1 }) },
    message: /tower 1 has hp -1/,
  },
  {
    label: 'a duplicate tower id',
    broken: { ...healthy, towers: withTower(2, { id: 1 }) },
    message: /tower 1 breaks unique ascending ids/,
  },
  {
    label: 'a tower sticking out of the arena',
    broken: { ...healthy, towers: withTower(0, { x: 999 }) },
    message: /tower 0 \(999, 2000\) size 2000 is not inside the arena/,
  },
  {
    label: 'a tower past the far edge',
    broken: { ...healthy, towers: withTower(3, { y: 19_001 }) },
    message: /tower 3 .* is not inside the arena/,
  },
  {
    label: 'energy above max',
    broken: { ...healthy, players: withPlayer(0, { energy: 11 }) },
    message: /side 0 has 11 energy, outside \[0, 10\]/,
  },
  {
    label: 'negative energy',
    broken: { ...healthy, players: withPlayer(1, { energy: -1 }) },
    message: /side 1 has -1 energy/,
  },
  {
    label: 'progress that should have become energy',
    broken: { ...healthy, players: withPlayer(0, { energyProgress: 56 }) },
    message: /side 0 has energy progress 56 at 5 energy/,
  },
  {
    label: 'progress building up at max energy',
    broken: { ...healthy, players: withPlayer(0, { energy: 10, energyProgress: 1 }) },
    message: /side 0 has energy progress 1 at 10 energy/,
  },
  {
    label: 'a card missing from the hand',
    broken: { ...healthy, players: withPlayer(1, { hand: healthy.players[1].hand.slice(1) }) },
    message: /side 1 holds 3 \+ 4 cards, not 4 \+ 4/,
  },
  {
    label: 'a card that is not in the match',
    broken: { ...healthy, players: withPlayer(0, { queue: [...healthy.players[0].queue.slice(1), 'c9'] }) },
    message: /side 0 holds an unknown card: c9/,
  },
])('$label is a violation', ({ broken, message }) => {
  const violations = checkInvariants(broken);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatch(message);
});

// One walker (id 6) of side 0, deployed at (2000, 4000) and still waiting out its delay.
const troops = troopMatch(3);
const withUnit = step(troops, [{ tick: 0, side: 0, handSlot: troops.players[0].hand.indexOf('walker'), x: 2000, y: 4000 }]);

function unitWith(change: Partial<Unit>): SimState {
  return { ...withUnit, units: withUnit.units.map((unit) => ({ ...unit, ...change })) };
}

test('a match with a unit on the field is healthy', () => {
  expect(withUnit.units).toHaveLength(1);
  expect(checkInvariants(withUnit)).toEqual([]);
});

test.each<{ label: string; broken: SimState; message: RegExp }>([
  { label: 'a unit with 0 hp', broken: unitWith({ hp: 0 }), message: /unit 6 has hp 0 of 500/ },
  { label: 'a unit above max hp', broken: unitWith({ hp: 501 }), message: /unit 6 has hp 501 of 500/ },
  { label: 'a unit sharing a tower id', broken: unitWith({ id: 5 }), message: /unit 5 breaks unique ascending ids/ },
  { label: 'a unit id not yet handed out', broken: unitWith({ id: 7 }), message: /unit 7 breaks unique ascending ids/ },
  { label: 'a deploy delay longer than the rule', broken: unitWith({ deployTicks: 21 }), message: /unit 6 has 21 deploy ticks/ },
  { label: 'a unit off the arena', broken: unitWith({ x: 10_000 }), message: /unit 6 \(10000, 4000\) is outside the arena/ },
  { label: 'a unit at a fractional spot', broken: unitWith({ y: 8001 / 2 }), message: /unit 6 .* is outside the arena/ },
  { label: 'a unit in the river off the bridges', broken: unitWith({ x: 5000, y: 9500 }), message: /unit 6 .* is in the river off any bridge/ },
  { label: 'a unit from a card not in the match', broken: unitWith({ card: 'c1' }), message: /unit 6 comes from c1/ },
])('$label is a violation', ({ broken, message }) => {
  const violations = checkInvariants(broken);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatch(message);
});

test('a unit on a bridge is not in the river', () => {
  expect(checkInvariants(unitWith({ x: 2000, y: 9500 }))).toEqual([]);
});
