import type { Side } from './state.ts';

/** An axis-aligned rectangle in milli-tiles. (x, y) is its low corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The left or right half of the arena, each with one bridge (VISION §9). */
export type Lane = 'left' | 'right';

export interface Bridge extends Rect {
  lane: Lane;
}

export type TowerKind = 'keep' | 'outpost';

/** Where a tower stands. Its stats come separately, as `TowerStats`. */
export interface TowerSite {
  kind: TowerKind;
  side: Side;
  /** The Outpost's lane; `null` for the Keep. */
  lane: Lane | null;
  /** Center, in milli-tiles. */
  x: number;
  y: number;
  /** Edge of the square tile footprint, in milli-tiles. */
  size: number;
}

/** The ground a match is played on: everything in the layout except the towers, which become entities. */
export interface Terrain {
  width: number;
  height: number;
  /** Crosses the full width. Ground units cross it only on a bridge. */
  river: Rect;
  bridges: Bridge[];
}

/**
 * The field (VISION §4), in milli-tiles. The numbers live in `content` (D7); the sim receives them
 * through `MatchSetup`. Side 0 holds the low-y half.
 */
export interface ArenaLayout extends Terrain {
  /** In the order their towers get ids. */
  towers: TowerSite[];
}

/** How something hits (VISION §4). */
export interface AttackStats {
  damage: number;
  /** Milli-tiles around where a hit lands that it also hits; 0 hits the target alone. */
  splash: number;
  /** Milli-tiles per tick a hit flies before it lands; 0 lands at once (melee). */
  projectileSpeed: number;
  /** Ticks between hits once it's attacking. */
  hitTicks: number;
  /** Ticks from locking on to the first hit. At least 1. */
  firstHitTicks: number;
  /** Edge to edge, in milli-tiles: how close it must be to hit. */
  range: number;
}

/** A tower hits the nearest enemy unit in range, and stays locked on while it stays in range. */
export interface TowerStats extends AttackStats {
  hp: number;
}

/** A tower as an entity in the match: its site plus an id, hp and what it's shooting. */
export interface Tower extends TowerSite {
  id: number;
  /** 0 once it has fallen. A fallen tower stays in the list and does nothing. */
  hp: number;
  maxHp: number;
  /** The unit it's locked on to, or `null`. May name a unit that died since; it's dropped on the next act. */
  targetId: number | null;
  /** Ticks until its next hit while locked on. */
  cooldown: number;
  /**
   * A dormant tower doesn't act. The Keep starts dormant and wakes for good at the end of the first tick
   * it has taken damage or one of its own Outposts has fallen (VISION §4). Outposts are never dormant.
   */
  dormant: boolean;
}

/** The square of ground a tower stands on. */
export function footprint({ x, y, size }: Pick<TowerSite, 'x' | 'y' | 'size'>): Rect {
  const half = Math.floor(size / 2);
  return { x: x - half, y: y - half, width: size, height: size };
}
