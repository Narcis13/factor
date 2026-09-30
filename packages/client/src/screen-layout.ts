import { MAX_STARS, MILLI_PER_TILE, type Terrain } from '@factor/sim';
import { fitView, pointToScreen, type ScreenRect, type View } from './arena-view.ts';

/** A point on the screen, in CSS pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Where the HUD's parts sit on the screen, in CSS pixels. */
export interface HudLayout {
  /** One per hand slot, left to right. */
  slots: ScreenRect[];
  /** The next card: smaller, left of the hand. */
  next: ScreenRect;
  energyBar: ScreenRect;
  /** The timer's top-right corner, inside the arena's top-right corner. */
  timer: ScreenPoint;
  /**
   * Each side's star centers, indexed by `Side`, first star first: a column in the arena's last tile
   * column, right of the bridge, starting on that side's bank of the river and growing away from it
   * (side 0 downward, side 1 upward).
   */
  stars: [ScreenPoint[], ScreenPoint[]];
  starRadius: number;
}

/** The result panel shown over the arena once the match ends. */
export interface EndLayout {
  panel: ScreenRect;
  /** The center of the title. */
  title: ScreenPoint;
  /** Star centers, first star first: the viewer's on the left, the opponent's on the right. */
  stars: { left: ScreenPoint[]; right: ScreenPoint[] };
  starRadius: number;
  again: ScreenRect;
  save: ScreenRect;
}

export interface ScreenLayout {
  view: View;
  hud: HudLayout;
  end: EndLayout;
}

const GAP = 8;
const ENERGY_BAR_HEIGHT = 24;
/** The next card is this fraction of a hand card. */
const NEXT_SCALE = 0.6;
const STAR_GAP = 3;
const END_WIDTH = 320;
const END_HEIGHT = 216;
const BUTTON_HEIGHT = 48;

/**
 * Splits the screen into the arena on top and the hand below it. The HUD is at most as wide as a
 * 9:16 screen of the same height, so a desktop window doesn't get giant cards.
 */
export function layoutScreen(arena: Terrain, handSize: number, width: number, height: number): ScreenLayout {
  const hudWidth = Math.min(width, Math.floor((height * 9) / 16));
  const cardWidth = Math.max(1, Math.floor((hudWidth - (handSize + 2) * GAP) / (handSize + NEXT_SCALE)));
  const cardHeight = Math.floor(cardWidth * 1.25);
  const nextWidth = Math.floor(cardWidth * NEXT_SCALE);
  const nextHeight = Math.floor(cardHeight * NEXT_SCALE);
  // Rounding the card size down leaves spare pixels; the row is centered on what it actually uses.
  const rowWidth = GAP + nextWidth + GAP + handSize * cardWidth + (handSize - 1) * GAP + GAP;
  const hudLeft = Math.floor((width - rowWidth) / 2);
  const bandHeight = GAP + cardHeight + GAP + ENERGY_BAR_HEIGHT + GAP;

  const view = fitView(arena, width, Math.max(1, height - bandHeight));
  const cardsTop = height - bandHeight + GAP;
  const handLeft = hudLeft + GAP + nextWidth + GAP;
  const slots: ScreenRect[] = [];
  for (let slot = 0; slot < handSize; slot++) {
    slots.push({ x: handLeft + slot * (cardWidth + GAP), y: cardsTop, width: cardWidth, height: cardHeight });
  }
  const handRight = handLeft + handSize * cardWidth + (handSize - 1) * GAP;
  const arenaRight = view.left + (arena.width / MILLI_PER_TILE) * view.tilePx;
  const starRadius = Math.max(4, Math.round(view.tilePx * 0.4));
  const starX = arenaRight - view.tilePx / 2;
  // The first star's center sits three quarters of a tile off the river's bank.
  const offBank = Math.round(view.tilePx * 0.75);
  const riverTop = pointToScreen(view, 0, arena.river.y + arena.river.height).y;
  const riverBottom = pointToScreen(view, 0, arena.river.y).y;
  const starStep = 2 * starRadius + STAR_GAP;
  return {
    view,
    hud: {
      slots,
      next: { x: hudLeft + GAP, y: cardsTop + cardHeight - nextHeight, width: nextWidth, height: nextHeight },
      energyBar: { x: handLeft, y: cardsTop + cardHeight + GAP, width: handRight - handLeft, height: ENERGY_BAR_HEIGHT },
      timer: { x: arenaRight - GAP, y: view.top + GAP },
      stars: [
        Array.from({ length: MAX_STARS }, (_, i) => ({ x: starX, y: riverBottom + offBank + i * starStep })),
        Array.from({ length: MAX_STARS }, (_, i) => ({ x: starX, y: riverTop - offBank - i * starStep })),
      ],
      starRadius,
    },
    end: layoutEnd(view.left, arenaRight - view.left, (riverTop + riverBottom) / 2),
  };
}

/** A panel as wide as the arena allows up to `END_WIDTH`, centered on the river. */
function layoutEnd(arenaLeft: number, arenaWidth: number, riverMiddle: number): EndLayout {
  const width = Math.max(1, Math.min(END_WIDTH, arenaWidth - 2 * GAP));
  const panel = {
    x: Math.round(arenaLeft + (arenaWidth - width) / 2),
    y: Math.round(riverMiddle - END_HEIGHT / 2),
    width,
    height: END_HEIGHT,
  };
  const middle = panel.x + width / 2;
  const starRadius = 14;
  const groupWidth = MAX_STARS * 2 * starRadius + (MAX_STARS - 1) * STAR_GAP;
  const starsY = panel.y + 104;
  const buttonWidth = Math.floor((width - 3 * 2 * GAP) / 2);
  const buttonY = panel.y + END_HEIGHT - 2 * GAP - BUTTON_HEIGHT;
  return {
    panel,
    title: { x: middle, y: panel.y + 44 },
    stars: {
      left: row(middle - 3 * GAP - groupWidth + starRadius, starsY, starRadius),
      right: row(middle + 3 * GAP + starRadius, starsY, starRadius),
    },
    starRadius,
    again: { x: panel.x + 2 * GAP, y: buttonY, width: buttonWidth, height: BUTTON_HEIGHT },
    save: { x: panel.x + width - 2 * GAP - buttonWidth, y: buttonY, width: buttonWidth, height: BUTTON_HEIGHT },
  };
}

/** `MAX_STARS` star centers left to right, starting at `x`. */
function row(x: number, y: number, radius: number): ScreenPoint[] {
  return Array.from({ length: MAX_STARS }, (_, i) => ({ x: x + i * (2 * radius + STAR_GAP), y }));
}

/**
 * The arena point under a screen point, in milli-tiles, or `null` off the arena. Integer division
 * of whole pixels, so a tile's center pixel maps into that tile.
 */
export function toArena(view: View, arena: Terrain, x: number, y: number): { x: number; y: number } | null {
  const ax = Math.floor(((x - view.left) * MILLI_PER_TILE) / view.tilePx);
  const down = Math.floor(((y - view.top) * MILLI_PER_TILE) / view.tilePx);
  const ay = arena.height - 1 - down;
  if (ax < 0 || ax >= arena.width || ay < 0 || ay >= arena.height) {
    return null;
  }
  return { x: ax, y: ay };
}

export function contains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
