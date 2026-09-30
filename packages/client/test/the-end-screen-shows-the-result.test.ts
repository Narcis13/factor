import { ARENA, matchSetup } from '@factor/content';
import { createMatch, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import type { ScreenRect } from '../src/arena-view.ts';
import { tap, type Controls } from '../src/controls.ts';
import { endScene } from '../src/end-view.ts';
import { createLoop } from '../src/match-loop.ts';
import { contains, layoutScreen } from '../src/screen-layout.ts';

const START = createMatch(matchSetup(8));
const PHONE = layoutScreen(ARENA, 4, 540, 960);
const DESKTOP = layoutScreen(ARENA, 4, 1600, 900);

function ended(winner: 0 | 1 | null, stars: [number, number]): SimState {
  return { ...START, tick: 3600, stars, result: { winner } };
}

function center(rect: ScreenRect): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

function inside(outer: ScreenRect, inner: ScreenRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

test('there is no end screen while the match runs', () => {
  expect(endScene(START, 0, PHONE.end)).toBeNull();
});

test('each side sees its own outcome, with its own stars on the left', () => {
  const state = ended(0, [1, 0]);
  const mine = endScene(state, 0, PHONE.end);
  const theirs = endScene(state, 1, PHONE.end);
  expect(mine?.outcome).toBe('victory');
  expect(theirs?.outcome).toBe('defeat');
  expect(mine?.stars.map((pip) => [pip.side, pip.earned])).toEqual([[0, true], [0, false], [0, false], [1, false], [1, false], [1, false]]);
  expect(theirs?.stars.map((pip) => [pip.side, pip.earned])).toEqual([[1, false], [1, false], [1, false], [0, true], [0, false], [0, false]]);
  expect(endScene(ended(null, [1, 1]), 0, PHONE.end)?.outcome).toBe('draw');
  expect(endScene(ended(null, [1, 1]), 1, PHONE.end)?.outcome).toBe('draw');
  expect(endScene(ended(1, [0, 3]), 0, PHONE.end)?.outcome).toBe('defeat');
});

test('the panel sits over the arena, with its stars and both buttons inside it and apart', () => {
  for (const { view, end } of [PHONE, DESKTOP]) {
    const arena = { x: view.left, y: view.top, width: 18 * view.tilePx, height: 32 * view.tilePx };
    expect(inside(arena, end.panel)).toBe(true);
    expect(inside(end.panel, end.again)).toBe(true);
    expect(inside(end.panel, end.save)).toBe(true);
    expect(end.again.x + end.again.width).toBeLessThan(end.save.x);
    expect(end.again.height).toBeGreaterThanOrEqual(44);
    const r = end.starRadius;
    const stars = [...end.stars.left, ...end.stars.right];
    for (const star of stars) {
      expect(inside(end.panel, { x: star.x - r, y: star.y - r, width: 2 * r, height: 2 * r })).toBe(true);
      expect(star.y + r).toBeLessThan(end.again.y);
      expect(star.y - r).toBeGreaterThan(end.title.y);
    }
    // The viewer's group is left of the middle, the opponent's right of it.
    const middle = end.panel.x + end.panel.width / 2;
    expect(Math.max(...end.stars.left.map((star) => star.x + r))).toBeLessThan(middle);
    expect(Math.min(...end.stars.right.map((star) => star.x - r))).toBeGreaterThan(middle);
  }
});

test('after the end, taps answer only the buttons: no card is selected and nothing is played', () => {
  const loop = createLoop(ended(1, [0, 1]));
  const controls: Controls = { side: 0, selected: 2, watching: false };
  expect(tap(controls, loop, PHONE, ...center(PHONE.end.again))).toBe('again');
  expect(controls.selected).toBeNull();
  expect(tap(controls, loop, PHONE, ...center(PHONE.end.save))).toBe('save-replay');
  const slot = PHONE.hud.slots[0];
  if (slot === undefined) {
    throw new Error('no hand slot');
  }
  expect(tap(controls, loop, PHONE, ...center(slot))).toBeNull();
  expect(controls.selected).toBeNull();
  expect(tap(controls, loop, PHONE, 270, 200)).toBeNull();
  expect(loop.queued).toEqual([]);
});

test('while the match runs, the buttons are not there to tap', () => {
  const loop = createLoop(START);
  const controls: Controls = { side: 0, selected: null, watching: false };
  expect(contains(PHONE.end.again, ...center(PHONE.end.again))).toBe(true);
  expect(tap(controls, loop, PHONE, ...center(PHONE.end.again))).toBeNull();
  expect(tap(controls, loop, PHONE, ...center(PHONE.end.save))).toBeNull();
});
