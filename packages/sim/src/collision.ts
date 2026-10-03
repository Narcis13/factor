import type { Rect, Terrain } from './arena.ts';
import { clamp, divRound, isqrt, moveToward, squaredDistanceToRect, type Point } from './geometry.ts';

/**
 * Something ground units can't walk through: a rectangle, kept `pad` clear of. A tower is its footprint
 * with no pad; a building, a circle, is the point at its center padded by its radius.
 */
export interface Obstacle extends Rect {
  pad: number;
}

/** A building's circle as an obstacle. */
export function circleObstacle({ x, y }: Point, radius: number): Obstacle {
  return { x, y, width: 0, height: 0, pad: radius };
}

/** A circle that collides: a unit's position with its radius and mass. */
export interface Body extends Point {
  radius: number;
  /** Shares of a push: the lighter of two bodies moves more. At least 1. */
  mass: number;
}

/**
 * Walks `body` up to `length` toward `to` (VISION §4, Movement), around any of `obstacles` in the way.
 * A step that would run into an obstacle stops at the face it is in front of (the one it is further out
 * from, at a corner) and spends the rest sliding along it, around whichever end makes the shorter way
 * to the goal, until it is clear of that end. Already pressed into the face (pushed there, or squeezed
 * against the arena's edge), it spends the whole step sliding. `separate` then pushes it back out to
 * touch the obstacle, so it rounds corners.
 */
export function walk(body: Body, to: Point, length: number, obstacles: readonly Obstacle[], arena: Terrain): void {
  const start = { x: body.x, y: body.y };
  moveToward(body, to, length);
  for (const rect of obstacles) {
    const r = body.radius + rect.pad;
    if (squaredDistanceToRect(body, rect) >= r * r) {
      continue;
    }
    const outX = Math.max(rect.x - start.x, 0, start.x - (rect.x + rect.width));
    const outY = Math.max(rect.y - start.y, 0, start.y - (rect.y + rect.height));
    if (outX === 0 && outY === 0) {
      // Already inside: `separate` pushes it out.
      continue;
    }
    if (outY >= outX) {
      const below = start.y < rect.y;
      const faceY = below ? rect.y - r : rect.y + rect.height + r;
      const approach = below ? faceY - start.y : start.y - faceY;
      const rest = Math.max(0, length - Math.max(0, approach));
      const y = approach >= 0 ? faceY : start.y;
      const ends: [number, number] = [rect.x - r, rect.x + rect.width + r];
      const fits = ends.map((x) => x >= body.radius && x <= arena.width - 1 - body.radius && clear({ ...body, x, y }, rect, obstacles)) as [boolean, boolean];
      const [dir, clearX] = slide(start.x, to.x, ends, fits, arena.width);
      body.x = start.x + dir * Math.min(rest, Math.abs(clearX - start.x));
      body.y = y;
    } else {
      const left = start.x < rect.x;
      const faceX = left ? rect.x - r : rect.x + rect.width + r;
      const approach = left ? faceX - start.x : start.x - faceX;
      const rest = Math.max(0, length - Math.max(0, approach));
      const x = approach >= 0 ? faceX : start.x;
      const ends: [number, number] = [rect.y - r, rect.y + rect.height + r];
      const fits = ends.map((y) => y >= body.radius && y <= arena.height - 1 - body.radius && clear({ ...body, x, y }, rect, obstacles)) as [boolean, boolean];
      const [dir, clearY] = slide(start.y, to.y, ends, fits, arena.height);
      body.x = x;
      body.y = start.y + dir * Math.min(rest, Math.abs(clearY - start.y));
    }
  }
}

/** Whether `body` stands clear of every obstacle but `except`. */
function clear(body: Body, except: Obstacle, obstacles: readonly Obstacle[]): boolean {
  return obstacles.every((other) => {
    const reach = body.radius + other.pad;
    return other === except || squaredDistanceToRect(body, other) >= reach * reach;
  });
}

/**
 * Which way to slide along a face, on one axis, and the end to clear. An end the body can't stand at
 * (`fits` false: past the arena's edge, or on another obstacle) is out while the other fits; then the
 * one with the shorter way from `position` past it to `goal`; on a tie, the one toward the middle of
 * the arena (else the high one). None of this depends on how far along the face the body is, so it
 * never turns back halfway.
 */
function slide(position: number, goal: number, [low, high]: [number, number], [lowFits, highFits]: [boolean, boolean], arenaSize: number): [1 | -1, number] {
  if (lowFits !== highFits) {
    return lowFits ? [-1, low] : [1, high];
  }
  const viaLow = position - low + Math.abs(goal - low);
  const viaHigh = high - position + Math.abs(high - goal);
  if (viaLow !== viaHigh) {
    return viaLow < viaHigh ? [-1, low] : [1, high];
  }
  return position * 2 > arenaSize ? [-1, low] : [1, high];
}

/**
 * Units are circles that push each other apart by mass (VISION §4, Movement). Each overlapping pair,
 * in list order, is moved apart along the line between their centers, each by the other's share of
 * the overlap, rounded down: equal masses move equally, so mirrored pairs stay mirrored, and an
 * overlap of 1 stays. Two bodies on the same point split along x, the first toward −x.
 * Then each body is pushed out of the obstacles it overlaps and kept inside the arena (by its radius,
 * where the arena is wide enough); on the `ground`, also off the river except over a bridge. One pass a tick, so a crowd settles over a few ticks.
 */
export function separate(bodies: readonly Body[], obstacles: readonly Obstacle[], arena: Terrain, ground: boolean): void {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length && a !== undefined; j++) {
      const b = bodies[j];
      if (b !== undefined) {
        pushApart(a, b);
      }
    }
  }
  for (const body of bodies) {
    for (const rect of obstacles) {
      pushOut(body, rect);
    }
    keepInArena(body, arena, ground);
  }
}

function pushApart(a: Body, b: Body): void {
  const reach = a.radius + b.radius;
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const squared = dx * dx + dy * dy;
  if (squared >= reach * reach) {
    return;
  }
  const distance = isqrt(squared);
  const [nx, ny, length] = distance === 0 ? [1, 0, 1] : [dx, dy, distance];
  const overlap = reach - distance;
  const total = a.mass + b.mass;
  const aShare = Math.floor((overlap * b.mass) / total);
  const bShare = Math.floor((overlap * a.mass) / total);
  a.x -= divRound(nx * aShare, length);
  a.y -= divRound(ny * aShare, length);
  b.x += divRound(nx * bShare, length);
  b.y += divRound(ny * bShare, length);
  if (Math.abs(dx) * 4 < Math.abs(dy)) {
    // Nearly head-on in a column, neither would ever get past: they also step aside along x, away from
    // each other (the first toward −x when exactly in line).
    const aside = Math.floor(overlap / 4) * (dx < 0 ? -1 : 1);
    a.x -= aside;
    b.x += aside;
  }
}

/** Out of `rect` to touch it: away from its nearest point, or, from inside, through the nearest face. */
function pushOut(body: Body, rect: Obstacle): void {
  const r = body.radius + rect.pad;
  const squared = squaredDistanceToRect(body, rect);
  if (squared >= r * r) {
    return;
  }
  if (squared > 0) {
    const nearX = clamp(body.x, rect.x, rect.x + rect.width);
    const nearY = clamp(body.y, rect.y, rect.y + rect.height);
    const distance = Math.max(1, isqrt(squared));
    body.x = nearX + divRound((body.x - nearX) * r, distance);
    body.y = nearY + divRound((body.y - nearY) * r, distance);
    return;
  }
  const faces = [
    { gap: body.x - rect.x, x: rect.x - r, y: body.y },
    { gap: rect.x + rect.width - body.x, x: rect.x + rect.width + r, y: body.y },
    { gap: body.y - rect.y, x: body.x, y: rect.y - r },
    { gap: rect.y + rect.height - body.y, x: body.x, y: rect.y + rect.height + r },
  ];
  let best = faces[0];
  for (const face of faces) {
    if (best === undefined || face.gap < best.gap) {
      best = face;
    }
  }
  if (best !== undefined) {
    body.x = best.x;
    body.y = best.y;
  }
}

/**
 * Inside the arena by at least the body's radius (where the arena is wide enough). On the ground, off
 * the river except over a bridge too: to whichever is nearer, the closest bank or the closest bridge edge.
 */
function keepInArena(body: Body, arena: Terrain, ground: boolean): void {
  const { river, bridges } = arena;
  const marginX = Math.min(body.radius, Math.floor((arena.width - 1) / 2));
  const marginY = Math.min(body.radius, Math.floor((arena.height - 1) / 2));
  body.x = clamp(body.x, marginX, arena.width - 1 - marginX);
  body.y = clamp(body.y, marginY, arena.height - 1 - marginY);
  if (!ground || body.y < river.y || body.y >= river.y + river.height || bridges.some((bridge) => body.x >= bridge.x && body.x <= bridge.x + bridge.width)) {
    return;
  }
  const below = body.y - (river.y - 1);
  const above = river.y + river.height - body.y;
  let best: Point = below <= above ? { x: body.x, y: river.y - 1 } : { x: body.x, y: river.y + river.height };
  let bestMove = Math.min(below, above);
  for (const bridge of bridges) {
    const x = clamp(body.x, bridge.x, bridge.x + bridge.width);
    if (Math.abs(x - body.x) < bestMove) {
      best = { x, y: body.y };
      bestMove = Math.abs(x - body.x);
    }
  }
  body.x = best.x;
  body.y = best.y;
}
