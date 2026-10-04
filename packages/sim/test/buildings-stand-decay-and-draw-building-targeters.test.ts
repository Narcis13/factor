import { expect, test } from 'vitest';
import { checkInvariants, createMatch, step, type CardId, type CardStats, type Command, type SimState, type Unit } from '../src/index.ts';
import { matchSetup, place, runChecked as run, TOWER_STATS, TROOPS } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000, bridges at x 1000–3000 and 7000–9000.
// Side 0's left Outpost (id 1) stands on 1000–3000 × 4000–6000. Towers hold ids 0–5 and deal nothing here.

const POST = { hp: 200, speed: 0, radius: 500, mass: 1, range: 2000, sight: 2000, targets: 'ground', layer: 'ground', count: 1 } as const;
const BRUTE = TROOPS.walker?.type === 'troop' ? TROOPS.walker.unit : undefined;

/** `post`: a building that lasts 100 ticks and hits for 10 within 2 tiles. `brute`: a walker that only targets buildings. */
const CARDS: Record<CardId, CardStats> = {
  ...TROOPS,
  post: { cost: 1, type: 'building', lifetimeTicks: 100, spawn: null, unit: { ...POST, damage: 10, splash: 0, projectileSpeed: 0, hitTicks: 10, firstHitTicks: 5 } },
  ...(BRUTE === undefined ? {} : { brute: { cost: 1, type: 'troop', unit: { ...BRUTE, targets: 'buildings' } } }),
};
const DECK = ['post', 'walker', 'brute', 'archer', 'post', 'walker', 'brute', 'archer'];

/** Both sides hold post, walker, brute and archer, in that order, with the same four queued. */
function buildingMatch(): SimState {
  const harmless = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  const state = createMatch({ ...matchSetup(5), towerStats: harmless, cards: CARDS, decks: [DECK, DECK] });
  const deal = (side: 0 | 1) => ({ ...state.players[side], hand: DECK.slice(0, 4), queue: DECK.slice(4) });
  return { ...state, players: [deal(0), deal(1)] };
}

function unit(state: SimState | undefined, id: number): Unit {
  const found = state?.units.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no unit ${String(id)}`);
  }
  return found;
}

function playPost(state: SimState, side: 0 | 1, x: number, y: number): Command {
  return { tick: state.tick, side, handSlot: state.players[side].hand.indexOf('post'), x, y };
}

test('a building stands where it was played, waits out its deploy delay, then loses its hp evenly over its lifetime', () => {
  const start = buildingMatch();
  const states = [start, ...run(step(start, [playPost(start, 0, 5000, 7000)]), 130)].slice(1);
  expect(states[0]?.rejected).toEqual([]);
  const hp = states.map((state) => state.units.find((u) => u.id === 6)?.hp);
  // Deployed in the state for tick 1; it acts from the one for tick 21, losing 2 a tick from then.
  expect(hp.slice(0, 20).every((value) => value === 200)).toBe(true);
  expect(hp[20]).toBe(198);
  expect(hp[21]).toBe(196);
  // Its 100th tick of decay takes the last 2: gone from the state for tick 120.
  expect(hp[118]).toBe(2);
  expect(hp[119]).toBeUndefined();
  for (const state of states.slice(0, 119)) {
    expect(unit(state, 6)).toMatchObject({ x: 5000, y: 7000 });
  }
});

test('a building never moves: it shoots an enemy in range and waits for one out of range', () => {
  const start = place(buildingMatch(), { side: 0, card: 'post', x: 5000, y: 7000 }, { side: 1, card: 'walker', x: 5000, y: 8800, deployTicks: 20 }, { side: 1, card: 'walker', x: 8000, y: 7000, deployTicks: 20 });
  const states = run(start, 20);
  // The first walker is 800 away edge to edge, in range; the second 2000, at its range's edge... and
  // farther than the first, so the post takes the first.
  expect(unit(states[1], 6)).toMatchObject({ x: 5000, y: 7000, targetId: 7 });
  expect(unit(states[20], 7).hp).toBeLessThan(500);
  const alone = run(place(buildingMatch(), { side: 0, card: 'post', x: 5000, y: 7000 }, { side: 1, card: 'walker', x: 5000, y: 12_000, deployTicks: 20 }), 15);
  expect(alone.every((state) => unit(state, 6).x === 5000 && unit(state, 6).y === 7000 && unit(state, 6).targetId === null)).toBe(true);
});

test('a buildings-only unit goes for an enemy building in sight; other units can hit buildings too', () => {
  // Side 1's brute sees side 0's post 2000 off and Outpost 1 farther: it takes the post.
  const brute = run(place(buildingMatch(), { side: 0, card: 'post', x: 5000, y: 7000, deployTicks: 20 }, { side: 1, card: 'brute', x: 5000, y: 10_000 }), 60);
  expect(brute.slice(1).some((state) => unit(state, 7).targetId === 6)).toBe(true);
  // It hits the post down before the post's own lifetime runs out.
  expect(brute.at(-1)?.units.some((u) => u.id === 6)).toBe(false);
  const walker = run(place(buildingMatch(), { side: 0, card: 'post', x: 5000, y: 7000, deployTicks: 20 }, { side: 1, card: 'walker', x: 5000, y: 10_000 }), 60);
  expect(walker.slice(1).some((state) => unit(state, 7).targetId === 6)).toBe(true);
});

test('ground units walk around a friendly building in their way, and get past it', () => {
  // A post right in the walker's lane, between it and the left bridge.
  const states = run(place(buildingMatch(), { side: 0, card: 'post', x: 2000, y: 7500, deployTicks: 20 }, { side: 0, card: 'walker', x: 2000, y: 6500 }), 200);
  for (const state of states.filter((s) => s.units.some((u) => u.id === 6))) {
    const [post, walker] = [unit(state, 6), unit(state, 7)];
    const gap = Math.sqrt((post.x - walker.x) * (post.x - walker.x) + (post.y - walker.y) * (post.y - walker.y));
    expect(gap).toBeGreaterThanOrEqual(999);
  }
  // Past the post while it still stands, then across the river.
  const past = states.find((state) => unit(state, 7).y > 8500);
  expect(past?.units.some((u) => u.id === 6)).toBe(true);
  expect(states.some((state) => unit(state, 7).y > 11_000)).toBe(true);
});

test('a building is refused on a tower, on another building, and hanging over the arena’s edge', () => {
  const start = buildingMatch();
  const placed = step(start, [playPost(start, 0, 5000, 7000)]);
  const cases: [number, number, string | null][] = [
    [2000, 6400, 'occupied'], // its circle reaches the Outpost's footprint (y ≤ 6000)
    [5900, 7000, 'occupied'], // 900 from the other post: the circles overlap
    [6000, 7000, null], // 1000 away: they touch
    [400, 7000, 'out-of-bounds'], // its circle crosses x = 0
    [500, 7000, null],
  ];
  for (const [x, y, reason] of cases) {
    const command = playPost(placed, 0, x, y);
    expect(step(placed, [command]).rejected).toEqual(reason === null ? [] : [{ command, reason }]);
  }
  // A troop may still be played on a building: the push moves it off.
  const walkerSlot = placed.players[0].hand.indexOf('walker');
  const crowded = step(placed, [{ tick: placed.tick, side: 0, handSlot: walkerSlot, x: 5000, y: 7000 }]);
  expect(crowded.rejected).toEqual([]);
  expect(checkInvariants(crowded)).toEqual([]);
  const walker = crowded.units.find((u) => u.card === 'walker');
  expect(walker && Math.abs(walker.x - 5000) + Math.abs(walker.y - 7000)).toBeGreaterThanOrEqual(1000);
});

test('a match refuses a building that could move, fly or come in numbers', () => {
  const post = CARDS.post;
  if (post?.type !== 'building') {
    throw new Error('the post is a building');
  }
  const withUnit = (patch: object) => createMatch({ ...matchSetup(5), cards: { ...CARDS, post: { ...post, unit: { ...post.unit, ...patch } } }, decks: [DECK, DECK] });
  expect(() => withUnit({ speed: 10 })).toThrow(/post is a building: speed 0, layer ground and count 1, got 10, ground, 1/);
  expect(() => withUnit({ layer: 'air' })).toThrow(/post is a building/);
  expect(() => withUnit({ count: 2 })).toThrow(/post is a building/);
  expect(() => createMatch({ ...matchSetup(5), cards: { ...CARDS, post: { ...post, lifetimeTicks: 0 } }, decks: [DECK, DECK] })).toThrow(/post lifetimeTicks must be an integer ≥ 1, got 0/);
});
