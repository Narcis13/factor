import { ARENA, matchSetup } from '@factor/content';
import { createMatch } from '@factor/sim';
import { expect, test } from 'vitest';
import type { ScreenRect } from '../src/arena-view.ts';
import { tap, type Controls } from '../src/controls.ts';
import { advance, createLoop, TICK_MS } from '../src/match-loop.ts';
import { contains, layoutScreen, toArena } from '../src/screen-layout.ts';

const START = createMatch(matchSetup(3));
const PHONE = layoutScreen(ARENA, 4, 540, 960);

function center(rect: ScreenRect): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

function overlaps(a: ScreenRect, b: ScreenRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('on a phone, the arena sits above the hand and the energy bar, and nothing overlaps', () => {
  const { view, hud } = PHONE;
  const arena = { x: view.left, y: view.top, width: 18 * view.tilePx, height: 32 * view.tilePx };
  expect(view.tilePx).toBe(24);
  const parts = [...hud.slots, hud.next, hud.energyBar];
  for (const [i, part] of parts.entries()) {
    expect(part.y).toBeGreaterThanOrEqual(arena.y + arena.height);
    expect(part.x).toBeGreaterThanOrEqual(0);
    expect(part.x + part.width).toBeLessThanOrEqual(540);
    expect(part.y + part.height).toBeLessThanOrEqual(960);
    for (const other of parts.slice(i + 1)) {
      expect(overlaps(part, other)).toBe(false);
    }
  }
  // Hand slots run left to right, the same size.
  const xs = hud.slots.map((slot) => slot.x);
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  expect(new Set(hud.slots.map((slot) => `${String(slot.width)}×${String(slot.height)}`)).size).toBe(1);
  // The clock sits inside the arena's top-right corner.
  expect(contains(arena, hud.timer.x - 1, hud.timer.y)).toBe(true);
});

test('on a wide desktop window the hand stays phone-sized and centered', () => {
  const { hud } = layoutScreen(ARENA, 4, 1920, 1080);
  const left = hud.next.x;
  const right = (hud.slots.at(-1)?.x ?? 0) + (hud.slots.at(-1)?.width ?? 0);
  expect(right - left).toBeLessThanOrEqual(Math.floor((1080 * 9) / 16));
  expect(Math.abs(left - (1920 - right))).toBeLessThanOrEqual(2);
});

test('a screen point maps to the arena point under it, with side 0 at the bottom', () => {
  const { view } = PHONE;
  // The center of the bottom-left tile and of the top-right tile.
  expect(toArena(view, ARENA, view.left + 12, view.top + 31 * 24 + 12)).toEqual({ x: 500, y: 499 });
  expect(toArena(view, ARENA, view.left + 17 * 24 + 12, view.top + 12)).toEqual({ x: 17_500, y: 31_499 });
  // Corners are inside; one pixel beyond is not.
  expect(toArena(view, ARENA, view.left, view.top)).toEqual({ x: 0, y: 31_999 });
  expect(toArena(view, ARENA, view.left - 1, view.top)).toBeNull();
  expect(toArena(view, ARENA, view.left, view.top + 32 * 24)).toBeNull();
  expect(toArena(view, ARENA, view.left + 18 * 24, view.top)).toBeNull();
});

test('tapping a card and then the arena queues a play for side 0 there', () => {
  const loop = createLoop(START);
  const controls: Controls = { side: 0, selected: null, watching: false };
  tap(controls, loop, PHONE, ...center(PHONE.hud.slots[1] ?? PHONE.hud.next));
  expect(controls.selected).toBe(1);
  const { view } = PHONE;
  tap(controls, loop, PHONE, view.left + 4 * 24 + 12, view.top + 25 * 24 + 12);
  expect(loop.queued).toEqual([{ side: 0, handSlot: 1, x: 4500, y: 6499 }]);
  expect(controls.selected).toBeNull();

  advance(loop, TICK_MS);
  expect(loop.commands).toEqual([{ tick: 0, side: 0, handSlot: 1, x: 4500, y: 6499 }]);
  expect(loop.current.rejected).toEqual([]);
  expect(loop.current.players[0].hand[1]).toBe(START.players[0].queue[0]);
});

test('tapping the selected card again deselects it; tapping another switches', () => {
  const loop = createLoop(START);
  const controls: Controls = { side: 0, selected: null, watching: false };
  const [slot0, slot3] = [PHONE.hud.slots[0], PHONE.hud.slots[3]];
  if (slot0 === undefined || slot3 === undefined) {
    throw new Error('missing slots');
  }
  tap(controls, loop, PHONE, ...center(slot0));
  tap(controls, loop, PHONE, ...center(slot3));
  expect(controls.selected).toBe(3);
  tap(controls, loop, PHONE, ...center(slot3));
  expect(controls.selected).toBeNull();
  expect(loop.queued).toEqual([]);
});

test('tapping the arena with no card selected, or off the arena with one, does nothing', () => {
  const loop = createLoop(START);
  const controls: Controls = { side: 0, selected: null, watching: false };
  tap(controls, loop, PHONE, ...center({ x: PHONE.view.left, y: PHONE.view.top, width: 432, height: 768 }));
  expect(loop.queued).toEqual([]);
  tap(controls, loop, PHONE, ...center(PHONE.hud.slots[2] ?? PHONE.hud.next));
  tap(controls, loop, PHONE, ...center(PHONE.hud.energyBar));
  tap(controls, loop, PHONE, ...center(PHONE.hud.next));
  expect(loop.queued).toEqual([]);
  expect(controls.selected).toBe(2);
});
