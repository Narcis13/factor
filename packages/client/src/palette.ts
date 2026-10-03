import type { CardId, Side } from '@factor/sim';

// Placeholder palette until art direction is decided (VISION §11). Side 0 is blue, side 1 is red.
export const BACKGROUND = 0x14181d;
export const SIDE_COLOR: Record<Side, number> = { 0: 0x3b74e0, 1: 0xd9483b };

const CARD_COLOR: Record<CardId, number> = {
  juggernaut: 0x8a5a2b,
  warden: 0x4f7d8c,
  slinger: 0x6b8e3a,
  flare: 0xc2562b,
  harrier: 0xd4b13a,
};

export function cardColor(card: CardId): number {
  return CARD_COLOR[card] ?? 0x666666;
}
