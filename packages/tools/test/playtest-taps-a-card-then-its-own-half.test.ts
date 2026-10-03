import { layoutScreen, toArena } from '@factor/client';
import { ARENA, MATCH_RULES, matchSetup } from '@factor/content';
import { createMatch, deployZones } from '@factor/sim';
import { expect, test } from 'vitest';
import { CLIENT_VIEWPORT } from '../src/browser.ts';
import { playtestTaps } from '../src/playtest.ts';

const START = createMatch(matchSetup(0));
const layout = layoutScreen(ARENA, MATCH_RULES.handSize, CLIENT_VIEWPORT.width, CLIENT_VIEWPORT.height);

function inside(rect: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

test("each play taps the hand slots in turn, then a spot on side 0's half in line with alternating bridges", () => {
  const plays = Array.from({ length: 8 }, (_, i) => playtestTaps(layout, ARENA, i));
  plays.forEach(([card, spot], i) => {
    expect(layout.hud.slots.findIndex((slot) => inside(slot, card))).toBe(i % MATCH_RULES.handSize);
    const point = toArena(layout.view, ARENA, spot.x, spot.y);
    if (point === null) {
      throw new Error(`play ${String(i)} taps off the arena`);
    }
    expect(deployZones(START, 0).some((zone) => inside(zone, point))).toBe(true);
    const bridge = ARENA.bridges[i % 2];
    expect(bridge !== undefined && point.x >= bridge.x && point.x < bridge.x + bridge.width).toBe(true);
  });
  expect(plays[0]?.[1].x).toBeLessThan(plays[1]?.[1].x ?? 0);
});

test("no tap lands on the end screen's buttons, so a tap after the match ends starts nothing", () => {
  for (let i = 0; i < MATCH_RULES.handSize * 2; i++) {
    for (const point of playtestTaps(layout, ARENA, i)) {
      expect(inside(layout.end.again, point)).toBe(false);
      expect(inside(layout.end.save, point)).toBe(false);
    }
  }
});
