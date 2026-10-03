import { expect, test } from 'vitest';
import { checkInvariants, createMatch, step, type CardId, type CardStats, type Command, type SimState } from '../src/index.ts';
import { matchSetup, TROOPS } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000. Towers hold ids 0–5.

const PACK = { hp: 100, speed: 50, radius: 300, mass: 2, range: 0, sight: 4000, damage: 10, hitTicks: 10, firstHitTicks: 5, targets: 'ground', layer: 'ground' } as const;

function swarmMatch(count: number): SimState {
  const cards: Record<CardId, CardStats> = { ...TROOPS, pack: { cost: 1, type: 'troop', unit: { ...PACK, count } } };
  const packs = Array.from({ length: 8 }, () => 'pack');
  return createMatch({ ...matchSetup(5), cards, decks: [packs, packs] });
}

function play(state: SimState, side: 0 | 1, x: number, y: number): Command {
  return { tick: state.tick, side, handSlot: 0, x, y };
}

const spots = (state: SimState) => state.units.map(({ id, side, x, y }) => ({ id, side, x, y }));

test('a swarm play spawns its count of units a diameter apart around the aim, front row first', () => {
  const start = swarmMatch(4);
  const after = step(start, [play(start, 0, 5000, 6000)]);
  expect(after.rejected).toEqual([]);
  expect(spots(after)).toEqual([
    { id: 6, side: 0, x: 4700, y: 6300 },
    { id: 7, side: 0, x: 5300, y: 6300 },
    { id: 8, side: 0, x: 4700, y: 5700 },
    { id: 9, side: 0, x: 5300, y: 5700 },
  ]);
  expect(after.units.every((unit) => unit.deployTicks === 19 && unit.hp === 100)).toBe(true);
  expect(after.nextId).toBe(10);
  // One play: one card cycled, one cost paid.
  expect(after.players[0].energy).toBe(4);
});

test('side 1’s formation is side 0’s mirrored, its front row toward side 0', () => {
  const start = swarmMatch(4);
  const after = step(start, [play(start, 0, 5000, 6000), play(start, 1, 5000, 14_000)]);
  const [mine, theirs] = [after.units.filter((u) => u.side === 0), after.units.filter((u) => u.side === 1)];
  expect(theirs.map(({ x, y }) => ({ x, y }))).toEqual(mine.map(({ x, y }) => ({ x, y: 20_000 - y })));
});

test('a short last row is centered', () => {
  const start = swarmMatch(3);
  const after = step(start, [play(start, 0, 5000, 6000)]);
  expect(spots(after).map(({ x, y }) => [x, y])).toEqual([[4700, 6300], [5300, 6300], [5000, 5700]]);
  const one = swarmMatch(1);
  expect(spots(step(one, [play(one, 0, 5000, 6000)])).map(({ x, y }) => [x, y])).toEqual([[5000, 6000]]);
});

test('a swarm aimed at a corner or the riverbank stays inside the arena and out of the river', () => {
  const start = swarmMatch(9);
  for (const [x, y] of [[0, 0], [9999, 8999], [5000, 8999]] as const) {
    const after = step(start, [play(start, 0, x, y)]);
    expect(after.units).toHaveLength(9);
    expect(checkInvariants(after)).toEqual([]);
  }
  // Mid-river there is no bridge: the front row, aimed into the water, is put back on the bank.
  const bank = step(start, [play(start, 0, 5000, 8999)]);
  expect(bank.units.every((unit) => unit.y < 9000)).toBe(true);
});

test('every unit of a swarm is its own unit: it locks on and takes hits alone', () => {
  const start = swarmMatch(4);
  let state = step(start, [play(start, 0, 5000, 7000), play(start, 1, 5000, 13_000)]);
  for (let i = 0; i < 200 && state.result === null; i++) {
    state = step(state, []);
    expect(checkInvariants(state)).toEqual([]);
  }
  // They met in the middle, so some fell and the rest hold different targets or hp.
  expect(state.units.length).toBeLessThan(8);
  expect(new Set(state.units.map((unit) => `${String(unit.targetId)} ${String(unit.hp)}`)).size).toBeGreaterThan(1);
});

test('a match refuses a troop that spawns no units', () => {
  expect(() => swarmMatch(0)).toThrow(/pack count must be an integer in \[1, 30\], got 0/);
});
