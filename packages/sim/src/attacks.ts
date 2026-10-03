import { footprint, type Tower } from './arena.ts';
import { canTarget, type TargetFilter } from './cards.ts';
import { moveToward, squaredDistanceToRect, type Point } from './geometry.ts';
import type { Side } from './state.ts';
import { isBuilding, unitStats, type Field, type Hit, type Unit } from './troops.ts';

/**
 * An attack decided this tick (VISION §4, unit stats): a tower or unit at (x, y) hitting `targetId`.
 * With no projectile speed it lands at once; otherwise it flies as a `Projectile`.
 */
export interface Strike {
  side: Side;
  x: number;
  y: number;
  targetId: number;
  damage: number;
  /** In milli-tiles around where it lands; 0 hits the target alone. */
  splash: number;
  /** Milli-tiles per tick; 0 lands at once. */
  projectileSpeed: number;
  /** What its splash may hit besides towers. */
  targets: TargetFilter;
}

/**
 * A shot in flight. It homes on its target while that stands, else flies on to where the target was
 * last, and lands when it gets there: on the target, and on everything its splash reaches.
 */
export interface Projectile {
  /** Shares the id sequence with towers and units. */
  id: number;
  side: Side;
  /** Where it is, in milli-tiles. */
  x: number;
  y: number;
  targetId: number;
  /** Where its target was when last seen: where it lands if the target falls first. */
  toX: number;
  toY: number;
  speed: number;
  damage: number;
  splash: number;
  targets: TargetFilter;
}

/** A splash that landed this tick, kept in the state so the client can show it. */
export interface Splash {
  side: Side;
  x: number;
  y: number;
  radius: number;
}

/** The fields an attack works on: the field, plus where shots and splashes go. */
export interface Battle extends Field {
  projectiles: Projectile[];
  splashes: Splash[];
  nextId: number;
}

/**
 * Moves every projectile fired before this tick toward its target, in id order, and lands those that
 * arrive: their hits join `hits`.
 */
export function flyProjectiles(battle: Battle, hits: Hit[]): void {
  const flying: Projectile[] = [];
  for (const shot of battle.projectiles) {
    const target = standing(battle, shot.targetId);
    if (target !== null) {
      shot.toX = target.x;
      shot.toY = target.y;
    }
    moveToward(shot, { x: shot.toX, y: shot.toY }, shot.speed);
    if (shot.x === shot.toX && shot.y === shot.toY) {
      land(battle, shot, { x: shot.toX, y: shot.toY }, hits);
    } else {
      flying.push(shot);
    }
  }
  battle.projectiles = flying;
}

/**
 * Turns this tick's strikes into hits, in order: one with a projectile speed starts flying from its
 * attacker (from the next tick on); one without lands now, on its target where it stands.
 */
export function resolveStrikes(battle: Battle, strikes: readonly Strike[], hits: Hit[]): void {
  for (const strike of strikes) {
    const target = standing(battle, strike.targetId);
    if (strike.projectileSpeed > 0) {
      const to = target ?? strike;
      battle.projectiles.push({
        id: battle.nextId,
        side: strike.side,
        x: strike.x,
        y: strike.y,
        targetId: strike.targetId,
        toX: to.x,
        toY: to.y,
        speed: strike.projectileSpeed,
        damage: strike.damage,
        splash: strike.splash,
        targets: strike.targets,
      });
      battle.nextId += 1;
    } else if (target !== null) {
      land(battle, strike, target, hits);
    }
  }
}

/**
 * The hits of an attack landing at `point`: without splash, its target alone if it still stands; with
 * splash, every enemy tower whose footprint and every enemy unit its filter reaches whose circle the
 * splash touches, towers first, then units, in id order. A splash is recorded for the client.
 */
function land(battle: Battle, attack: Pick<Strike, 'side' | 'targetId' | 'damage' | 'splash' | 'targets'>, point: Point, hits: Hit[]): void {
  const { side, targetId, damage, splash, targets } = attack;
  if (splash === 0) {
    if (standing(battle, targetId) !== null) {
      hits.push({ targetId, damage });
    }
    return;
  }
  battle.splashes.push({ side, x: point.x, y: point.y, radius: splash });
  for (const tower of battle.towers) {
    if (tower.side !== side && tower.hp > 0 && squaredDistanceToRect(point, footprint(tower)) <= splash * splash) {
      hits.push({ targetId: tower.id, damage });
    }
  }
  for (const unit of battle.units) {
    const stats = unitStats(battle, unit);
    const reach = splash + stats.radius;
    const [dx, dy] = [unit.x - point.x, unit.y - point.y];
    if (unit.side !== side && unit.hp > 0 && canTarget(targets, stats.layer, isBuilding(battle, unit)) && dx * dx + dy * dy <= reach * reach) {
      hits.push({ targetId: unit.id, damage });
    }
  }
}

/** The standing tower or living unit with this id, or `null`. */
function standing(field: Field, id: number): Tower | Unit | null {
  return field.towers.find((tower) => tower.id === id && tower.hp > 0) ?? field.units.find((unit) => unit.id === id && unit.hp > 0) ?? null;
}
