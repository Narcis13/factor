import type { CardId, CardStats } from '@factor/sim';

/**
 * The Stage 1 cards (VISION §8). `juggernaut` is the tank (it will target buildings), `warden` the
 * melee unit, `slinger` the ranged unit and `flare` the damage spell. Speeds are milli-tiles per tick
 * (50 = 1 tile/s); radius and range are milli-tiles. Damage and targeting come with fighting.
 */
export const CARDS = {
  juggernaut: { cost: 5, type: 'troop', unit: { hp: 3000, speed: 40, radius: 700, range: 300 } },
  warden: { cost: 3, type: 'troop', unit: { hp: 1200, speed: 60, radius: 500, range: 300 } },
  slinger: { cost: 4, type: 'troop', unit: { hp: 600, speed: 50, radius: 450, range: 5000 } },
  flare: { cost: 4, type: 'spell' },
} as const satisfies Record<CardId, CardStats>;

export type ContentCardId = keyof typeof CARDS;

/** Every card id, in catalog order. */
export const CARD_IDS = Object.keys(CARDS) as [ContentCardId, ...ContentCardId[]];

/** With 4 cards and decks of 8, the one deck there is holds each card twice. */
export const STARTER_DECK: ContentCardId[] = [...CARD_IDS, ...CARD_IDS];
