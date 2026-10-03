import { footprint } from './arena.ts';
import type { CardStats } from './cards.ts';
import { squaredDistanceToRect } from './geometry.ts';
import type { RejectReason, Side, SimState } from './state.ts';
import { deployZones, inRect, isBuilding, unitStats } from './troops.ts';

/**
 * Why `side` can't play a card with these stats at (x, y) on this field, or `null` if it can (VISION §4,
 * Deploy zone): the point must be inside the arena; a troop or building also inside one of its side's
 * deploy zones (its half, and lanes opened by fallen enemy Outposts) and off every standing tower, and a building's circle clear of every standing tower's footprint
 * and every other building's circle. Energy and the hand are the command's business; this is only
 * about the spot.
 */
export function placementRejection(
  state: Pick<SimState, 'arena' | 'towers' | 'units' | 'cards'>,
  side: Side,
  stats: CardStats,
  x: number,
  y: number,
): Extract<RejectReason, 'out-of-bounds' | 'outside-deploy-zone' | 'occupied'> | null {
  const { arena } = state;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || x >= arena.width || y < 0 || y >= arena.height) {
    return 'out-of-bounds';
  }
  if (stats.type === 'spell') {
    return null;
  }
  if (!deployZones(state, side).some((zone) => inRect(zone, x, y))) {
    return 'outside-deploy-zone';
  }
  if (state.towers.some((tower) => tower.hp > 0 && inRect(footprint(tower), x, y))) {
    return 'occupied';
  }
  if (stats.type === 'building') {
    const { radius } = stats.unit;
    if (x < radius || x > arena.width - radius || y < radius || y > arena.height - radius) {
      // It never moves, so all of it must stand inside the arena.
      return 'out-of-bounds';
    }
    const point = { x, y };
    if (state.towers.some((tower) => tower.hp > 0 && squaredDistanceToRect(point, footprint(tower)) < radius * radius)) {
      return 'occupied';
    }
    for (const other of state.units) {
      const reach = radius + unitStats(state, other).radius;
      const [dx, dy] = [other.x - x, other.y - y];
      if (isBuilding(state, other) && dx * dx + dy * dy < reach * reach) {
        return 'occupied';
      }
    }
  }
  return null;
}
