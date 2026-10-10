import { expect, test } from 'vitest';
import { attackFrame, facingTo, restFacing } from '../src/poses.ts';

test('a unit faces the way it moves: up the screen toward side 1, down toward side 0, or sideways', () => {
  expect(facingTo(0, 100)).toEqual(['up', false]);
  expect(facingTo(0, -100)).toEqual(['down', false]);
  expect(facingTo(100, 10)).toEqual(['side', false]);
  // Left is the right-facing drawing mirrored.
  expect(facingTo(-100, 10)).toEqual(['side', true]);
  // A diagonal leans to up or down unless it is clearly sideways.
  expect(facingTo(100, 100)).toEqual(['up', false]);
});

test('at rest a unit looks toward the enemy', () => {
  expect(restFacing(0)).toBe('up');
  expect(restFacing(1)).toBe('down');
});

test('the strike frame shows on the tick the hit lands and the one after, then the follow-through', () => {
  const hitTicks = 24;
  // The sim resets the cooldown to hitTicks on the tick it strikes.
  expect(attackFrame(24, hitTicks)).toBe(2);
  expect(attackFrame(23, hitTicks)).toBe(2);
  expect(attackFrame(22, hitTicks)).toBe(3);
  expect(attackFrame(21, hitTicks)).toBe(3);
  expect(attackFrame(12, hitTicks)).toBe(0);
  // Winding up in the last three ticks before the next hit.
  expect(attackFrame(3, hitTicks)).toBe(1);
  expect(attackFrame(1, hitTicks)).toBe(1);
  // A first hit's delay is shorter than hitTicks: ready, then the wind-up.
  expect(attackFrame(10, hitTicks)).toBe(0);
  expect(attackFrame(2, hitTicks)).toBe(1);
});
