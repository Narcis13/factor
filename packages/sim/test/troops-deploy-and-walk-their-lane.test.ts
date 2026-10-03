import { expect, test } from 'vitest';
import { checkInvariants, deployZone, hashState, step, type Command, type SimState, type Unit } from '../src/index.ts';
import { ARENA, idle, newMatch, troopMatch, walkMatch } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000, bridges at x 1000–3000 (left) and
// 7000–9000 (right). Side 1's left Outpost stands on 1000–3000 × 14000–16000.
// Nothing deals damage here, so these tests see movement alone; fighting has its own tests.
const START = walkMatch(5);

function play(state: SimState, side: 0 | 1, x: number, y: number, handSlot = 0): Command {
  return { tick: state.tick, side, handSlot, x, y };
}

/** The unit with this id, or a failed test. */
function unit(state: SimState, id: number): Unit {
  const found = state.units.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no unit ${String(id)} at tick ${String(state.tick)}`);
  }
  return found;
}

/** From a unit's center to side 1's left Outpost footprint. */
function distanceToFootprint({ x, y }: Unit): number {
  const dx = Math.max(1000 - x, 0, x - 3000);
  const dy = Math.max(14_000 - y, 0, y - 16_000);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Steps with no commands, collecting every state, and checks invariants on each. */
function run(state: SimState, ticks: number): SimState[] {
  const states: SimState[] = [];
  let current = state;
  for (let i = 0; i < ticks; i++) {
    current = step(current, []);
    expect(checkInvariants(current)).toEqual([]);
    states.push(current);
  }
  return states;
}

test('a troop play puts one unit where it was aimed, at full hp, waiting out its deploy delay', () => {
  const slot = START.players[0].hand.indexOf('walker');
  const after = step(START, [play(START, 0, 2000, 7000, slot)]);
  expect(after.rejected).toEqual([]);
  // Towers hold ids 0–5, so the first unit is 6. Its delay already counted down once this tick.
  expect(after.units).toEqual([{
    id: 6,
    side: 0,
    card: 'walker',
    x: 2000,
    y: 7000,
    hp: 500,
    maxHp: 500,
    deployTicks: 19,
    targetId: null,
    cooldown: 0,
  }]);
  expect(after.nextId).toBe(7);
  expect(after.players[0].queue.at(-1)).toBe('walker');
});

test('units share one id sequence with the towers, side 0 first within a tick', () => {
  const after = step(START, [play(START, 1, 5000, 15_000), play(START, 0, 5000, 5000)]);
  expect(after.units.map(({ id, side }) => ({ id, side }))).toEqual([
    { id: 6, side: 0 },
    { id: 7, side: 1 },
  ]);
  const later = step(after, [play(after, 0, 5000, 5000, 1)]);
  expect(later.units.map((u) => u.id)).toEqual([6, 7, 8]);
});

test('a troop deploys only on its own half; the river and the enemy half are rejected', () => {
  expect(deployZone(ARENA, 0)).toEqual({ x: 0, y: 0, width: 10_000, height: 9000 });
  expect(deployZone(ARENA, 1)).toEqual({ x: 0, y: 11_000, width: 10_000, height: 9000 });
  const cases: [0 | 1, number, number, 'ok' | 'outside-deploy-zone'][] = [
    [0, 0, 0, 'ok'],
    [0, 9999, 8999, 'ok'],
    [0, 2000, 9000, 'outside-deploy-zone'],
    [0, 2000, 15_000, 'outside-deploy-zone'],
    [1, 2000, 11_000, 'ok'],
    [1, 9999, 19_999, 'ok'],
    [1, 2000, 10_999, 'outside-deploy-zone'],
    [1, 2000, 4000, 'outside-deploy-zone'],
  ];
  for (const [side, x, y, expected] of cases) {
    const command = play(START, side, x, y);
    const after = step(START, [command]);
    if (expected === 'ok') {
      expect(after.rejected).toEqual([]);
      expect(after.units).toHaveLength(1);
    } else {
      expect(after.rejected).toEqual([{ command, reason: expected }]);
      expect(after.units).toEqual([]);
      expect(after.players).toEqual(step(START, []).players);
    }
  }
});

test('a troop is refused on a standing tower, edges included, but may stand on its rubble', () => {
  // Side 0's left Outpost (id 1) stands on 1000–3000 × 4000–6000; its Keep on 4000–6000 × 1000–3000.
  for (const [x, y] of [[2000, 5000], [1000, 4000], [2999, 5999], [5000, 2000]] as const) {
    const command = play(START, 0, x, y);
    expect(step(START, [command]).rejected).toEqual([{ command, reason: 'occupied' }]);
  }
  expect(step(START, [play(START, 0, 2000, 6000)]).rejected).toEqual([]);
  const fallen: SimState = { ...START, towers: START.towers.map((tower) => (tower.id === 1 ? { ...tower, hp: 0 } : tower)) };
  const after = step(fallen, [play(fallen, 0, 2000, 5000)]);
  expect(after.rejected).toEqual([]);
  expect(after.units).toHaveLength(1);
});

test('a spell can be aimed anywhere, on a tower too, and puts nothing on the field', () => {
  // Full energy, so any hand slot can be played.
  const spells = idle(newMatch(5), 600);
  const after = step(spells, [play(spells, 0, 5000, 18_000, 3), play(spells, 1, 5000, 1000, 3)]);
  expect(after.rejected).toEqual([]);
  expect(after.units).toEqual([]);
});

test('an aim that is not a whole milli-tile is out of bounds', () => {
  const command = play(START, 0, 4001 / 2, 4000);
  expect(step(START, [command]).rejected).toEqual([{ command, reason: 'out-of-bounds' }]);
});

test('a unit stands still for 1 s after it appears, then walks', () => {
  const states = [step(START, [play(START, 0, 2000, 7000)]), ...run(step(START, [play(START, 0, 2000, 7000)]), 25)];
  // It appears in the state for tick 1; states 1–20 hold it still; it moves in the one for tick 21.
  for (const state of states.filter((s) => s.tick <= 20)) {
    expect(unit(state, 6)).toMatchObject({ x: 2000, y: 7000, deployTicks: 20 - state.tick });
  }
  const moved = states.find((s) => s.tick === 21);
  expect(moved && unit(moved, 6).y).toBeGreaterThan(7000);
});

test('a melee unit walks up its lane, crosses the bridge, and stops touching the enemy Outpost', () => {
  const walker = step(START, [play(START, 0, 2000, 7000, START.players[0].hand.indexOf('walker'))]);
  const states = run(walker, 300);
  const path = states.map((s) => unit(s, 6));
  // Straight up at 50 per tick: 6500 milli-tiles from y 7000 to 13500 (the footprint's edge minus its radius).
  const arrival = states.findIndex((s) => unit(s, 6).y === 13_500);
  // It first moves in the state for tick 21, so its 130th step lands in the one for tick 150.
  expect(states[arrival]?.tick).toBe(20 + 130);
  expect(path.every((u) => u.x === 2000)).toBe(true);
  expect(path.slice(arrival).every((u) => u.y === 13_500)).toBe(true);
});

test('a unit off its lane heads for its bridge, never touching the river beside it', () => {
  const walker = step(START, [play(START, 0, 4900, 7000, START.players[0].hand.indexOf('walker'))]);
  const path = run(walker, 400).map((s) => unit(s, 6));
  // x 4900 is the left lane; the bridge admits its center in x 1500–2500 (1000–3000 less its radius).
  const inRiver = path.filter((u) => u.y >= 9000 && u.y < 11_000);
  expect(inRiver.length).toBeGreaterThan(0);
  expect(inRiver.every((u) => u.x === 2500)).toBe(true);
  // Across the river it heads for the Outpost's center, and stops with its edge on the footprint's.
  const last = path.at(-1);
  expect(last && distanceToFootprint(last)).toBeGreaterThanOrEqual(499);
  expect(last && distanceToFootprint(last)).toBeLessThanOrEqual(500);
  expect(path.at(-2)).toMatchObject({ x: last?.x, y: last?.y });
});

test('the middle column belongs to the right lane', () => {
  const walker = step(START, [play(START, 0, 5000, 8000, START.players[0].hand.indexOf('walker'))]);
  const path = run(walker, 200).map((s) => unit(s, 6));
  expect(path.some((u) => u.y === 9000 && u.x === 7500)).toBe(true);
});

test('a ranged unit stops as soon as it is within range, even on the bridge', () => {
  const archer = step(START, [play(START, 0, 2000, 7000, START.players[0].hand.indexOf('archer'))]);
  const last = run(archer, 400).at(-1);
  // 3400 from the footprint (range + radius) is y 10600, on the bridge: it stops there and locks on.
  expect(last && unit(last, 6)).toMatchObject({ x: 2000, y: 10_600, targetId: 4 });
});

test('both sides walk and fight the mirror image of each other, tick for tick, and die on the same tick', () => {
  const fighting = troopMatch(5);
  const both = step(fighting, [play(fighting, 0, 4200, 7500), play(fighting, 1, 4200, 20_000 - 7500)]);
  expect(unit(both, 6).card).toBe(unit(both, 7).card);
  let died = false;
  for (const state of run(both, 800)) {
    const [mine, theirs] = [state.units.find((u) => u.id === 6), state.units.find((u) => u.id === 7)];
    if (mine === undefined || theirs === undefined) {
      expect(mine).toBe(theirs);
      died = true;
      continue;
    }
    expect(theirs.x).toBe(mine.x);
    expect(theirs.y).toBe(20_000 - mine.y);
    expect(theirs.hp).toBe(mine.hp);
  }
  expect(died).toBe(true);
});

test('a match full of troops plays until a Keep falls, with invariants holding every tick, the same every time', () => {
  const playOut = () => {
    let state = troopMatch(70);
    let deaths = 0;
    let turn = 0;
    while (state.result === null) {
      const commands: Command[] = [];
      if (state.tick % 30 === 0) {
        turn++;
        const x = (turn * 3700) % 10_000;
        commands.push(play(state, 0, x, (turn * 1300) % 9000, turn % 4));
        commands.push(play(state, 1, 10_000 - 1 - x, 11_000 + ((turn * 2900) % 9000), (turn + 1) % 4));
      }
      const next = step(state, commands);
      deaths += state.units.length + (next.nextId - state.nextId) - next.units.length;
      state = next;
      expect(checkInvariants(state)).toEqual([]);
    }
    return { state, deaths };
  };
  const first = playOut();
  // The fixture's towers are weak, so a Keep falls long before the timer: side 0 takes all three at tick 1790, side 1 two Outposts.
  expect(first.state.result).toEqual({ winner: 0 });
  expect(first.state.tick).toBe(1790);
  expect(first.state.stars).toEqual([3, 2]);
  expect(first.deaths).toBeGreaterThan(10);
  expect(hashState(playOut().state)).toBe(hashState(first.state));
});

test('units never act after the match; stepping past the end still throws', () => {
  const ended = idle(START, 6000);
  expect(ended.result).not.toBeNull();
  expect(() => step(ended, [])).toThrow(/already ended/);
});
