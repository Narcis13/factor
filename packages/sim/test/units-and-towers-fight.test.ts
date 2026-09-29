import { expect, test } from 'vitest';
import { checkInvariants, createMatch, step, type SimState, type Unit } from '../src/index.ts';
import { idle, matchSetup, TOWER_STATS, TROOP_DECK, TROOPS, troopMatch } from './fixtures.ts';

// Fixture numbers: towers hit for 10 every 10 ticks, 5 ticks after locking on, 2 tiles past their
// footprint. A walker (hp 500, radius 500, melee) hits for 50 and an archer (hp 200, radius 400, range 3000)
// for 20, both on the same timing. Side 0's left Outpost (id 1) stands on 1000–3000 × 4000–6000.

/** Troops fight at full strength; towers lock on but deal nothing, so they don't disturb a duel. */
function duelMatch(): SimState {
  const towerStats = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  return createMatch({ ...matchSetup(5), towerStats, cards: TROOPS, decks: [TROOP_DECK, TROOP_DECK] });
}

type Placement = Pick<Unit, 'side' | 'card' | 'x' | 'y'> & Partial<Unit>;

/** Puts units straight onto the field, ready to act, with ids from `nextId`. */
function place(state: SimState, ...placements: Placement[]): SimState {
  const units = placements.map((placement, i): Unit => {
    const card = state.cards[placement.card];
    const hp = card?.type === 'troop' ? card.unit.hp : 1;
    return { id: state.nextId + i, hp, maxHp: hp, deployTicks: 0, targetId: null, cooldown: 0, ...placement };
  });
  return { ...state, units: [...state.units, ...units], nextId: state.nextId + units.length };
}

/** Steps with no commands, checking invariants every tick; returns every state, the first one included. */
function run(state: SimState, ticks: number): SimState[] {
  const states = [state];
  for (let i = 0; i < ticks; i++) {
    const next = step(states[states.length - 1] ?? state, []);
    expect(checkInvariants(next)).toEqual([]);
    states.push(next);
  }
  return states;
}

const hpOf = (state: SimState | undefined, id: number) => state?.units.find((unit) => unit.id === id)?.hp;
const towerHp = (state: SimState | undefined, id: number) => state?.towers.find((tower) => tower.id === id)?.hp;

test('a tower locks on to an enemy in range, hits 5 ticks later, then every 10', () => {
  // Still deploying, so it stands in range: its edge is 500 from the footprint.
  const start = place(troopMatch(5), { side: 1, card: 'walker', x: 2000, y: 7000, deployTicks: 20 });
  const states = run(start, 20);
  expect(states[1]?.towers[1]).toMatchObject({ targetId: 6, cooldown: 5 });
  const hits = states.flatMap((state, tick) => (hpOf(state, 6) !== hpOf(states[tick - 1], 6) && tick > 0 ? [tick] : []));
  expect(hits).toEqual([6, 16]);
  expect(hpOf(states[20], 6)).toBe(480);
});

test('a tower takes the nearest enemy, and stays locked on when a nearer one arrives', () => {
  const start = place(
    troopMatch(5),
    { side: 1, card: 'walker', x: 2000, y: 8000, deployTicks: 20 },
    { side: 1, card: 'walker', x: 2000, y: 7500, deployTicks: 20 },
  );
  expect(run(start, 1)[1]?.towers[1]?.targetId).toBe(7);
  const locked = { ...run(start, 3)[3] } as SimState;
  const arrival = place(locked, { side: 1, card: 'walker', x: 2000, y: 7000, deployTicks: 20 });
  expect(run(arrival, 5)[5]?.towers[1]?.targetId).toBe(7);
});

test('a tower retargets when its target leaves range', () => {
  const start = place(troopMatch(5), { side: 1, card: 'walker', x: 2000, y: 7000, deployTicks: 20 });
  const locked = run(start, 2)[2] as SimState;
  const moved = { ...locked, units: locked.units.map((unit) => ({ ...unit, y: 8600, x: 5000 })) };
  // At (5000, 8600) its edge is 2900 from the footprint: out of range.
  expect(run(moved, 1)[1]?.towers[1]).toMatchObject({ targetId: null });
});

test('two walkers face to face hit each other on the same ticks and fall together', () => {
  const start = place(duelMatch(), { side: 0, card: 'walker', x: 5000, y: 7000 }, { side: 1, card: 'walker', x: 5000, y: 8000 });
  const states = run(start, 100);
  // Locked on at tick 1, hits from tick 6 every 10: the 10th hit (500 damage) lands at tick 96.
  expect(hpOf(states[95], 6)).toBe(50);
  expect(hpOf(states[95], 7)).toBe(50);
  expect(states[96]?.units).toEqual([]);
});

test('a unit killed this tick still lands its own hit', () => {
  const start = place(duelMatch(), { side: 0, card: 'walker', x: 5000, y: 7000 }, { side: 1, card: 'archer', x: 5000, y: 7900 });
  const states = run(start, 60);
  // The archer (200 hp) takes its 4th walker hit at tick 36, when its own 4th hit lands too.
  expect(hpOf(states[35], 7)).toBe(50);
  expect(hpOf(states[36], 7)).toBeUndefined();
  expect(hpOf(states[36], 6)).toBe(500 - 4 * 20);
  expect(hpOf(states[60], 6)).toBe(420);
});

test('a unit goes for an enemy unit in sight before the tower; a buildings-only unit ignores it', () => {
  // Side 1's walker (still deploying) is 4000 from the archer edge to edge: in sight, 1000 out of range.
  const start = place(duelMatch(), { side: 0, card: 'archer', x: 5000, y: 3500 }, { side: 1, card: 'walker', x: 5000, y: 8400, deployTicks: 20 });
  const states = run(start, 30);
  // It walks 40 a tick toward the walker, not its lane, and locks on once 1000 closer.
  expect(states[1]?.units[0]).toMatchObject({ x: 5000, y: 3540, targetId: null });
  expect(states[30]?.units[0]?.targetId).toBe(7);
  const buildings: SimState = { ...start, cards: { ...start.cards, archer: { cost: 1, type: 'troop', unit: { ...archerUnit(), targets: 'buildings' } } } };
  const ignoring = run(buildings, 30).at(-1);
  expect(ignoring?.units[0]?.targetId).not.toBe(7);
  expect(hpOf(ignoring, 7)).toBe(500);
});

function archerUnit() {
  const card = TROOPS.archer;
  if (card?.type !== 'troop') {
    throw new Error('archer is a troop');
  }
  return card.unit;
}

test('a fallen Outpost earns its destroyer a star, stays at 0 hp, and stops shooting', () => {
  const start = place(troopMatch(5), { side: 1, card: 'walker', x: 2000, y: 6500 });
  const states = run(start, 60);
  // The walker touches the footprint at once: hits land at 6, 16, 26, 36 (200 hp).
  expect(towerHp(states[35], 1)).toBe(50);
  expect(towerHp(states[36], 1)).toBe(0);
  expect(states[36]?.stars).toEqual([0, 1]);
  expect(states[60]?.towers[1]).toMatchObject({ hp: 0 });
  expect(states[60]?.stars).toEqual([0, 1]);
  expect(states[60]?.result).toBeNull();
  // Its last shot came before it fell; from then on the walker takes nothing from it.
  expect(hpOf(states[60], 6)).toBe(hpOf(states[36], 6));
});

test('a fallen Keep brings its destroyer to 3 stars and ends the match at once', () => {
  const start = place(troopMatch(5), { side: 1, card: 'walker', x: 5000, y: 3500 });
  const states = run(start, 56);
  // The Keep (300 hp) falls on the walker's 6th hit, at tick 56, well inside regulation.
  const end = states.findIndex((state) => state.result !== null);
  expect(end).toBe(56);
  expect(states[end]).toMatchObject({ stars: [0, 3], result: { winner: 1 } });
  expect(() => step(states[end] as SimState, [])).toThrow(/already ended/);
});

test('both Keeps falling on the same tick is a draw', () => {
  const start = place(troopMatch(5), { side: 1, card: 'walker', x: 5000, y: 3500 }, { side: 0, card: 'walker', x: 5000, y: 16_500 });
  const end = run(start, 56)[56];
  expect(end).toMatchObject({ stars: [3, 3], result: { winner: null } });
});

test('with no one fighting, the match still runs to the timer', () => {
  expect(idle(troopMatch(5), 6000).result).toEqual({ winner: null });
});
