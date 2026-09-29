import { MILLI_PER_TILE, type Terrain } from '@factor/sim';
import { fitView, type ScreenRect, type View } from './arena-view.ts';

/** Where the HUD's parts sit on the screen, in CSS pixels. */
export interface HudLayout {
  /** One per hand slot, left to right. */
  slots: ScreenRect[];
  /** The next card: smaller, left of the hand. */
  next: ScreenRect;
  energyBar: ScreenRect;
  /** The timer's top-right corner, inside the arena's top-right corner. */
  timer: { x: number; y: number };
}

export interface ScreenLayout {
  view: View;
  hud: HudLayout;
}

const GAP = 8;
const ENERGY_BAR_HEIGHT = 24;
/** The next card is this fraction of a hand card. */
const NEXT_SCALE = 0.6;

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
  return {
    view,
    hud: {
      slots,
      next: { x: hudLeft + GAP, y: cardsTop + cardHeight - nextHeight, width: nextWidth, height: nextHeight },
      energyBar: { x: handLeft, y: cardsTop + cardHeight + GAP, width: handRight - handLeft, height: ENERGY_BAR_HEIGHT },
      timer: { x: view.left + (arena.width / MILLI_PER_TILE) * view.tilePx - GAP, y: view.top + GAP },
    },
  };
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
