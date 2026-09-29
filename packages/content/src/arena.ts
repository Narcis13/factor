import { MILLI_PER_TILE, type Side } from '@factor/sim';

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

/** Where a tower stands. Its stats (hp, damage, range) are tuned separately. */
export interface TowerSite {
  kind: 'keep' | 'outpost';
  side: Side;
  /** The Outpost's lane; `null` for the Keep. */
  lane: Lane | null;
  /** Center, in milli-tiles. */
  x: number;
  y: number;
  /** Edge of the square tile footprint, in milli-tiles. */
  size: number;
}

/**
 * The field (VISION §4), in milli-tiles. Side 0 holds the low-y half; side 1 holds the other half,
 * mirrored across the river (y → height − y), so neither side's layout is better.
 */
export interface ArenaLayout {
  width: number;
  height: number;
  /** Crosses the full width. Ground units cross it only on a bridge. */
  river: Rect;
  bridges: Bridge[];
  /** Side 0's Keep and Outposts (left, right), then side 1's in the same order. */
  towers: TowerSite[];
}

const WIDTH = tiles(18);
const HEIGHT = tiles(32);
const RIVER_HEIGHT = tiles(2);
const LANE_X: Record<Lane, number> = { left: tiles(3.5), right: tiles(14.5) };

const SIDE_0_TOWERS: TowerSite[] = [
  { kind: 'keep', side: 0, lane: null, x: WIDTH / 2, y: tiles(3), size: tiles(4) },
  { kind: 'outpost', side: 0, lane: 'left', x: LANE_X.left, y: tiles(6.5), size: tiles(3) },
  { kind: 'outpost', side: 0, lane: 'right', x: LANE_X.right, y: tiles(6.5), size: tiles(3) },
];

export const ARENA: ArenaLayout = {
  width: WIDTH,
  height: HEIGHT,
  river: { x: 0, y: (HEIGHT - RIVER_HEIGHT) / 2, width: WIDTH, height: RIVER_HEIGHT },
  bridges: (['left', 'right'] as const).map((lane) => ({
    lane,
    x: LANE_X[lane] - tiles(1.5),
    y: (HEIGHT - RIVER_HEIGHT) / 2,
    width: tiles(3),
    height: RIVER_HEIGHT,
  })),
  towers: [...SIDE_0_TOWERS, ...SIDE_0_TOWERS.map((site) => ({ ...site, side: 1 as const, y: HEIGHT - site.y }))],
};

/** Tiles to milli-tiles, refusing anything that isn't a whole number of milli-tiles. */
function tiles(count: number): number {
  const milli = count * MILLI_PER_TILE;
  if (!Number.isSafeInteger(milli)) {
    throw new RangeError(`${String(count)} tiles is not a whole number of milli-tiles`);
  }
  return milli;
}
