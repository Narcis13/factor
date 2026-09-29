import type { Rect, Terrain, Tower } from './arena.ts';
import type { CardId, UnitStats } from './cards.ts';
import { clamp, distanceToRect, moveToward, type Point } from './geometry.ts';
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

/**
 * One tick of a deployed unit: count down its deploy delay, or walk (VISION §4, Movement). A ground
 * unit follows its lane (by its x) to that lane's bridge, crosses it, then heads for the nearest
 * enemy tower and stops once its edge is within `range` of the tower's footprint.
 */
export function actUnit(unit: Unit, stats: UnitStats, arena: Terrain, towers: readonly Tower[]): void {
  if (unit.deployTicks > 0) {
    unit.deployTicks -= 1;
    return;
  }
  const { river } = arena;
  // The river bank a unit reaches first, and the one it leaves the bridge from, for its side.
  const [nearBank, farBank] = unit.side === 0 ? [river.y, river.y + river.height] : [river.y + river.height, river.y];
  const forward = unit.side === 0 ? 1 : -1;
  const before = (line: number) => (unit.y - line) * forward < 0;
  if (before(farBank)) {
    moveToward(unit, bridgeWaypoint(unit, stats, arena, nearBank, before(nearBank)), stats.speed);
    return;
  }
  const target = nearestEnemyTower(unit, towers);
  if (target === null) {
    return;
  }
  const gap = distanceToRect(unit, footprint(target)) - (stats.radius + stats.range);
  if (gap > 0) {
    moveToward(unit, target, Math.min(stats.speed, gap));
  }
}

/**
 * Before the river: the bridge entrance of the unit's lane, straight ahead where it can be.
 * On the bridge: straight across.
 */
function bridgeWaypoint(unit: Unit, stats: UnitStats, arena: Terrain, nearBank: number, beforeRiver: boolean): Point {
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
  const farBank = unit.side === 0 ? arena.river.y + arena.river.height : arena.river.y;
  return { x: unit.x, y: farBank };
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

function footprint({ x, y, size }: Tower): Rect {
  const half = Math.floor(size / 2);
  return { x: x - half, y: y - half, width: size, height: size };
}
