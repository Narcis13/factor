import { ARENA, matchSetup } from '@factor/content';
import { createMatch, step, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { energyLevel, formatClock, hudScene } from '../src/hud-view.ts';
import { stepTo } from '../src/match-loop.ts';
import { layoutScreen } from '../src/screen-layout.ts';

const START = createMatch(matchSetup(11));
const { hud: LAYOUT } = layoutScreen(ARENA, 4, 540, 960);

test('the clock counts regulation down in whole seconds, rounded up', () => {
  expect(formatClock(START)).toBe('3:00');
  expect(formatClock(stepTo(START, 1))).toBe('3:00');
  expect(formatClock(stepTo(START, 20))).toBe('2:59');
  expect(formatClock(stepTo(START, 90))).toBe('2:56');
  expect(formatClock(stepTo(START, 3400))).toBe('0:10');
  expect(formatClock(stepTo(START, 3599))).toBe('0:01');
});

test('with stars tied, the clock goes on into overtime', () => {
  expect(formatClock(stepTo(START, 3600))).toBe('OT 2:00');
  expect(formatClock(stepTo(START, 3601))).toBe('OT 2:00');
  expect(formatClock(stepTo(START, 4800))).toBe('OT 1:00');
  expect(formatClock(stepTo(START, 6000))).toBe('OT 0:00');
});

test('a match decided as regulation runs out stops the clock at 0:00, not in overtime', () => {
  const end = stepTo(START, 3600);
  expect(formatClock({ ...end, result: { winner: 1 } })).toBe('0:00');
  expect(formatClock({ ...stepTo(START, 3601), result: { winner: 0 } })).toBe('OT 2:00');
});

test('energy includes regeneration toward the next one', () => {
  expect(energyLevel(START, 0)).toBe(5);
  expect(energyLevel(stepTo(START, 28), 0)).toBe(5.5);
  expect(energyLevel(stepTo(START, 56), 1)).toBe(6);
});

test('the energy bar is interpolated between the two ticks the display sits between', () => {
  const previous = stepTo(START, 14);
  const current = step(previous, []);
  const at = (alpha: number) => hudScene(previous, current, alpha, LAYOUT, 0, null).energyFill;
  expect(at(0)).toBeCloseTo((5 + 14 / 56) / 10);
  expect(at(1)).toBeCloseTo((5 + 15 / 56) / 10);
  expect(at(0.5)).toBeCloseTo((5 + 14.5 / 56) / 10);
  const full = stepTo(START, 400);
  expect(hudScene(full, full, 0.3, LAYOUT, 0, null).energyFill).toBe(1);
});

test('the hand shows each card with its cost, whether it is affordable, and the selection', () => {
  const hand = ['warden', 'juggernaut', 'flare', 'slinger'];
  const state: SimState = { ...START, players: [{ ...START.players[0], energy: 4, hand }, START.players[1]] };
  const scene = hudScene(state, state, 0, LAYOUT, 0, 2);
  expect(scene.energy).toBe(4);
  expect(scene.energyMax).toBe(10);
  expect(scene.hand.map((face) => face.card)).toEqual(state.players[0].hand);
  for (const face of scene.hand) {
    expect(face.cost).toBe(state.cards[face.card]?.cost);
    expect(face.affordable).toBe(face.cost <= 4);
    expect(face.selected).toBe(face.slot === 2);
    expect(face.rect).toBe(LAYOUT.slots[face.slot]);
  }
  expect(scene.hand.map((face) => face.affordable)).toEqual([true, false, true, true]);
  expect(scene.next).toEqual({ card: state.players[0].queue[0], rect: LAYOUT.next });
});

test('each side sees its own hand and energy', () => {
  const state: SimState = { ...START, players: [START.players[0], { ...START.players[1], energy: 9 }] };
  expect(hudScene(state, state, 0, LAYOUT, 1, null).energy).toBe(9);
  expect(hudScene(state, state, 0, LAYOUT, 1, null).hand.map((face) => face.card)).toEqual(state.players[1].hand);
});
