import type { Rect, Terrain, Tower, TowerStats } from './arena.ts';
import type { CardId, CardStats, UnitStats } from './cards.ts';
import { clamp, distanceToRect, isqrt, moveToward, type Point } from './geometry.ts';
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
 * and walks toward it if not: over its lane's bridge when the river is in the way.
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
  const { river } = field.arena;
  const goal = target.entity;
  // Which way the unit crosses the river to reach its goal, and the banks on the way.
  const forward = goal.y * 2 >= river.y * 2 + river.height ? 1 : -1;
  const [nearBank, farBank] = forward === 1 ? [river.y, river.y + river.height] : [river.y + river.height, river.y];
  const before = (line: number) => (unit.y - line) * forward < 0;
  if (before(farBank)) {
    moveToward(unit, bridgeWaypoint(unit, stats, field.arena, nearBank, farBank, before(nearBank)), stats.speed);
    return;
  }
  moveToward(unit, goal, Math.min(stats.speed, gap));
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
  const center = bridge.x + Math.floor(bridge.width / 2);
  const [minX, maxX] = bridge.width > stats.radius * 2 ? [bridge.x + stats.radius, bridge.x + bridge.width - stats.radius] : [center, center];
  const onBridgeX = unit.x >= minX && unit.x <= maxX;
  if (beforeRiver || !onBridgeX) {
    return { x: clamp(unit.x, minX, maxX), y: nearBank };
  }
  return { x: unit.x, y: farBank };
}

/**
 * The nearest valid enemy whose edge is within sight (towers first on a tie, then the lower id); with
 * none, the nearest standing enemy tower by center. A `buildings` unit only ever takes the latter.
 */
function acquire(unit: Unit, stats: UnitStats, field: Field): Target | null {
  if (stats.targets === 'ground') {
    const candidates: Target[] = [];
    for (const tower of field.towers) {
      if (tower.side !== unit.side && tower.hp > 0) {
        candidates.push({ kind: 'tower', entity: tower });
      }
    }
    for (const other of field.units) {
      if (other.side !== unit.side && other.hp > 0) {
        candidates.push({ kind: 'unit', entity: other, radius: unitStats(field, other).radius });
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
  if (tower.hp <= 0) {
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

export function footprint({ x, y, size }: Pick<Tower, 'x' | 'y' | 'size'>): Rect {
  const half = Math.floor(size / 2);
  return { x: x - half, y: y - half, width: size, height: size };
}
