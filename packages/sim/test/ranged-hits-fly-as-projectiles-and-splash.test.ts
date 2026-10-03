import { expect, test } from 'vitest';
import { checkInvariants, createMatch, step, type CardId, type CardStats, type SimState, type UnitStats } from '../src/index.ts';
import { AIR_TROOPS, matchSetup, place, runChecked as run, TOWER_STATS } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000; side 0's left Outpost (id 1) stands
// on 1000–3000 × 4000–6000. Towers hold ids 0–5. A walker has radius 500 and 500 hp; a flyer radius 400.

const SHOT = { hp: 300, speed: 40, radius: 400, mass: 3, sight: 4000, targets: 'ground', layer: 'ground', count: 1, hitTicks: 10, firstHitTicks: 5 } as const;

/** `shooter`: range 3000, 50 a hit, flying 500 a tick. `lobber`: the same with a 1000 splash. `cleaver`: melee with an 800 splash. */
const CARDS: Record<CardId, CardStats> = {
  ...AIR_TROOPS,
  shooter: { cost: 1, type: 'troop', unit: { ...SHOT, range: 3000, damage: 50, splash: 0, projectileSpeed: 500 } },
  lobber: { cost: 1, type: 'troop', unit: { ...SHOT, range: 3000, damage: 50, splash: 1000, projectileSpeed: 500 } },
  cleaver: { cost: 1, type: 'troop', unit: { ...SHOT, range: 0, damage: 50, splash: 800, projectileSpeed: 0 } },
};
const DECK = ['shooter', 'lobber', 'cleaver', 'walker', 'flyer', 'shooter', 'lobber', 'walker'];

/** Towers deal nothing unless `towerShots` makes them fire projectiles of that speed. */
function shotMatch(towerShots = 0): SimState {
  const tower = (stats: (typeof TOWER_STATS)['keep']) => ({ ...stats, damage: towerShots > 0 ? stats.damage : 0, projectileSpeed: towerShots });
  return createMatch({ ...matchSetup(5), towerStats: { keep: tower(TOWER_STATS.keep), outpost: tower(TOWER_STATS.outpost) }, cards: CARDS, decks: [DECK, DECK] });
}

const hpOf = (state: SimState | undefined, id: number) => state?.units.find((unit) => unit.id === id)?.hp;

test('a ranged hit flies as a projectile from its attacker and lands when it arrives', () => {
  // 2000 apart, center to center; locked on at tick 1, it fires at tick 6, and its shot flies 500 a tick.
  const start = place(shotMatch(), { side: 0, card: 'shooter', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 });
  const states = run(start, 12);
  expect(states[5]?.projectiles).toEqual([]);
  expect(states[6]?.projectiles).toEqual([{ id: 8, side: 0, x: 5000, y: 6000, targetId: 7, toX: 5000, toY: 8000, speed: 500, damage: 50, splash: 0, targets: 'ground' }]);
  expect(states[7]?.projectiles[0]).toMatchObject({ x: 5000, y: 6500 });
  expect(hpOf(states[9], 7)).toBe(500);
  expect(states[10]?.projectiles).toEqual([]);
  expect(hpOf(states[10], 7)).toBe(450);
  expect(states[10]?.nextId).toBe(9);
});

test('a projectile homes on its target as it moves', () => {
  const start = place(shotMatch(), { side: 0, card: 'shooter', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 });
  const fired = run(start, 6)[6] as SimState;
  const moved = { ...fired, units: fired.units.map((unit) => (unit.id === 7 ? { ...unit, x: 6000 } : unit)) };
  const next = step(moved, []);
  expect(next.projectiles[0]).toMatchObject({ toX: 6000, toY: 8000 });
  expect(hpOf(run(next, 4)[4], 7)).toBe(450);
});

test('a projectile whose target fell lands where the target was last, hitting no one without splash', () => {
  const start = place(shotMatch(), { side: 0, card: 'shooter', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 }, { side: 1, card: 'walker', x: 6000, y: 8000, deployTicks: 20 });
  const fired = run(start, 6)[6] as SimState;
  const gone = { ...fired, units: fired.units.filter((unit) => unit.id !== 7) };
  const states = run(gone, 4);
  expect(states[3]?.projectiles).toHaveLength(1);
  expect(states[4]?.projectiles).toEqual([]);
  expect(hpOf(states[4], 8)).toBe(500);
});

test('a splash hits every enemy its filter reaches in the circle, towers too, but no friend and no flyer', () => {
  // The lobber goes for the walker at (5000, 8000). Within 1000 of it: another enemy walker, a friendly
  // walker and an enemy flyer, which a `ground` filter can't reach.
  const start = place(
    shotMatch(),
    { side: 0, card: 'lobber', x: 5000, y: 6000 },
    { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 },
    { side: 1, card: 'walker', x: 6000, y: 8000, deployTicks: 20 },
    { side: 0, card: 'walker', x: 4000, y: 8000, deployTicks: 20 },
    { side: 1, card: 'flyer', x: 5000, y: 8500, deployTicks: 20 },
  );
  const states = run(start, 10);
  expect(states[10]?.splashes).toEqual([{ side: 0, x: 5000, y: 8000, radius: 1000 }]);
  expect([7, 8, 9, 10].map((id) => hpOf(states[10], id))).toEqual([450, 450, 500, 300]);
  expect(run(states[10] as SimState, 1)[1]?.splashes).toEqual([]);
});

test('a splash that lands where its target fell still hits whatever is there', () => {
  const start = place(shotMatch(), { side: 0, card: 'lobber', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 }, { side: 1, card: 'walker', x: 6000, y: 8000, deployTicks: 20 });
  const fired = run(start, 6)[6] as SimState;
  const gone = { ...fired, units: fired.units.filter((unit) => unit.id !== 7) };
  expect(hpOf(run(gone, 4)[4], 8)).toBe(450);
});

test('a melee splash lands at once around its target', () => {
  const start = place(shotMatch(), { side: 0, card: 'cleaver', x: 5000, y: 7100 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 }, { side: 1, card: 'walker', x: 5700, y: 8600, deployTicks: 20 });
  const states = run(start, 6);
  expect(states[6]?.projectiles).toEqual([]);
  expect([7, 8].map((id) => hpOf(states[6], id))).toEqual([450, 450]);
});

test('a splash hits an enemy tower its circle touches, at full damage', () => {
  // Side 0's lobber, on the left bridge, shells a side 1 walker 800 short of side 1's left Outpost
  // (1000–3000 × 14000–16000), so the 1000 splash reaches the footprint too.
  const start = place(shotMatch(), { side: 0, card: 'lobber', x: 2000, y: 10_500 }, { side: 1, card: 'walker', x: 2000, y: 13_200, deployTicks: 20 });
  const states = run(start, 12);
  const landed = states.findIndex((state) => state.splashes.length > 0);
  expect(states[landed]?.towers[4]?.hp).toBe(200 - 50);
});

test('a tower with a projectile speed fires shots that land later', () => {
  const start = place(shotMatch(1000), { side: 1, card: 'walker', x: 2000, y: 7000, deployTicks: 20 });
  const states = run(start, 10);
  // Locked on at tick 1, it fires at tick 6 from its center (2000, 5000), 2000 from the walker's.
  expect(states[6]?.projectiles[0]).toMatchObject({ side: 0, x: 2000, y: 5000, targetId: 6, splash: 0, targets: 'air' });
  expect(hpOf(states[7], 6)).toBe(500);
  expect(hpOf(states[8], 6)).toBe(490);
});

test('a match refuses a negative splash or projectile speed; a projectile outside the arena breaks an invariant', () => {
  const shooter = CARDS.shooter;
  if (shooter?.type !== 'troop') {
    throw new Error('the shooter is a troop');
  }
  const withUnit = (unit: UnitStats) => createMatch({ ...matchSetup(5), cards: { ...CARDS, shooter: { ...shooter, unit } }, decks: [DECK, DECK] });
  expect(() => withUnit({ ...shooter.unit, splash: -1 })).toThrow(/shooter splash must be an integer ≥ 0, got -1/);
  expect(() => withUnit({ ...shooter.unit, projectileSpeed: -5 })).toThrow(/shooter projectileSpeed must be an integer ≥ 0, got -5/);
  const fired = run(place(shotMatch(), { side: 0, card: 'shooter', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8000, deployTicks: 20 }), 6)[6] as SimState;
  const lost = { ...fired, projectiles: fired.projectiles.map((shot) => ({ ...shot, x: -1 })) };
  expect(checkInvariants(lost)).toEqual(['projectile 8 at (-1, 6000) toward (5000, 8000) is outside the arena']);
});
