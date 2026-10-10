import { MILLI_PER_TILE, TICKS_PER_SECOND, type CardId, type Side, type SimState } from '@factor/sim';

/**
 * Something that happened between two ticks, worth a mark on screen: a unit or tower that took damage
 * flashes, a unit that died leaves a puff of smoke, a unit that arrived raises a ring of dust, a tower
 * that fell blows up, and a shot that was fired shows from where (a bomb arcs from there, a tower's
 * weapon flashes). Read off the change from one state to the next, so the sim records nothing for them.
 */
export interface Effect {
  kind: 'flash' | 'death' | 'deploy' | 'fall' | 'shot';
  /** The tick of the state it showed up in. */
  tick: number;
  /** Who it happened to: the unit, the tower, or the shot. */
  id: number;
  side: Side;
  /** Where, in milli-tiles, and how big. */
  x: number;
  y: number;
  radius: number;
  /** The unit's card, a tower kind for a tower, or for a shot, who fired it. */
  card: CardId;
}

/** How long a hit's flash stays on screen: 0.3 s. */
export const EFFECT_TICKS = (3 * TICKS_PER_SECOND) / 10;

/** How long each kind of effect lasts, in ticks: the flash, then the longer animations. */
export const EFFECT_LIFE: Record<Effect['kind'], number> = {
  flash: EFFECT_TICKS,
  death: TICKS_PER_SECOND / 2,
  deploy: (4 * TICKS_PER_SECOND) / 5,
  fall: (3 * TICKS_PER_SECOND) / 2,
  // Long enough to outlive any shot's flight, so its origin is known until it lands.
  shot: 3 * TICKS_PER_SECOND,
};

/**
 * The effects of going from `previous` to `current`, in order: flashes (towers, then units), deaths,
 * then arrivals, fallen towers and new shots.
 */
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
  const before = new Set(previous.units.map((unit) => unit.id));
  for (const unit of current.units) {
    if (!before.has(unit.id)) {
      effects.push({ kind: 'deploy', tick, id: unit.id, side: unit.side, x: unit.x, y: unit.y, radius: radiusOf(current, unit.card), card: unit.card });
    }
  }
  for (const tower of current.towers) {
    const was = previous.towers.find((candidate) => candidate.id === tower.id);
    if (was !== undefined && was.hp > 0 && tower.hp === 0) {
      effects.push({ kind: 'fall', tick, id: tower.id, side: tower.side, x: tower.x, y: tower.y, radius: Math.floor(tower.size / 2), card: tower.kind });
    }
  }
  const flying = new Set(previous.projectiles.map((shot) => shot.id));
  for (const shot of current.projectiles) {
    if (!flying.has(shot.id)) {
      effects.push({ kind: 'shot', tick, id: shot.id, side: shot.side, x: shot.x, y: shot.y, radius: shot.splash, card: shooter(previous, shot) });
    }
  }
  return effects;
}

/**
 * Who fired a shot: the tower or unit of its side standing where it started (shots start at their
 * attacker), else whichever card shoots at its speed and damage.
 */
function shooter(state: SimState, shot: SimState['projectiles'][number]): CardId {
  const tower = state.towers.find((candidate) => candidate.side === shot.side && candidate.x === shot.x && candidate.y === shot.y);
  if (tower !== undefined) {
    return tower.kind;
  }
  const unit = state.units.find((candidate) => candidate.side === shot.side && candidate.x === shot.x && candidate.y === shot.y);
  if (unit !== undefined) {
    return unit.card;
  }
  for (const [card, stats] of Object.entries(state.cards)) {
    if (stats.type !== 'spell' && stats.unit.projectileSpeed === shot.speed && stats.unit.damage === shot.damage) {
      return card;
    }
  }
  return 'outpost';
}

function radiusOf(state: SimState, card: CardId): number {
  const stats = state.cards[card];
  return stats === undefined || stats.type === 'spell' ? MILLI_PER_TILE / 2 : stats.unit.radius;
}
