import { MILLI_PER_TILE, type ArenaLayout, type Lane, type Rect, type TowerSite } from '@factor/sim';

const WIDTH = tiles(18);
const HEIGHT = tiles(32);
const RIVER_HEIGHT = tiles(2);
const LANE_X: Record<Lane, number> = { left: tiles(3.5), right: tiles(14.5) };

const SIDE_0_TOWERS: TowerSite[] = [
  { kind: 'keep', side: 0, lane: null, x: WIDTH / 2, y: tiles(3), size: tiles(4) },
  { kind: 'outpost', side: 0, lane: 'left', x: LANE_X.left, y: tiles(6.5), size: tiles(3) },
  { kind: 'outpost', side: 0, lane: 'right', x: LANE_X.right, y: tiles(6.5), size: tiles(3) },
];

/**
 * The field (VISION §4). Side 1's half mirrors side 0's across the river (y → height − y),
 * so neither side's layout is better. Towers: side 0's Keep and Outposts (left, right), then side 1's.
 */
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

/** The square of ground a tower stands on: a site's, or a tower entity's. */
export function towerFootprint(site: Pick<TowerSite, 'x' | 'y' | 'size'>): Rect {
  const half = site.size / 2;
  return { x: site.x - half, y: site.y - half, width: site.size, height: site.size };
}

/** Tiles to milli-tiles, refusing anything that isn't a whole number of milli-tiles. */
function tiles(count: number): number {
  const milli = count * MILLI_PER_TILE;
  if (!Number.isSafeInteger(milli)) {
    throw new RangeError(`${String(count)} tiles is not a whole number of milli-tiles`);
  }
  return milli;
}
