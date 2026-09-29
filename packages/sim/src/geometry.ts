import type { Rect } from './arena.ts';

/** A point in milli-tiles. */
export interface Point {
  x: number;
  y: number;
}

/** ⌊√n⌋ for a safe integer n ≥ 0. Math.sqrt is exact (IEEE 754); the loops fix any off-by-one in the floor. */
export function isqrt(n: number): number {
  let root = Math.floor(Math.sqrt(n));
  while (root * root > n) {
    root--;
  }
  while ((root + 1) * (root + 1) <= n) {
    root++;
  }
  return root;
}

/** a / b rounded to the nearest integer, halves away from zero, so mirrored inputs give mirrored results. b > 0. */
export function divRound(a: number, b: number): number {
  const magnitude = Math.floor((Math.abs(a) * 2 + b) / (b * 2));
  return a < 0 ? 0 - magnitude : magnitude;
}

/** From a point to the nearest point of a rectangle; 0 inside it. */
export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return isqrt(dx * dx + dy * dy);
}

/** Moves `point` in place up to `length` toward `to`, landing exactly on it when it is that close. */
export function moveToward(point: Point, to: Point, length: number): void {
  const [dx, dy] = [to.x - point.x, to.y - point.y];
  const gap = isqrt(dx * dx + dy * dy);
  if (gap <= length) {
    point.x = to.x;
    point.y = to.y;
    return;
  }
  point.x += divRound(dx * length, gap);
  point.y += divRound(dy * length, gap);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
