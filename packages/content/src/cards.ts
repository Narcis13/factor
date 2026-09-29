import type { CardId, CardStats } from '@factor/sim';

/**
 * The Stage 1 cards (VISION §8), so far only their costs. What they deploy comes with units:
 * `juggernaut` is the building-targeting tank, `warden` the melee unit, `slinger` the ranged unit
 * and `flare` the damage spell.
 */
export const CARDS = {
  juggernaut: { cost: 5 },
  warden: { cost: 3 },
  slinger: { cost: 4 },
  flare: { cost: 4 },
} as const satisfies Record<CardId, CardStats>;

export type ContentCardId = keyof typeof CARDS;

/** Every card id, in catalog order. */
export const CARD_IDS = Object.keys(CARDS) as [ContentCardId, ...ContentCardId[]];

/** With 4 cards and decks of 8, the one deck there is holds each card twice. */
export const STARTER_DECK: ContentCardId[] = [...CARD_IDS, ...CARD_IDS];
