import { expect, test } from 'vitest';
import type { SimState, Unit } from '../src/index.ts';
import { place, runChecked, walkMatch } from './fixtures.ts';

// The fixture arena: the river at y 9000–11000, bridges at x 1000–3000 (left) and 7000–9000 (right).
// Nothing deals damage, so units only walk and lock on; an archer in range of its target stands still. `runChecked` fails any tick where a
// unit's center is in the river off a bridge.
const START = walkMatch(5);

function unit(state: SimState | undefined, id: number): Unit | undefined {
  return state?.units.find((candidate) => candidate.id === id);
}

test.each([
  // A side-0 walker on side 1's bank, off the lanes, sees a side-1 archer on the left bridge, past the
  // river's middle. The straight line between them crosses the water.
  { name: 'from the far bank', chaser: { side: 0, x: 4500, y: 11_050 }, quarry: { side: 1, x: 1500, y: 10_100 }, bridge: [1000, 3000] },
  // The mirror image: side 1 on side 0's bank, the quarry on the right bridge.
  { name: 'from the near bank', chaser: { side: 1, x: 5500, y: 8950 }, quarry: { side: 0, x: 8500, y: 9900 }, bridge: [7000, 9000] },
] as const)('$name, a unit walks to an enemy on a bridge over that bridge, not through the water', ({ chaser, quarry, bridge }) => {
  const first = START.nextId;
  const start = place(START, { card: 'walker', ...chaser }, { card: 'archer', ...quarry });
  const states = runChecked(start, 80);
  const path = states.flatMap((state) => unit(state, first) ?? []);
  expect(path).toHaveLength(states.length);
  const inRiver = path.filter((u) => u.y >= 9000 && u.y < 11_000);
  expect(inRiver.length).toBeGreaterThan(0);
  expect(inRiver.every((u) => u.x >= bridge[0] && u.x <= bridge[1])).toBe(true);
  // It gets there: the archer never moved, and each is locked on to the other.
  const last = states.at(-1);
  expect(unit(last, first + 1)).toMatchObject({ x: quarry.x, y: quarry.y });
  expect(unit(last, first)?.targetId).toBe(first + 1);
  expect(unit(last, first + 1)?.targetId).toBe(first);
});

test('a unit on the bridge its enemy stands on walks straight at it', () => {
  const first = START.nextId;
  // A side-1 archer at the bridge's far end would stand still and shoot; a walker at the other end comes to it.
  const start = place(START, { card: 'walker', side: 0, x: 1600, y: 9100 }, { card: 'archer', side: 1, x: 2400, y: 10_900, deployTicks: 20 });
  const states = runChecked(start, 20);
  const [a, b] = [unit(states[0], first), unit(states[1], first)];
  // Straight at the quarry: x grows as y does, rather than first crossing to the far bank.
  expect(b && a && b.x - a.x).toBeGreaterThan(0);
  expect(b && a && b.y - a.y).toBeGreaterThan(0);
});
