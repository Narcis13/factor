import { ARENA } from '@factor/content';
import type { Projectile } from '@factor/sim';
import { expect, test } from 'vitest';
import { fitView, projectileScene, splashScene } from '../src/index.ts';

// 540 × 960 fits the arena at 30 px per tile, so 1 tile = 30 px and the arena's top edge is y = 0.
const VIEW = fitView(ARENA, 540, 960);

const SHOT: Projectile = { id: 40, side: 1, x: 3000, y: 20_000, targetId: 12, toX: 3000, toY: 10_000, speed: 500, damage: 90, splash: 0, targets: 'air' };

test('a shot is drawn between where it was and where it is, a sixth of a tile across', () => {
  const later = { ...SHOT, y: 19_000 };
  expect(projectileScene({ projectiles: [SHOT] }, { projectiles: [later] }, 0.5, VIEW)).toEqual([{ side: 1, x: 90, y: (32 - 19.5) * 30, radius: 5 }]);
  // A new shot shows where it is; a splash shell is drawn bigger.
  const shell = { ...SHOT, id: 41, splash: 1200 };
  expect(projectileScene({ projectiles: [] }, { projectiles: [shell] }, 0.5, VIEW)).toEqual([{ side: 1, x: 90, y: (32 - 20) * 30, radius: 7.5 }]);
});

test('a splash shows as a ring of its radius where it landed, fading out over its life', () => {
  const splashes = [{ side: 0 as const, x: 9000, y: 16_000, radius: 1200, tick: 100 }];
  expect(splashScene(splashes, { tick: 100 }, 0, 10, VIEW)).toEqual([{ side: 0, x: 270, y: 480, radius: 36, fade: 1 }]);
  expect(splashScene(splashes, { tick: 105 }, 0, 10, VIEW)[0]?.fade).toBe(0.5);
  expect(splashScene(splashes, { tick: 110 }, 0, 10, VIEW)).toEqual([]);
});
