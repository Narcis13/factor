import type { CardId, SpellStats } from './cards.ts';
import { divRound, squaredDistanceToRect } from './geometry.ts';
import type { Side } from './state.ts';
import { footprint } from './arena.ts';
import { unitStats, type Field, type Hit } from './troops.ts';
import { BASIS_POINTS } from './units.ts';

/** A spell that landed this tick, where it was aimed: kept in the state so the client can show it. */
export interface Blast {
  side: Side;
  card: CardId;
  x: number;
  y: number;
}

/**
 * The hits a spell cast by `side` at (x, y) makes (VISION §4): every standing enemy tower whose footprint
 * its circle touches takes the tower share, every enemy unit whose circle it touches the full damage.
 * Towers first, then units, each in id order. The hits land with the tick's other hits.
 */
export function blastHits(field: Field, side: Side, x: number, y: number, spell: SpellStats, hits: Hit[]): void {
  const { radius, damage, towerDamageBp } = spell;
  const point = { x, y };
  const towerDamage = divRound(damage * towerDamageBp, BASIS_POINTS);
  for (const tower of field.towers) {
    if (tower.side !== side && tower.hp > 0 && squaredDistanceToRect(point, footprint(tower)) <= radius * radius) {
      hits.push({ targetId: tower.id, damage: towerDamage });
    }
  }
  for (const unit of field.units) {
    const reach = radius + unitStats(field, unit).radius;
    const [dx, dy] = [unit.x - x, unit.y - y];
    if (unit.side !== side && unit.hp > 0 && dx * dx + dy * dy <= reach * reach) {
      hits.push({ targetId: unit.id, damage });
    }
  }
}
