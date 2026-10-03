import { footprint } from './arena.ts';
import type { CardStats } from './cards.ts';
import type { RejectReason, Side, SimState } from './state.ts';
import { deployZone, inRect } from './troops.ts';

/**
 * Why `side` can't play a card with these stats at (x, y) on this field, or `null` if it can (VISION §4,
 * Deploy zone): the point must be inside the arena; a troop also inside its side's deploy zone and off
 * every standing tower. Energy and the hand are the command's business; this is only about the spot.
 */
export function placementRejection(
  state: Pick<SimState, 'arena' | 'towers'>,
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
  if (!inRect(deployZone(arena, side), x, y)) {
    return 'outside-deploy-zone';
  }
  if (state.towers.some((tower) => tower.hp > 0 && inRect(footprint(tower), x, y))) {
    return 'occupied';
  }
  return null;
}
