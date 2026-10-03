import { towerFootprint } from '@factor/content';
import { deployZone, MILLI_PER_TILE, type Blast, type CardId, type Rect, type Side, type SimState, type Splash, type Terrain } from '@factor/sim';

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

/** Something to draw. Towers carry their owner and whether they've fallen; the ground belongs to no one. */
export type Shape =
  | { kind: GroundKind; rect: ScreenRect }
  | { kind: 'keep' | 'outpost'; side: Side; rect: ScreenRect; fallen: boolean };

/** How much hp something has left, as a bar on the screen: `fraction` of it filled in its side's color. */
export interface HpBar {
  side: Side;
  rect: ScreenRect;
  /** In [0, 1]. */
  fraction: number;
}

/** How far above its shadow a flying unit is drawn, in its radii. */
export const FLY_LIFT = 0.9;

/** A unit on the screen: a circle, in CSS pixels. */
export interface UnitShape {
  id: number;
  side: Side;
  card: CardId;
  x: number;
  y: number;
  radius: number;
  /** Still waiting out its deploy delay. */
  deploying: boolean;
  /** A flying unit: drawn over the ground units, lifted above its shadow. */
  flying: boolean;
  hp: number;
  maxHp: number;
}

/** A landed spell on the screen: its area as a circle, fading out as `fade` falls from 1 toward 0. */
export interface BlastShape {
  side: Side;
  card: CardId;
  x: number;
  y: number;
  radius: number;
  fade: number;
}

/** A shot in flight on the screen: a dot in its side's color, bigger for a splash shell. */
export interface ProjectileShape {
  side: Side;
  x: number;
  y: number;
  radius: number;
}

/** A splash that landed: a ring of its radius, fading out as `fade` falls from 1 toward 0. */
export interface SplashShape {
  side: Side;
  x: number;
  y: number;
  radius: number;
  fade: number;
}

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

/** A point in the arena (milli-tiles, y up) on the screen (pixels, y down). */
export function pointToScreen(view: View, x: number, y: number): { x: number; y: number } {
  const scale = view.tilePx / MILLI_PER_TILE;
  return { x: view.left + x * scale, y: view.top + (view.arenaHeight - y) * scale };
}

/**
 * Everything a match state draws, back to front: a checkerboard of tiles, the river, bridges, then the
 * towers standing in `state` (not the layout's sites, so the picture follows the sim).
 */
export function arenaScene(state: Pick<SimState, 'arena' | 'towers'>, view: View): Shape[] {
  return [...groundScene(state.arena, view), ...towerScene(state, view)];
}

/** The ground: it never changes during a match, so it is drawn once per screen size. */
export function groundScene(arena: Terrain, view: View): Shape[] {
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
  return shapes;
}

export function towerScene(state: Pick<SimState, 'towers'>, view: View): Shape[] {
  return state.towers.map((tower) => ({
    kind: tower.kind,
    side: tower.side,
    rect: toScreen(view, towerFootprint(tower)),
    fallen: tower.hp === 0,
  }));
}

/**
 * Hp bars, just above what they measure: every standing tower's (as wide as it is), and every damaged
 * unit's (as wide as its circle). A full-hp unit shows none, so the field stays readable.
 */
export function hpBarScene(state: Pick<SimState, 'towers'>, units: readonly UnitShape[], view: View): HpBar[] {
  const height = Math.max(3, Math.round(view.tilePx / 6));
  const gap = Math.max(1, Math.round(height / 2));
  const bars: HpBar[] = [];
  for (const tower of state.towers) {
    if (tower.hp > 0) {
      const { x, y, width } = toScreen(view, towerFootprint(tower));
      bars.push({ side: tower.side, rect: { x, y: y - gap - height, width, height }, fraction: tower.hp / tower.maxHp });
    }
  }
  for (const unit of units) {
    if (unit.hp < unit.maxHp) {
      const top = unit.y - unit.radius - (unit.flying ? unit.radius * FLY_LIFT : 0);
      const rect = { x: unit.x - unit.radius, y: top - gap - height, width: unit.radius * 2, height };
      bars.push({ side: unit.side, rect, fraction: unit.hp / unit.maxHp });
    }
  }
  return bars;
}

/**
 * Units, `alpha` of the way from where they stood in `previous` to where they stand in `current`
 * (VISION §5). A unit new in `current` shows where it is. Ground units come first, then flying ones,
 * so flyers are drawn on top.
 */
export function unitScene(previous: SimState, current: SimState, alpha: number, view: View): UnitShape[] {
  const before = new Map(previous.units.map((unit) => [unit.id, unit]));
  const scale = view.tilePx / MILLI_PER_TILE;
  const shapes = current.units.map((unit): UnitShape => {
    const from = before.get(unit.id) ?? unit;
    const x = from.x + (unit.x - from.x) * alpha;
    const y = from.y + (unit.y - from.y) * alpha;
    const stats = current.cards[unit.card];
    const radius = stats?.type === 'troop' ? stats.unit.radius * scale : scale * MILLI_PER_TILE / 2;
    const flying = stats?.type === 'troop' && stats.unit.layer === 'air';
    const { id, side, card, hp, maxHp } = unit;
    return { id, side, card, ...pointToScreen(view, x, y), radius, deploying: unit.deployTicks > 0, flying, hp, maxHp };
  });
  return [...shapes.filter((shape) => !shape.flying), ...shapes.filter((shape) => shape.flying)];
}

/**
 * Recent spells as circles of their radius where they landed. Each fades linearly from the moment it
 * lands (tick + alpha) and is gone `lifeTicks` later.
 */
export function blastScene(
  blasts: readonly (Blast & { tick: number })[],
  current: Pick<SimState, 'tick' | 'cards'>,
  alpha: number,
  lifeTicks: number,
  view: View,
): BlastShape[] {
  const scale = view.tilePx / MILLI_PER_TILE;
  const shapes: BlastShape[] = [];
  for (const { side, card, x, y, tick } of blasts) {
    const stats = current.cards[card];
    const fade = 1 - (current.tick - tick + alpha) / lifeTicks;
    if (stats?.type === 'spell' && fade > 0) {
      shapes.push({ side, card, ...pointToScreen(view, x, y), radius: stats.spell.radius * scale, fade: Math.min(1, fade) });
    }
  }
  return shapes;
}

/**
 * Shots in flight, `alpha` of the way from where they were in `previous` to where they are in
 * `current`. A shot new in `current` shows where it is. A dot is a sixth of a tile across, a splash
 * shell's a quarter.
 */
export function projectileScene(previous: Pick<SimState, 'projectiles'>, current: Pick<SimState, 'projectiles'>, alpha: number, view: View): ProjectileShape[] {
  const before = new Map(previous.projectiles.map((shot) => [shot.id, shot]));
  return current.projectiles.map((shot) => {
    const from = before.get(shot.id) ?? shot;
    const x = from.x + (shot.x - from.x) * alpha;
    const y = from.y + (shot.y - from.y) * alpha;
    return { side: shot.side, ...pointToScreen(view, x, y), radius: view.tilePx * (shot.splash > 0 ? 0.25 : 1 / 6) };
  });
}

/** Recent splash hits as rings of their radius, each fading out like a blast over `lifeTicks`. */
export function splashScene(splashes: readonly (Splash & { tick: number })[], current: Pick<SimState, 'tick'>, alpha: number, lifeTicks: number, view: View): SplashShape[] {
  const scale = view.tilePx / MILLI_PER_TILE;
  const shapes: SplashShape[] = [];
  for (const { side, x, y, radius, tick } of splashes) {
    const fade = 1 - (current.tick - tick + alpha) / lifeTicks;
    if (fade > 0) {
      shapes.push({ side, ...pointToScreen(view, x, y), radius: radius * scale, fade: Math.min(1, fade) });
    }
  }
  return shapes;
}

/** Where `side` may not deploy a troop, to shade while one is selected: the rest of the arena. */
export function noDeployRect(arena: Terrain, side: Side): Rect {
  const zone = deployZone(arena, side);
  return zone.y === 0
    ? { x: 0, y: zone.height, width: arena.width, height: arena.height - zone.height }
    : { x: 0, y: 0, width: arena.width, height: zone.y };
}
