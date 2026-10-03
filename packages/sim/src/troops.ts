import { footprint, type Rect, type Terrain, type Tower, type TowerStats } from './arena.ts';
import { canTarget, type CardId, type CardStats, type UnitStats } from './cards.ts';
import { walk } from './collision.ts';
import { clamp, distanceToRect, isqrt, type Point } from './geometry.ts';
import type { Side } from './state.ts';

/** A troop's unit on the field. Its stats stay on its card (`SimState.cards`). */
export interface Unit {
  /** Shares one ascending sequence with the towers. */
  id: number;
  side: Side;
  card: CardId;
  /** Center, in milli-tiles. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Ticks left before it acts; it stands still while this is above 0. */
  deployTicks: number;
  /** The tower or unit it's locked on to, or `null`. May name one that fell since; it's dropped on the next act. */
  targetId: number | null;
  /** Ticks until its next hit while locked on. */
  cooldown: number;
}

/** Where `side` may deploy troops: its own half, up to the river (VISION §4). */
export function deployZone(arena: Terrain, side: Side): Rect {
  const { river } = arena;
  const riverEnd = river.y + river.height;
  return side === 0
    ? { x: 0, y: 0, width: arena.width, height: river.y }
    : { x: 0, y: riverEnd, width: arena.width, height: arena.height - riverEnd };
}

/**
 * Where a play's `count` units appear (VISION §4, Card types): rows of up to ⌈√count⌉, each row
 * centered, units a diameter apart, the formation centered on the aim point. Rows run from the
 * front (toward the enemy) back, so side 1's formation is side 0's mirrored. Kept inside the arena;
 * the end-of-tick push moves any that landed on a tower or in the river.
 */
export function formation(arena: Terrain, aim: { side: Side; x: number; y: number }, count: number, radius: number): Point[] {
  let columns = 1;
  while (columns * columns < count) {
    columns++;
  }
  const rows = Math.ceil(count / columns);
  const forward = aim.side === 0 ? 1 : -1;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const column = i % columns;
    const dx = (column * 2 - (inRow - 1)) * radius;
    const dy = ((rows - 1) - row * 2) * radius * forward;
    points.push({ x: clamp(aim.x + dx, 0, arena.width - 1), y: clamp(aim.y + dy, 0, arena.height - 1) });
  }
  return points;
}

export function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/** A hit decided this tick. Hits land together after everything has acted, so no one hits first. */
export interface Hit {
  targetId: number;
  damage: number;
}

/** What a unit acts on: the field as the step is building it. */
export interface Field {
  arena: Terrain;
  towers: readonly Tower[];
  units: readonly Unit[];
  cards: Readonly<Record<CardId, CardStats>>;
}

type Target = { kind: 'tower'; entity: Tower } | { kind: 'unit'; entity: Unit; radius: number };

/**
 * One tick of a deployed unit (VISION §4, Targeting and Movement). It counts down its deploy delay;
 * otherwise, while locked on to a target still in range, it keeps hitting it. Else it acquires the
 * nearest valid enemy in sight (or, with none, the nearest enemy tower), locks on if it's in range,
 * and moves toward it if not: a flying unit straight there, a ground unit over its lane's bridge when
 * the river is in the way.
 */
export function actUnit(unit: Unit, stats: UnitStats, field: Field, hits: Hit[]): void {
  if (unit.deployTicks > 0) {
    unit.deployTicks -= 1;
    return;
  }
  const locked = unit.targetId === null ? null : findTarget(field, unit.targetId);
  if (locked !== null && gapTo(unit, stats, locked) <= stats.range) {
    unit.cooldown -= 1;
    if (unit.cooldown <= 0) {
      hits.push({ targetId: locked.entity.id, damage: stats.damage });
      unit.cooldown = stats.hitTicks;
    }
    return;
  }
  unit.targetId = null;
  const target = acquire(unit, stats, field);
  if (target === null) {
    return;
  }
  const gap = gapTo(unit, stats, target) - stats.range;
  if (gap <= 0) {
    unit.targetId = target.entity.id;
    unit.cooldown = stats.firstHitTicks;
    return;
  }
  const goal = target.entity;
  if (stats.layer === 'air') {
    stepToward(unit, stats, field, target, goal, Math.min(stats.speed, gap));
    return;
  }
  const { river } = field.arena;
  // A goal on a bridge is reached over that bridge. A unit on another bridge first leaves it as below.
  const goalBridge = bridgeUnder(field.arena, goal);
  if (goalBridge !== null && (!inBand(river, unit.y) || overBridge(goalBridge, unit.x))) {
    const end = bridgeEnd(unit, stats, river, goalBridge);
    stepToward(unit, stats, field, target, end ?? goal, end === null ? Math.min(stats.speed, gap) : stats.speed);
    return;
  }
  // Which way the unit crosses the river to reach its goal, and the banks on the way.
  const forward = goal.y * 2 >= river.y * 2 + river.height ? 1 : -1;
  const [nearBank, farBank] = forward === 1 ? [river.y, river.y + river.height] : [river.y + river.height, river.y];
  const before = (line: number) => (unit.y - line) * forward < 0;
  if (before(farBank)) {
    stepToward(unit, stats, field, target, bridgeWaypoint(unit, stats, field.arena, nearBank, farBank, before(nearBank)), stats.speed);
    return;
  }
  stepToward(unit, stats, field, target, goal, Math.min(stats.speed, gap));
}

/** Moves `unit` toward `to`: on the ground around every standing tower but the one it's going for, in the air over them. */
function stepToward(unit: Unit, stats: UnitStats, field: Field, target: Target, to: Point, length: number): void {
  const blocking = stats.layer === 'ground' ? field.towers.filter((tower) => tower.hp > 0 && tower.id !== target.entity.id) : [];
  const obstacles = blocking.map(footprint);
  const body = { x: unit.x, y: unit.y, radius: stats.radius, mass: stats.mass };
  walk(body, to, length, obstacles, field.arena);
  unit.x = body.x;
  unit.y = body.y;
}

/**
 * Before the river: the bridge entrance of the unit's lane, straight ahead where it can be.
 * On the bridge: straight across.
 */
function bridgeWaypoint(unit: Unit, stats: UnitStats, arena: Terrain, nearBank: number, farBank: number, beforeRiver: boolean): Point {
  const lane = unit.x < arena.width / 2 ? 'left' : 'right';
  const bridge = arena.bridges.find((candidate) => candidate.lane === lane) ?? arena.bridges[0];
  if (bridge === undefined) {
    throw new RangeError('The arena has no bridge');
  }
  const [minX, maxX] = bridgeSpan(bridge, stats);
  const onBridgeX = unit.x >= minX && unit.x <= maxX;
  if (beforeRiver || !onBridgeX) {
    return { x: clamp(unit.x, minX, maxX), y: nearBank };
  }
  return { x: unit.x, y: farBank };
}

/**
 * Toward a goal on `bridge`: from a bank, that bridge's end on the unit's bank, straight ahead where it
 * can be. `null` once the unit is there or on the bridge: a bridge is a rectangle, so straight at the goal stays on it.
 */
function bridgeEnd(unit: Unit, stats: UnitStats, river: Rect, bridge: Rect): Point | null {
  if (inBand(river, unit.y)) {
    return null;
  }
  const [minX, maxX] = bridgeSpan(bridge, stats);
  const end = { x: clamp(unit.x, minX, maxX), y: unit.y < river.y ? river.y : river.y + river.height };
  return end.x === unit.x && end.y === unit.y ? null : end;
}

/** Where a unit's center walks on a bridge: a radius in from each side, or the middle if the bridge is too narrow. */
function bridgeSpan(bridge: Rect, stats: UnitStats): [number, number] {
  const center = bridge.x + Math.floor(bridge.width / 2);
  return bridge.width > stats.radius * 2 ? [bridge.x + stats.radius, bridge.x + bridge.width - stats.radius] : [center, center];
}

/** The bridge a point in the river stands on, or `null` for a point on a bank. */
function bridgeUnder(arena: Terrain, point: Point): Rect | null {
  if (!inBand(arena.river, point.y)) {
    return null;
  }
  return arena.bridges.find((bridge) => overBridge(bridge, point.x)) ?? null;
}

/** Whether `y` is across the river's band, banks excluded on the far side: [river.y, river.y + height). */
function inBand(river: Rect, y: number): boolean {
  return y >= river.y && y < river.y + river.height;
}

/** Whether `x` is within the bridge's width, edges included (as the invariant counts them). */
function overBridge(bridge: Rect, x: number): boolean {
  return x >= bridge.x && x <= bridge.x + bridge.width;
}

/**
 * The nearest valid enemy whose edge is within sight (towers first on a tie, then the lower id): a
 * tower, or a unit on a layer its filter reaches. With none, the nearest standing enemy tower by
 * center. A `buildings` unit only ever takes the latter.
 */
function acquire(unit: Unit, stats: UnitStats, field: Field): Target | null {
  if (stats.targets !== 'buildings') {
    const candidates: Target[] = [];
    for (const tower of field.towers) {
      if (tower.side !== unit.side && tower.hp > 0) {
        candidates.push({ kind: 'tower', entity: tower });
      }
    }
    for (const other of field.units) {
      const otherStats = unitStats(field, other);
      if (other.side !== unit.side && other.hp > 0 && canTarget(stats.targets, otherStats.layer)) {
        candidates.push({ kind: 'unit', entity: other, radius: otherStats.radius });
      }
    }
    let best: Target | null = null;
    let bestGap = 0;
    for (const candidate of candidates) {
      const gap = gapTo(unit, stats, candidate);
      if (gap <= stats.sight && (best === null || gap < bestGap)) {
        best = candidate;
        bestGap = gap;
      }
    }
    if (best !== null) {
      return best;
    }
  }
  const tower = nearestEnemyTower(unit, field.towers);
  return tower === null ? null : { kind: 'tower', entity: tower };
}

/** A standing tower or living unit with this id, or `null`. */
function findTarget(field: Field, id: number): Target | null {
  for (const tower of field.towers) {
    if (tower.id === id) {
      return tower.hp > 0 ? { kind: 'tower', entity: tower } : null;
    }
  }
  for (const other of field.units) {
    if (other.id === id) {
      return other.hp > 0 ? { kind: 'unit', entity: other, radius: unitStats(field, other).radius } : null;
    }
  }
  return null;
}

/** Edge to edge, from the unit's circle to the target's footprint or circle; 0 when they overlap. */
function gapTo(unit: Unit, stats: UnitStats, target: Target): number {
  if (target.kind === 'tower') {
    return Math.max(0, distanceToRect(unit, footprint(target.entity)) - stats.radius);
  }
  const [dx, dy] = [target.entity.x - unit.x, target.entity.y - unit.y];
  return Math.max(0, isqrt(dx * dx + dy * dy) - stats.radius - target.radius);
}

/** The nearest standing enemy tower by center distance (compared squared, so exactly); the lower id on a tie. */
function nearestEnemyTower(unit: Unit, towers: readonly Tower[]): Tower | null {
  let best: Tower | null = null;
  let bestDistance = 0;
  for (const tower of towers) {
    if (tower.side === unit.side || tower.hp <= 0) {
      continue;
    }
    const [dx, dy] = [tower.x - unit.x, tower.y - unit.y];
    const d = dx * dx + dy * dy;
    if (best === null || d < bestDistance) {
      best = tower;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * One tick of a standing tower: keep hitting its target while that stays in range, else lock on to the
 * nearest enemy unit in range (the lower id on a tie).
 */
export function actTower(tower: Tower, stats: TowerStats, field: Field, hits: Hit[]): void {
  if (tower.hp <= 0 || tower.dormant) {
    return;
  }
  const rect = footprint(tower);
  const gap = (unit: Unit) => Math.max(0, distanceToRect(unit, rect) - unitStats(field, unit).radius);
  const locked = tower.targetId === null ? undefined : field.units.find((unit) => unit.id === tower.targetId && unit.hp > 0);
  if (locked !== undefined && gap(locked) <= stats.range) {
    tower.cooldown -= 1;
    if (tower.cooldown <= 0) {
      hits.push({ targetId: locked.id, damage: stats.damage });
      tower.cooldown = stats.hitTicks;
    }
    return;
  }
  tower.targetId = null;
  let best: Unit | null = null;
  let bestGap = 0;
  for (const unit of field.units) {
    if (unit.side === tower.side || unit.hp <= 0) {
      continue;
    }
    const d = gap(unit);
    if (d <= stats.range && (best === null || d < bestGap)) {
      best = unit;
      bestGap = d;
    }
  }
  if (best !== null) {
    tower.targetId = best.id;
    tower.cooldown = stats.firstHitTicks;
  }
}

/** The unit stats behind a unit, from its card. */
export function unitStats(field: Pick<Field, 'cards'>, unit: Unit): UnitStats {
  const stats = Object.hasOwn(field.cards, unit.card) ? field.cards[unit.card] : undefined;
  if (stats?.type !== 'troop') {
    throw new RangeError(`Unit ${String(unit.id)} comes from ${unit.card}, which is not a troop`);
  }
  return stats.unit;
}
