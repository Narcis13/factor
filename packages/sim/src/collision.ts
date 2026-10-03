import type { Rect, Terrain } from './arena.ts';
import { clamp, divRound, isqrt, moveToward, squaredDistanceToRect, type Point } from './geometry.ts';

/** A circle that collides: a unit's position with its radius and mass. */
export interface Body extends Point {
  radius: number;
  /** Shares of a push: the lighter of two bodies moves more. At least 1. */
  mass: number;
}

/**
 * Walks `body` up to `length` toward `to` (VISION §4, Movement), around any of `obstacles` in the way.
 * A step that would run into an obstacle's face stops at the face and spends the rest sliding along
 * it, around whichever end of the face makes the shorter way to the goal. At a corner it steps along
 * the tangent of its circle around the corner instead, the way that leans toward the goal; `separate`
 * then pushes it back out to touch the corner, so it rounds it.
 */
export function walk(body: Body, to: Point, length: number, obstacles: readonly Rect[], arena: Terrain): void {
  const start = { x: body.x, y: body.y };
  moveToward(body, to, length);
  const r = body.radius;
  for (const rect of obstacles) {
    if (squaredDistanceToRect(body, rect) >= r * r) {
      continue;
    }
    const withinX = start.x >= rect.x && start.x <= rect.x + rect.width;
    const withinY = start.y >= rect.y && start.y <= rect.y + rect.height;
    if (withinX && withinY) {
      // Already inside: `separate` pushes it out.
      continue;
    }
    if (!withinX && !withinY) {
      const corner = { x: clamp(start.x, rect.x, rect.x + rect.width), y: clamp(start.y, rect.y, rect.y + rect.height) };
      // The tangent, a quarter turn from the way out of the corner; flipped to lean toward the goal.
      let [tx, ty] = [corner.y - start.y, start.x - corner.x];
      if (tx * (to.x - start.x) + ty * (to.y - start.y) < 0) {
        [tx, ty] = [0 - tx, 0 - ty];
      }
      const span = Math.max(1, isqrt(tx * tx + ty * ty));
      body.x = start.x + divRound(tx * length, span);
      body.y = start.y + divRound(ty * length, span);
      continue;
    }
    if (withinX) {
      const faceY = start.y < rect.y ? rect.y - r : rect.y + rect.height + r;
      const rest = Math.max(0, length - Math.abs(faceY - start.y));
      const ends: [number, number] = [rect.x - r, rect.x + rect.width + r];
      const [dir, clearX] = slide(start.x, to.x, ends, arena.width);
      body.x = start.x + dir * Math.min(rest, Math.abs(clearX - start.x));
      body.y = faceY;
    } else {
      const faceX = start.x < rect.x ? rect.x - r : rect.x + rect.width + r;
      const rest = Math.max(0, length - Math.abs(faceX - start.x));
      const ends: [number, number] = [rect.y - r, rect.y + rect.height + r];
      const [dir, clearY] = slide(start.y, to.y, ends, arena.height);
      body.x = faceX;
      body.y = start.y + dir * Math.min(rest, Math.abs(clearY - start.y));
    }
  }
}

/**
 * Which way to slide along a face, on one axis, and the end to clear: the one with the shorter way from
 * `position` past it to `goal`; on a tie, the one toward the middle of the arena (else the high one).
 * The same spot always slides the same way, so a body never turns back halfway along a face.
 */
function slide(position: number, goal: number, [low, high]: [number, number], arenaSize: number): [1 | -1, number] {
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
export function separate(bodies: readonly Body[], obstacles: readonly Rect[], arena: Terrain, ground: boolean): void {
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
}

/** Out of `rect` to touch it: away from its nearest point, or, from inside, through the nearest face. */
function pushOut(body: Body, rect: Rect): void {
  const r = body.radius;
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
