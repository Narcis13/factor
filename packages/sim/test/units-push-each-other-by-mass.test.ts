import { expect, test } from 'vitest';
import { step, type SimState, type Unit } from '../src/index.ts';
import { place, runChecked as run, walkMatch } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000, bridges at x 1000–3000 and 7000–9000.
// Side 0's left Outpost stands on 1000–3000 × 4000–6000. A walker has radius 500 and mass 5, an
// archer radius 400 and mass 3. Nothing deals damage here.
const START = walkMatch(5);

function unit(state: SimState | undefined, id: number): Unit {
  const found = state?.units.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no unit ${String(id)}`);
  }
  return found;
}

/** Edge to edge, negative while they overlap. */
function gap(a: Unit, b: Unit, reach: number): number {
  const [dx, dy] = [a.x - b.x, a.y - b.y];
  return Math.sqrt(dx * dx + dy * dy) - reach;
}

test('two overlapping units move apart along the line between them, the lighter one further', () => {
  // 500 apart with radii 500 + 400: 400 of overlap. The walker moves 3/8 of it (150), the archer 5/8
  // (250), along (300, 400) / 500.
  const start = place(START, { side: 0, card: 'walker', x: 5000, y: 7300, deployTicks: 20 }, { side: 0, card: 'archer', x: 5300, y: 7700, deployTicks: 20 });
  const after = step(start, []);
  expect(unit(after, 6)).toMatchObject({ x: 5000 - 90, y: 7300 - 120 });
  expect(unit(after, 7)).toMatchObject({ x: 5300 + 150, y: 7700 + 200 });
});

test('two units nearly in line, one behind the other, also step aside so neither blocks the other for good', () => {
  // In line along y with 500 of overlap: besides the push, each steps a quarter of the overlap aside.
  const start = place(START, { side: 0, card: 'walker', x: 5000, y: 7000, deployTicks: 20 }, { side: 1, card: 'walker', x: 5000, y: 7500, deployTicks: 20 });
  const after = step(start, []);
  expect(unit(after, 6)).toMatchObject({ x: 5000 - 125, y: 7000 - 250 });
  expect(unit(after, 7)).toMatchObject({ x: 5000 + 125, y: 7500 + 250 });
  // Off line a little, they step aside away from each other.
  const skew = place(START, { side: 0, card: 'walker', x: 5100, y: 7000, deployTicks: 20 }, { side: 1, card: 'walker', x: 5000, y: 7500, deployTicks: 20 });
  const apart = step(skew, []);
  expect(unit(apart, 6).x).toBeGreaterThan(5100);
  expect(unit(apart, 7).x).toBeLessThan(5000);
});

test('enemies push each other as friends do, diagonally too', () => {
  const start = place(START, { side: 0, card: 'walker', x: 5000, y: 7000, deployTicks: 20 }, { side: 1, card: 'walker', x: 5300, y: 7400, deployTicks: 20 });
  const after = step(start, []);
  // 500 apart, 500 of overlap: each moves 250 along (300, 400)/500.
  expect(unit(after, 6)).toMatchObject({ x: 5000 - 150, y: 7000 - 200 });
  expect(unit(after, 7)).toMatchObject({ x: 5300 + 150, y: 7400 + 200 });
});

test('two units on the same point split along x, the first toward −x', () => {
  const start = place(START, { side: 0, card: 'walker', x: 5000, y: 7000, deployTicks: 20 }, { side: 0, card: 'walker', x: 5000, y: 7000, deployTicks: 20 });
  const after = step(start, []);
  expect(unit(after, 6)).toMatchObject({ x: 4500, y: 7000 });
  expect(unit(after, 7)).toMatchObject({ x: 5500, y: 7000 });
});

test('a crowd dropped on one point spreads out until no two overlap by more than a hair', () => {
  const crowd = Array.from({ length: 8 }, () => ({ side: 0 as const, card: 'walker', x: 5000, y: 6000, deployTicks: 20 }));
  const states = run(place(START, ...crowd), 20);
  const last = states.at(-1);
  const units = last?.units ?? [];
  expect(units).toHaveLength(8);
  for (const a of units) {
    for (const b of units.filter((other) => other.id > a.id)) {
      expect(gap(a, b, 1000)).toBeGreaterThan(-20);
    }
  }
});

test('a unit pushed toward the river stops on the bank; on a bridge it stays over the bridge', () => {
  // The walker at y 8900 is pushed 300 up (and 150 aside), into the river where there is no bridge: it
  // stays on the bank.
  const bank = place(START, { side: 0, card: 'walker', x: 5000, y: 8900, deployTicks: 20 }, { side: 0, card: 'walker', x: 5000, y: 8500, deployTicks: 20 });
  expect(unit(run(bank, 1)[1], 6)).toMatchObject({ x: 4850, y: 8999 });
  // Pushed sideways off the left bridge (x 1000–3000) mid-river, it stays on the bridge's edge.
  const bridge = place(START, { side: 0, card: 'walker', x: 2900, y: 10_000, deployTicks: 20 }, { side: 0, card: 'walker', x: 2500, y: 10_000, deployTicks: 20 });
  expect(unit(run(bridge, 1)[1], 6)).toMatchObject({ x: 3000, y: 10_000 });
});

test('a unit pushed into a tower is pushed back out to touch it', () => {
  // The archer (radius 400) at (2000, 6300) overlaps the Outpost's top face (y 6000) by 100.
  const start = place(START, { side: 0, card: 'archer', x: 2000, y: 6300, deployTicks: 20 });
  expect(unit(run(start, 1)[1], 6)).toMatchObject({ x: 2000, y: 6400 });
});

test('a unit walking straight at its own Outpost goes around it instead of sticking, and crosses its bridge', () => {
  // Behind the Outpost, in line with its middle and the bridge: it slides toward the arena's middle.
  const states = run(place(START, { side: 0, card: 'walker', x: 2000, y: 3000 }), 300);
  const path = states.map((state) => unit(state, 6));
  for (const { x, y } of path) {
    const dx = Math.max(1000 - x, 0, x - 3000);
    const dy = Math.max(4000 - y, 0, y - 6000);
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(499);
  }
  expect(path.some(({ x, y }) => x === 3500 && y > 3500 && y < 6500)).toBe(true);
  expect(path.some(({ y }) => y >= 11_000)).toBe(true);
});

test('a unit going for a tower is not steered away from it, and stops touching it', () => {
  // Side 1's walker heads straight down at side 0's left Outpost and stops with its edge on the face.
  const states = run(place(START, { side: 1, card: 'walker', x: 2000, y: 8500 }), 60);
  expect(unit(states.at(-1), 6)).toMatchObject({ x: 2000, y: 6500, targetId: 1 });
});
