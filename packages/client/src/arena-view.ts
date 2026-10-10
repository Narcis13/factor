import { towerFootprint } from '@factor/content';
import { deployZones, MILLI_PER_TILE, type Blast, type CardId, type Rect, type Side, type SimState, type Splash, type Terrain } from '@factor/sim';

/**
 * How the arena sits on the screen: a whole number of pixels per tile, centered, with side 0 at the
 * bottom as its player sees it. Screen y grows downward; arena y grows toward side 1. The same shape
 * describes the art's own pixel grid (16 a tile), so everything below works in either.
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

/**
 * Where something stands. The ground is the river and the bridges over it; towers carry their owner,
 * whether they've fallen, and whether they're dormant (a Keep before it wakes, VISION §4).
 */
export type Shape =
  | { kind: 'river' | 'bridge'; rect: ScreenRect }
  | { kind: 'keep' | 'outpost'; side: Side; rect: ScreenRect; fallen: boolean; dormant: boolean };

/** How much hp something has left, as a bar on the screen: `fraction` of it filled in its side's color. */
export interface HpBar {
  side: Side;
  rect: ScreenRect;
  /** In [0, 1]. */
  fraction: number;
}

/** How far above its shadow a flying unit is drawn: this many radii, plus a fifth of a tile. */
export const FLY_LIFT = 1.4;

/** A unit on the screen: where its feet are, in CSS pixels. */
export interface UnitShape {
  id: number;
  side: Side;
  card: CardId;
  x: number;
  y: number;
  radius: number;
  /** Still waiting out its deploy delay. */
  deploying: boolean;
  /** A flying unit: drawn over the ground units, `lift` pixels above its shadow. */
  flying: boolean;
  lift: number;
  /** A building: it stands, and never walks. */
  building: boolean;
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

/** A shot in flight on the screen. */
export interface ProjectileShape {
  id: number;
  side: Side;
  x: number;
  y: number;
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

/** The river and the bridges over it: they never change during a match. */
export function groundScene(arena: Terrain, view: View): Shape[] {
  return [{ kind: 'river', rect: toScreen(view, arena.river) }, ...arena.bridges.map((bridge): Shape => ({ kind: 'bridge', rect: toScreen(view, bridge) }))];
}

/** The towers standing in `state` (not the layout's sites, so the picture follows the sim). */
export function towerScene(state: Pick<SimState, 'towers'>, view: View): (Shape & { kind: 'keep' | 'outpost' })[] {
  return state.towers.map((tower) => ({
    kind: tower.kind,
    side: tower.side,
    rect: toScreen(view, towerFootprint(tower)),
    fallen: tower.hp === 0,
    dormant: tower.dormant,
  }));
}

/** How tall things are drawn, in the view's pixels above where they stand: a tower's body by kind, a unit by card. */
export interface Heights {
  tower: (kind: 'keep' | 'outpost') => number;
  unit: (card: CardId) => number;
}

/**
 * Hp bars, just above what they measure: every standing tower's (a little over half as wide as its
 * footprint), and every damaged unit's (as wide as it is, between half a tile and a tile and an eighth).
 * A full-hp unit shows none, so the field stays readable.
 */
export function hpBarScene(state: Pick<SimState, 'towers'>, units: readonly UnitShape[], view: View, heights: Heights): HpBar[] {
  const towerHeight = Math.max(2, Math.round(view.tilePx / 4));
  const unitHeight = Math.max(2, Math.round(view.tilePx / 8));
  const gap = Math.max(1, Math.round(view.tilePx / 8));
  const bars: HpBar[] = [];
  for (const tower of state.towers) {
    if (tower.hp > 0) {
      const { x, y, width, height } = toScreen(view, towerFootprint(tower));
      const barWidth = Math.round(width * 0.58);
      const top = y + height / 2 - heights.tower(tower.kind) - gap - towerHeight;
      bars.push({ side: tower.side, rect: { x: Math.round(x + (width - barWidth) / 2), y: Math.round(top), width: barWidth, height: towerHeight }, fraction: tower.hp / tower.maxHp });
    }
  }
  for (const unit of units) {
    if (unit.hp < unit.maxHp) {
      const width = Math.round(Math.min(view.tilePx * 1.125, Math.max(view.tilePx / 2, unit.radius * 2)));
      const top = unit.y - unit.lift - heights.unit(unit.card) - gap - unitHeight;
      bars.push({ side: unit.side, rect: { x: Math.round(unit.x - width / 2), y: Math.round(top), width, height: unitHeight }, fraction: unit.hp / unit.maxHp });
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
    const known = stats !== undefined && stats.type !== 'spell' ? stats : undefined;
    const radius = known === undefined ? (scale * MILLI_PER_TILE) / 2 : known.unit.radius * scale;
    const flying = known?.unit.layer === 'air';
    const building = known?.type === 'building';
    const lift = flying ? Math.round(radius * FLY_LIFT + view.tilePx / 5) : 0;
    const { id, side, card, hp, maxHp } = unit;
    return { id, side, card, ...pointToScreen(view, x, y), radius, deploying: unit.deployTicks > 0, flying, lift, building, hp, maxHp };
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
 * `current`. A shot new in `current` shows where it is.
 */
export function projectileScene(previous: Pick<SimState, 'projectiles'>, current: Pick<SimState, 'projectiles'>, alpha: number, view: View): ProjectileShape[] {
  const before = new Map(previous.projectiles.map((shot) => [shot.id, shot]));
  return current.projectiles.map((shot) => {
    const from = before.get(shot.id) ?? shot;
    const x = from.x + (shot.x - from.x) * alpha;
    const y = from.y + (shot.y - from.y) * alpha;
    return { id: shot.id, side: shot.side, ...pointToScreen(view, x, y) };
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

/**
 * Where `side` may not deploy a troop or building, to shade while one is selected: the river, and each
 * lane's side of the enemy half that a fallen enemy Outpost hasn't opened.
 */
export function noDeployRects(state: Pick<SimState, 'arena' | 'towers'>, side: Side): Rect[] {
  const { arena } = state;
  const zones = deployZones(state, side);
  const home = zones[0];
  const riverEnd = arena.river.y + arena.river.height;
  const enemy = home?.y === 0 ? { x: 0, y: riverEnd, width: arena.width, height: arena.height - riverEnd } : { x: 0, y: 0, width: arena.width, height: arena.river.y };
  const middle = Math.floor(arena.width / 2);
  const lanes = [{ ...enemy, width: middle }, { ...enemy, x: middle, width: arena.width - middle }];
  const open = (lane: Rect) => zones.some((zone) => zone.x === lane.x && zone.y === lane.y && zone.width === lane.width && zone.height === lane.height);
  return [{ ...arena.river }, ...lanes.filter((lane) => !open(lane))];
}
