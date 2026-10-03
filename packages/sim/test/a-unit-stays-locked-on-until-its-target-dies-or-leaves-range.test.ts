import { expect, test } from 'vitest';
import { createMatch, type SimState, type Unit } from '../src/index.ts';
import { matchSetup, place, runChecked as run, TOWER_STATS, TROOP_DECK, TROOPS } from './fixtures.ts';

// An archer (radius 400, range 3000) against walkers (radius 500) that are still deploying, so they
// stand where they are put. Towers deal nothing. Towers hold ids 0–5.

function quietMatch(): SimState {
  const towerStats = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  return createMatch({ ...matchSetup(5), towerStats, cards: TROOPS, decks: [TROOP_DECK, TROOP_DECK] });
}

function unit(state: SimState | undefined, id: number): Unit {
  const found = state?.units.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no unit ${String(id)}`);
  }
  return found;
}

/** The archer (6) locked on to the walker at (5000, 8500) (7), 1600 away edge to edge. */
function locked(): SimState {
  const start = place(quietMatch(), { side: 0, card: 'archer', x: 5000, y: 6000 }, { side: 1, card: 'walker', x: 5000, y: 8500, deployTicks: 20 });
  const state = run(start, 2)[2] as SimState;
  expect(unit(state, 6).targetId).toBe(7);
  return state;
}

test('a unit attacking stays locked on when a nearer enemy arrives', () => {
  // A second walker 300 away edge to edge: nearer, but the archer keeps shooting the first.
  const crowded = place(locked(), { side: 1, card: 'walker', x: 5000, y: 7200, deployTicks: 20 });
  const states = run(crowded, 15);
  expect(states.every((state) => unit(state, 6).targetId === 7)).toBe(true);
  expect(unit(states[15], 7).hp).toBeLessThan(500);
  expect(unit(states[15], 8).hp).toBe(500);
});

test('it retargets, to the nearest enemy in sight, once its target dies', () => {
  const crowded = place(locked(), { side: 1, card: 'walker', x: 5000, y: 7200, deployTicks: 20 });
  const gone = { ...crowded, units: crowded.units.filter((u) => u.id !== 7) };
  expect(unit(run(gone, 1)[1], 6).targetId).toBe(8);
});

test('it retargets once its target leaves range', () => {
  const crowded = place(locked(), { side: 1, card: 'walker', x: 5000, y: 7200, deployTicks: 20 });
  // The first walker now stands 5100 off edge to edge: out of range (3000) and out of sight (4000).
  const away = { ...crowded, units: crowded.units.map((u) => (u.id === 7 ? { ...u, y: 12_000 } : u)) };
  expect(unit(run(away, 1)[1], 6).targetId).toBe(8);
});
