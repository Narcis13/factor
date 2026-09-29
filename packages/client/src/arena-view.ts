import { towerFootprint } from '@factor/content';
import { MILLI_PER_TILE, type Rect, type Side, type SimState, type Terrain } from '@factor/sim';

/**
 * How the arena sits on the screen: a whole number of pixels per tile, centered, with side 0 at the
 * bottom as its player sees it. Screen y grows downward; arena y grows toward side 1.
 */
export interface View {
  tilePx: number;
  /** Screen position of the arena's top-left corner, in CSS pixels. */
  left: number;
  top: number;
  /** The arena's height in milli-tiles, needed to flip y. */
  arenaHeight: number;
}

/** A rectangle on the screen, in CSS pixels. (x, y) is its top-left corner. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GroundKind = 'tile-light' | 'tile-dark' | 'river' | 'bridge';

/** Something to draw. Towers carry their owner; the ground belongs to no one. */
export type Shape = { kind: GroundKind; rect: ScreenRect } | { kind: 'keep' | 'outpost'; side: Side; rect: ScreenRect };

/** The largest whole tile size that fits the arena on a screen, at least 1 px. */
export function fitView(arena: Terrain, screenWidth: number, screenHeight: number): View {
  const columns = arena.width / MILLI_PER_TILE;
  const rows = arena.height / MILLI_PER_TILE;
  const tilePx = Math.max(1, Math.floor(Math.min(screenWidth / columns, screenHeight / rows)));
  return {
    tilePx,
    left: Math.floor((screenWidth - columns * tilePx) / 2),
    top: Math.floor((screenHeight - rows * tilePx) / 2),
    arenaHeight: arena.height,
  };
}

/** An arena rectangle (milli-tiles, y up) on the screen (pixels, y down). */
export function toScreen(view: View, rect: Rect): ScreenRect {
  const scale = view.tilePx / MILLI_PER_TILE;
  return {
    x: view.left + rect.x * scale,
    y: view.top + (view.arenaHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Everything a match state draws, back to front: a checkerboard of tiles, the river, bridges, then the
 * towers standing in `state` (not the layout's sites, so the picture follows the sim).
 */
export function arenaScene(state: Pick<SimState, 'arena' | 'towers'>, view: View): Shape[] {
  const { arena, towers } = state;
  const shapes: Shape[] = [];
  for (let row = 0; row < arena.height / MILLI_PER_TILE; row++) {
    for (let col = 0; col < arena.width / MILLI_PER_TILE; col++) {
      const tile = { x: col * MILLI_PER_TILE, y: row * MILLI_PER_TILE, width: MILLI_PER_TILE, height: MILLI_PER_TILE };
      const kind = (row + col) % 2 === 0 ? 'tile-dark' : 'tile-light';
      shapes.push({ kind, rect: toScreen(view, tile) });
    }
  }
  shapes.push({ kind: 'river', rect: toScreen(view, arena.river) });
  for (const bridge of arena.bridges) {
    shapes.push({ kind: 'bridge', rect: toScreen(view, bridge) });
  }
  for (const tower of towers) {
    shapes.push({ kind: tower.kind, side: tower.side, rect: toScreen(view, towerFootprint(tower)) });
  }
  return shapes;
}
