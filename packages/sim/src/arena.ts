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

export interface TowerStats {
  hp: number;
}

/** A tower as an entity in the match: its site plus an id and hp. */
export interface Tower extends TowerSite {
  id: number;
  hp: number;
  maxHp: number;
}
