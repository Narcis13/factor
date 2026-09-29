import { ARENA, matchSetup } from '@factor/content';
import { createMatch, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { fitView, hpBarScene, towerScene, type UnitShape } from '../src/index.ts';

// 30 px per tile, so bars are 5 px tall with a 3 px gap above what they measure.
const VIEW = fitView(ARENA, 540, 960);
const START = createMatch(matchSetup(0));

function unit(hp: number, maxHp: number): UnitShape {
  return { id: 6, side: 1, card: 'warden', x: 100, y: 200, radius: 15, deploying: false, hp, maxHp };
}

test('every standing tower has a full bar just above its footprint, as wide as it is', () => {
  const bars = hpBarScene(START, [], VIEW);
  expect(bars).toHaveLength(6);
  const towers = towerScene(START, VIEW);
  bars.forEach((bar, i) => {
    const tower = towers[i];
    expect(bar.fraction).toBe(1);
    expect(bar.side).toBe(START.towers[i]?.side);
    expect(bar.rect).toEqual({ x: tower?.rect.x, y: (tower?.rect.y ?? 0) - 3 - 5, width: tower?.rect.width, height: 5 });
  });
});

test('a damaged tower shows what it has left; a fallen one has no bar and is drawn as fallen', () => {
  const towers = START.towers.map((tower) => (tower.id === 1 ? { ...tower, hp: 625 } : tower.id === 4 ? { ...tower, hp: 0 } : tower));
  const state: SimState = { ...START, towers };
  const bars = hpBarScene(state, [], VIEW);
  expect(bars).toHaveLength(5);
  expect(bars[1]?.fraction).toBe(625 / 2500);
  expect(towerScene(state, VIEW).map((shape) => ('fallen' in shape ? shape.fallen : null))).toEqual([false, false, false, false, true, false]);
});

test('a unit at full hp has no bar; a damaged one has one as wide as its circle, above it', () => {
  expect(hpBarScene({ towers: [] }, [unit(1200, 1200)], VIEW)).toEqual([]);
  expect(hpBarScene({ towers: [] }, [unit(300, 1200)], VIEW)).toEqual([
    { side: 1, rect: { x: 85, y: 200 - 15 - 3 - 5, width: 30, height: 5 }, fraction: 0.25 },
  ]);
});
