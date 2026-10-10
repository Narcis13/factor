import { ARENA, matchSetup } from '@factor/content';
import { createMatch, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { fitView, hpBarScene, towerScene, type Heights, type UnitShape } from '../src/index.ts';

// 30 px per tile: tower bars are 8 px tall, unit bars 4, each 4 px above what they measure.
const VIEW = fitView(ARENA, 540, 960);
const START = createMatch(matchSetup(0));
/** A Keep drawn 60 px tall, an Outpost 50, a unit 25. */
const HEIGHTS: Heights = { tower: (kind) => (kind === 'keep' ? 60 : 50), unit: () => 25 };

function unit(hp: number, maxHp: number, lift = 0): UnitShape {
  return { id: 6, side: 1, card: 'warden', x: 100, y: 200, radius: 15, deploying: false, flying: lift > 0, lift, building: false, hp, maxHp };
}

test('every standing tower has a full bar just above its drawing, centered, a little over half its footprint wide', () => {
  const bars = hpBarScene(START, [], VIEW, HEIGHTS);
  expect(bars).toHaveLength(6);
  const towers = towerScene(START, VIEW);
  bars.forEach((bar, i) => {
    const tower = towers[i];
    const footprint = tower?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    const width = Math.round(footprint.width * 0.58);
    const drawn = tower?.kind === 'keep' ? 60 : 50;
    expect(bar.fraction).toBe(1);
    expect(bar.side).toBe(START.towers[i]?.side);
    expect(bar.rect).toEqual({ x: Math.round(footprint.x + (footprint.width - width) / 2), y: Math.round(footprint.y + footprint.height / 2 - drawn - 4 - 8), width, height: 8 });
  });
});

test('a damaged tower shows what it has left; a fallen one has no bar and is drawn as fallen', () => {
  const towers = START.towers.map((tower) => (tower.id === 1 ? { ...tower, hp: 625 } : tower.id === 4 ? { ...tower, hp: 0 } : tower));
  const state: SimState = { ...START, towers };
  const bars = hpBarScene(state, [], VIEW, HEIGHTS);
  expect(bars).toHaveLength(5);
  expect(bars[1]?.fraction).toBe(625 / 2500);
  expect(towerScene(state, VIEW).map((shape) => shape.fallen)).toEqual([false, false, false, false, true, false]);
});

test('the Keeps are drawn dormant until they wake; Outposts never are', () => {
  expect(towerScene(START, VIEW).map((shape) => shape.dormant)).toEqual([true, false, false, true, false, false]);
  const awake = { ...START, towers: START.towers.map((tower) => (tower.id === 0 ? { ...tower, dormant: false } : tower)) };
  expect(towerScene(awake, VIEW).map((shape) => shape.dormant)).toEqual([false, false, false, true, false, false]);
});

test('a unit at full hp has no bar; a damaged one has one as wide as it is, above its drawing', () => {
  expect(hpBarScene({ towers: [] }, [unit(1200, 1200)], VIEW, HEIGHTS)).toEqual([]);
  expect(hpBarScene({ towers: [] }, [unit(300, 1200)], VIEW, HEIGHTS)).toEqual([{ side: 1, rect: { x: 85, y: 200 - 25 - 4 - 4, width: 30, height: 4 }, fraction: 0.25 }]);
});

test('a flying unit’s bar rides above it, as high as it flies', () => {
  const [bar] = hpBarScene({ towers: [] }, [unit(300, 1200, 27)], VIEW, HEIGHTS);
  expect(bar?.rect.y).toBe(200 - 27 - 25 - 4 - 4);
});
