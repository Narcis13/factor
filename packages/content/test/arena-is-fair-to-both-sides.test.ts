import { MILLI_PER_TILE } from '@factor/sim';
import { expect, test } from 'vitest';
import { ARENA, type Lane, type TowerSite } from '../src/index.ts';

const MID_X = ARENA.width / 2;
const MID_Y = ARENA.height / 2;
const { river } = ARENA;

function laneOf(x: number): Lane {
  return x < MID_X ? 'left' : 'right';
}

function numbersIn(value: unknown): unknown[] {
  if (typeof value === 'number') {
    return [value];
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(numbersIn);
  }
  return [];
}

function edges(site: TowerSite) {
  const half = site.size / 2;
  return { left: site.x - half, right: site.x + half, low: site.y - half, high: site.y + half };
}

test('every measurement is a whole number of milli-tiles', () => {
  for (const value of numbersIn(ARENA)) {
    expect(Number.isSafeInteger(value)).toBe(true);
  }
});

test('the river crosses the full width at the middle', () => {
  expect(river.x).toBe(0);
  expect(river.width).toBe(ARENA.width);
  expect(river.y + river.height / 2).toBe(MID_Y);
});

test('each lane has one bridge, spanning the river inside that lane', () => {
  expect(ARENA.bridges.map((bridge) => bridge.lane)).toEqual(['left', 'right']);
  for (const bridge of ARENA.bridges) {
    expect(bridge.y).toBe(river.y);
    expect(bridge.height).toBe(river.height);
    expect(laneOf(bridge.x)).toBe(bridge.lane);
    expect(laneOf(bridge.x + bridge.width - 1)).toBe(bridge.lane);
  }
});

test.each([0, 1] as const)('side %i has a Keep at the back center and one Outpost per lane', (side) => {
  const towers = ARENA.towers.filter((site) => site.side === side);
  const [keep, ...outposts] = towers;
  expect(towers.map((site) => [site.kind, site.lane])).toEqual([
    ['keep', null],
    ['outpost', 'left'],
    ['outpost', 'right'],
  ]);
  expect(keep?.x).toBe(MID_X);
  for (const outpost of outposts) {
    expect(laneOf(outpost.x)).toBe(outpost.lane);
    // Behind means farther from the river.
    expect(Math.abs((keep?.y ?? 0) - MID_Y)).toBeGreaterThan(Math.abs(outpost.y - MID_Y));
  }
});

test('side 1 is side 0 mirrored across the river', () => {
  const side0 = ARENA.towers.filter((site) => site.side === 0);
  const side1 = ARENA.towers.filter((site) => site.side === 1);
  expect(side1).toEqual(side0.map((site) => ({ ...site, side: 1, y: ARENA.height - site.y })));
});

test('every tower sits on whole tiles, inside the arena, on its own side of the river', () => {
  for (const site of ARENA.towers) {
    const { left, right, low, high } = edges(site);
    expect([left, low].map((edge) => edge % MILLI_PER_TILE)).toEqual([0, 0]);
    expect(site.size % MILLI_PER_TILE).toBe(0);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(ARENA.width);
    if (site.side === 0) {
      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThanOrEqual(river.y);
    } else {
      expect(low).toBeGreaterThanOrEqual(river.y + river.height);
      expect(high).toBeLessThanOrEqual(ARENA.height);
    }
  }
});

test('no two towers overlap', () => {
  const boxes = ARENA.towers.map(edges);
  boxes.forEach((p, i) => {
    for (const q of boxes.slice(i + 1)) {
      const apart = p.right <= q.left || q.right <= p.left || p.high <= q.low || q.high <= p.low;
      expect(apart).toBe(true);
    }
  });
});
