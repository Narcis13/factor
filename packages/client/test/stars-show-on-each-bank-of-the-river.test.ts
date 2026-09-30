import { ARENA, matchSetup } from '@factor/content';
import { createMatch, MAX_STARS, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { pointToScreen, toScreen } from '../src/arena-view.ts';
import { hudScene } from '../src/hud-view.ts';
import { layoutScreen } from '../src/screen-layout.ts';

const START = createMatch(matchSetup(5));
const PHONE = layoutScreen(ARENA, 4, 540, 960);

function withStars(stars: [number, number]): SimState {
  return { ...START, stars };
}

test('the HUD shows three star slots per side, side 0 first, earned from the left', () => {
  const scene = hudScene(START, withStars([1, 3]), 0, PHONE.hud, 0, null);
  expect(scene.stars.map((pip) => pip.side)).toEqual([0, 0, 0, 1, 1, 1]);
  expect(scene.stars.map((pip) => pip.earned)).toEqual([true, false, false, true, true, true]);
  expect(hudScene(START, START, 0, PHONE.hud, 0, null).stars.every((pip) => !pip.earned)).toBe(true);
  // Stars come from `current`, not `previous`.
  expect(hudScene(withStars([2, 0]), START, 0, PHONE.hud, 0, null).stars.some((pip) => pip.earned)).toBe(false);
});

test('both players see the same stars in the same place', () => {
  const state = withStars([2, 1]);
  expect(hudScene(state, state, 0, PHONE.hud, 1, null).stars).toEqual(hudScene(state, state, 0, PHONE.hud, 0, null).stars);
});

test("each side's stars stack away from the river on its own bank, right of the bridge", () => {
  for (const { view, hud } of [PHONE, layoutScreen(ARENA, 4, 1600, 900)]) {
    const river = toScreen(view, ARENA.river);
    const bridge = toScreen(view, ARENA.bridges[1] ?? ARENA.river);
    const arenaRight = pointToScreen(view, ARENA.width, 0).x;
    const r = hud.starRadius;
    expect(r).toBeGreaterThanOrEqual(view.tilePx / 3);
    for (const side of [0, 1] as const) {
      const column = hud.stars[side];
      expect(column).toHaveLength(MAX_STARS);
      for (const [i, star] of column.entries()) {
        expect(star.x + r).toBeLessThanOrEqual(arenaRight);
        expect(star.x - r).toBeGreaterThanOrEqual(bridge.x + bridge.width);
        if (side === 0) {
          expect(star.y - r).toBeGreaterThanOrEqual(river.y + river.height);
        } else {
          expect(star.y + r).toBeLessThanOrEqual(river.y);
        }
        const previous = column[i - 1];
        if (previous !== undefined) {
          expect(star.x).toBe(previous.x);
          // Away from the river: down the screen for side 0, up it for side 1, without touching.
          expect((star.y - previous.y) * (side === 0 ? 1 : -1)).toBeGreaterThanOrEqual(2 * r);
        }
      }
    }
  }
});
