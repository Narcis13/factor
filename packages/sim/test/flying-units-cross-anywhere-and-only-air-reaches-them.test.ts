import { expect, test } from 'vitest';
import { checkInvariants, createMatch, step, type CardId, type MatchSetup, type SimState, type Unit, type UnitStats } from '../src/index.ts';
import { AIR_DECK, AIR_TROOPS, airMatch, matchSetup, place, runChecked as run } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000, bridges at x 1000–3000 and 7000–9000.
// Side 0's left Outpost (id 1) stands on 1000–3000 × 4000–6000, side 1's (id 4) on 1000–3000 × 14000–16000.
// A walker (radius 500) targets `ground`; a flyer (radius 400, range 1000) and a gunner (radius 400,
// range 3000) target `air`, which reaches both layers.

function unit(state: SimState | undefined, id: number): Unit {
  const found = state?.units.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no unit ${String(id)}`);
  }
  return found;
}

const inRiver = ({ y }: Unit) => y >= 9000 && y < 11_000;
const overBridge = ({ x }: Unit) => (x >= 1000 && x <= 3000) || (x >= 7000 && x <= 9000);

test('a flyer flies straight at its goal, over the river away from the bridges', () => {
  const states = run(place(airMatch(5, true), { side: 0, card: 'flyer', x: 5000, y: 7000 }), 300);
  const path = states.map((state) => unit(state, 6));
  expect(path.some((at) => inRiver(at) && !overBridge(at))).toBe(true);
  // With nothing in sight it goes for the nearest enemy tower, side 1's left Outpost, and locks on in range.
  expect(path.find((at) => at.targetId !== null)?.targetId).toBe(4);
});

test('ground units and flyers pass through each other; flyers push flyers', () => {
  const mixed = place(airMatch(5, true), { side: 0, card: 'walker', x: 5000, y: 7000, deployTicks: 20 }, { side: 0, card: 'flyer', x: 5000, y: 7000, deployTicks: 20 });
  const after = step(mixed, []);
  expect([unit(after, 6), unit(after, 7)].map(({ x, y }) => [x, y])).toEqual([[5000, 7000], [5000, 7000]]);
  const flock = place(airMatch(5, true), { side: 0, card: 'flyer', x: 5000, y: 7000, deployTicks: 20 }, { side: 0, card: 'flyer', x: 5000, y: 7000, deployTicks: 20 });
  const spread = step(flock, []);
  expect([unit(spread, 6).x, unit(spread, 7).x]).toEqual([4600, 5400]);
});

test('a flyer is not pushed out of a tower or the river: it flies over both', () => {
  const states = run(place(airMatch(5, true), { side: 0, card: 'flyer', x: 2000, y: 5000, deployTicks: 20 }, { side: 0, card: 'flyer', x: 5000, y: 10_000, deployTicks: 20 }), 3);
  expect(unit(states[3], 6)).toMatchObject({ x: 2000, y: 5000 });
  expect(unit(states[3], 7)).toMatchObject({ x: 5000, y: 10_000 });
});

test('a ground-only unit ignores a flyer in reach; a unit that targets air locks on to it', () => {
  // The flyer (still deploying) is 1000 from each, center to center: 100 edge to edge from the walker.
  const flyer = { side: 1 as const, card: 'flyer', x: 5000, y: 8000, deployTicks: 20 };
  const walker = run(place(airMatch(5, true), { side: 0, card: 'walker', x: 5000, y: 7000 }, flyer), 5);
  expect(walker.slice(1).every((state) => unit(state, 6).targetId !== 7)).toBe(true);
  const gunner = run(place(airMatch(5, true), { side: 0, card: 'gunner', x: 5000, y: 7000 }, flyer), 1);
  expect(unit(gunner[1], 6).targetId).toBe(7);
});

test('a flyer hits ground units too, and towers shoot flyers', () => {
  const states = run(place(airMatch(5), { side: 0, card: 'flyer', x: 5000, y: 7000 }, { side: 1, card: 'walker', x: 5000, y: 8200, deployTicks: 20 }), 10);
  expect(unit(states[1], 6).targetId).toBe(7);
  expect(unit(states[10], 7).hp).toBeLessThan(500);
  // A side 1 flyer 600 from side 0's left Outpost, edge to edge: well inside its 2-tile range.
  const shot = run(place(airMatch(5), { side: 1, card: 'flyer', x: 2000, y: 7000, deployTicks: 20 }), 6);
  expect(shot[1]?.towers[1]?.targetId).toBe(6);
  expect(unit(shot[6], 6).hp).toBe(290);
});

test('a spell hits flyers in its circle like any unit', () => {
  const cards: Record<CardId, (typeof AIR_TROOPS)[string]> = { ...AIR_TROOPS, bolt: { cost: 1, type: 'spell', spell: { radius: 500, damage: 100, towerDamageBp: 0 } } };
  const bolts = ['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt'];
  const start = place(createMatch({ ...matchSetup(5), cards, decks: [bolts, AIR_DECK] }), { side: 1, card: 'flyer', x: 5000, y: 12_000, deployTicks: 20 });
  const after = step(start, [{ tick: 0, side: 0, handSlot: 0, x: 5000, y: 12_000 }]);
  expect(checkInvariants(after)).toEqual([]);
  expect(unit(after, 6).hp).toBe(200);
});

test('a match refuses a unit with an unknown layer or target filter', () => {
  const flyer = AIR_TROOPS.flyer;
  if (flyer?.type !== 'troop') {
    throw new Error('the fixture flyer is a troop');
  }
  // Hand-edited content can hold any string; the type system can't stop it, so the match must.
  const setup = (patch: Record<string, string>): MatchSetup => {
    const unit: UnitStats = Object.assign({ ...flyer.unit }, patch);
    return { ...matchSetup(5), cards: { ...AIR_TROOPS, flyer: { ...flyer, unit } }, decks: [AIR_DECK, AIR_DECK] };
  };
  expect(() => createMatch(setup({ layer: 'water' }))).toThrow(/flyer layer must be ground or air, got water/);
  expect(() => createMatch(setup({ targets: 'sea' }))).toThrow(/flyer targets must be ground, air or buildings, got sea/);
});
