import { TICKS_PER_SECOND, type CardId, type CardStats } from '@factor/sim';
import { MATCH_RULES } from './match.ts';

const TICKS = TICKS_PER_SECOND;

/**
 * The cards (VISION §8), one per archetype. `juggernaut` is the tank that only targets buildings,
 * `warden` the melee unit, `slinger` the ranged unit (it reaches flying units too), `flare` the damage
 * spell (a 2.5-tile burst that hits towers for 30%) and `harrier` the flyer, which only `air` units,
 * towers and spells can hit. Speeds are milli-tiles per tick (50 = 1 tile/s); radius, range and sight
 * are milli-tiles, edge to edge. Hit times are in ticks.
 */
export const CARDS = {
  juggernaut: {
    cost: 5,
    type: 'troop',
    unit: { hp: 3000, speed: 40, radius: 700, mass: 18, range: 300, sight: 5000, targets: 'buildings', layer: 'ground', damage: 180, hitTicks: (3 * TICKS) / 2, firstHitTicks: TICKS / 2 },
  },
  warden: {
    cost: 3,
    type: 'troop',
    unit: { hp: 1200, speed: 60, radius: 500, mass: 6, range: 300, sight: 5500, targets: 'ground', layer: 'ground', damage: 150, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  slinger: {
    cost: 4,
    type: 'troop',
    unit: { hp: 600, speed: 50, radius: 450, mass: 4, range: 5000, sight: 5500, targets: 'air', layer: 'ground', damage: 90, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  flare: { cost: 4, type: 'spell', spell: { radius: 2500, damage: 500, towerDamageBp: 3000 } },
  harrier: {
    cost: 4,
    type: 'troop',
    unit: { hp: 750, speed: 55, radius: 450, mass: 4, range: 2000, sight: 5500, targets: 'air', layer: 'air', damage: 110, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
} as const satisfies Record<CardId, CardStats>;

export type ContentCardId = keyof typeof CARDS;

/** Every card id, in catalog order. */
export const CARD_IDS = Object.keys(CARDS) as [ContentCardId, ...ContentCardId[]];

/** Until there is a deck builder, the one deck: the catalog in order, over again until the deck is full. */
export const STARTER_DECK: ContentCardId[] = Array.from({ length: MATCH_RULES.deckSize }, (_, i) => CARD_IDS[i % CARD_IDS.length] ?? CARD_IDS[0]);
