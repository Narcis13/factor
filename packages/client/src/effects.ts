import { MILLI_PER_TILE, TICKS_PER_SECOND, type CardId, type Side, type SimState } from '@factor/sim';
import { pointToScreen, type UnitShape, type View } from './arena-view.ts';

/**
 * Something that happened between two ticks, worth a brief mark on screen (placeholder hit effects until
 * there is art): a unit or tower that took damage flashes, a unit that died leaves a puff. (Splashes have
 * their own rings.) Read off the change from one state to the next, so the sim records nothing for them.
 */
export interface Effect {
  kind: 'flash' | 'death';
  /** The tick of the state it showed up in. */
  tick: number;
  /** Who it happened to. */
  id: number;
  side: Side;
  /** Where, in milli-tiles, and how big. */
  x: number;
  y: number;
  radius: number;
  /** The unit's card, or a tower kind for a tower. */
  card: CardId;
}

/** How long an effect stays on screen: 0.3 s. */
export const EFFECT_TICKS = (3 * TICKS_PER_SECOND) / 10;

/** The effects of going from `previous` to `current`, in order: flashes (towers, then units), then deaths. */
export function effectsBetween(previous: SimState, current: SimState): Effect[] {
  const tick = current.tick;
  const effects: Effect[] = [];
  for (const tower of current.towers) {
    const before = previous.towers.find((candidate) => candidate.id === tower.id);
    if (before !== undefined && tower.hp < before.hp) {
      effects.push({ kind: 'flash', tick, id: tower.id, side: tower.side, x: tower.x, y: tower.y, radius: Math.floor(tower.size / 2), card: tower.kind });
    }
  }
  const after = new Map(current.units.map((unit) => [unit.id, unit]));
  for (const unit of previous.units) {
    const now = after.get(unit.id);
    if (now !== undefined && now.hp < unit.hp) {
      effects.push({ kind: 'flash', tick, id: unit.id, side: unit.side, x: now.x, y: now.y, radius: radiusOf(current, unit.card), card: unit.card });
    }
  }
  for (const unit of previous.units) {
    if (!after.has(unit.id)) {
      effects.push({ kind: 'death', tick, id: unit.id, side: unit.side, x: unit.x, y: unit.y, radius: radiusOf(previous, unit.card), card: unit.card });
    }
  }
  return effects;
}

function radiusOf(state: SimState, card: CardId): number {
  const stats = state.cards[card];
  return stats === undefined || stats.type === 'spell' ? MILLI_PER_TILE / 2 : stats.unit.radius;
}

/** An effect on the screen: where, how big, and how far it has faded (1 new, toward 0 gone). */
export interface EffectShape {
  kind: Effect['kind'];
  side: Side;
  x: number;
  y: number;
  radius: number;
  fade: number;
  /** A tower's flash covers its square footprint. */
  square: boolean;
}

/**
 * Recent effects on the screen, each fading over `EFFECT_TICKS` from the moment it showed (tick + alpha).
 * A flash follows its unit where it's drawn now (`units`); a puff stays where the unit died and grows a
 * little as it fades.
 */
export function effectScene(effects: readonly Effect[], current: Pick<SimState, 'tick' | 'towers'>, alpha: number, view: View, units: readonly UnitShape[]): EffectShape[] {
  const scale = view.tilePx / MILLI_PER_TILE;
  const shapes: EffectShape[] = [];
  for (const effect of effects) {
    const fade = 1 - (current.tick - effect.tick + alpha) / EFFECT_TICKS;
    if (fade <= 0) {
      continue;
    }
    const square = effect.kind === 'flash' && current.towers.some((tower) => tower.id === effect.id);
    const drawn = effect.kind === 'flash' ? units.find((unit) => unit.id === effect.id) : undefined;
    const at = drawn ?? pointToScreen(view, effect.x, effect.y);
    const grow = effect.kind === 'flash' ? 1 : 1 + (1 - Math.min(1, fade)) / 3;
    shapes.push({ kind: effect.kind, side: effect.side, x: at.x, y: at.y, radius: effect.radius * scale * grow, fade: Math.min(1, fade), square });
  }
  return shapes;
}
