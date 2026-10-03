import { TICKS_PER_SECOND, type CardId, type CardStats } from '@factor/sim';
import { MATCH_RULES } from './match.ts';

const TICKS = TICKS_PER_SECOND;

/**
 * The cards (VISION §8), one per archetype. `juggernaut` is the tank that only targets buildings,
 * `warden` the melee unit, `slinger` the ranged unit (it reaches flying units too), `flare` the damage
 * spell (a 2.5-tile burst that hits towers for 30%), `harrier` the flyer, which only `air` units,
 * towers and spells can hit, `rabble` the swarm (four small fighters from one play),
 * `bombardier` the splash unit, lobbing slow shells that hit every ground enemy within 1.2 tiles, and
 * `bastion` the building: a turret that shoots ground and air for 30 s, losing its hp as it goes.
 * Ranged hits fly as projectiles. Speeds (projectiles' too) are milli-tiles per tick (50 = 1 tile/s);
 * radius, range, sight and splash are milli-tiles, edge to edge. Hit times are in ticks.
 */
export const CARDS = {
  juggernaut: {
    cost: 5,
    type: 'troop',
    unit: { hp: 3000, speed: 40, radius: 700, mass: 18, range: 300, sight: 5000, targets: 'buildings', layer: 'ground', count: 1, damage: 180, splash: 0, projectileSpeed: 0, hitTicks: (3 * TICKS) / 2, firstHitTicks: TICKS / 2 },
  },
  warden: {
    cost: 3,
    type: 'troop',
    unit: { hp: 1200, speed: 60, radius: 500, mass: 6, range: 300, sight: 5500, targets: 'ground', layer: 'ground', count: 1, damage: 150, splash: 0, projectileSpeed: 0, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  slinger: {
    cost: 4,
    type: 'troop',
    unit: { hp: 600, speed: 50, radius: 450, mass: 4, range: 5000, sight: 5500, targets: 'air', layer: 'ground', count: 1, damage: 90, splash: 0, projectileSpeed: 500, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  flare: { cost: 4, type: 'spell', spell: { radius: 2500, damage: 500, towerDamageBp: 3000 } },
  harrier: {
    cost: 4,
    type: 'troop',
    unit: { hp: 750, speed: 55, radius: 450, mass: 4, range: 2000, sight: 5500, targets: 'air', layer: 'air', count: 1, damage: 110, splash: 0, projectileSpeed: 600, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  rabble: {
    cost: 3,
    type: 'troop',
    unit: { hp: 230, speed: 60, radius: 300, mass: 2, range: 200, sight: 5000, targets: 'ground', layer: 'ground', count: 4, damage: 65, splash: 0, projectileSpeed: 0, hitTicks: TICKS, firstHitTicks: (3 * TICKS) / 10 },
  },
  bombardier: {
    cost: 4,
    type: 'troop',
    unit: { hp: 650, speed: 45, radius: 500, mass: 6, range: 4500, sight: 5500, targets: 'ground', layer: 'ground', count: 1, damage: 130, splash: 1200, projectileSpeed: 400, hitTicks: (9 * TICKS) / 5, firstHitTicks: TICKS / 2 },
  },
  bastion: {
    cost: 4,
    type: 'building',
    lifetimeTicks: 30 * TICKS,
    unit: { hp: 1100, speed: 0, radius: 600, mass: 1, range: 5500, sight: 5500, targets: 'air', layer: 'ground', count: 1, damage: 75, splash: 0, projectileSpeed: 700, hitTicks: (4 * TICKS) / 5, firstHitTicks: TICKS / 2 },
  },
} as const satisfies Record<CardId, CardStats>;

export type ContentCardId = keyof typeof CARDS;

/** Every card id, in catalog order. */
export const CARD_IDS = Object.keys(CARDS) as [ContentCardId, ...ContentCardId[]];

/** Until there is a deck builder, the one deck: the catalog in order, over again until the deck is full. */
export const STARTER_DECK: ContentCardId[] = Array.from({ length: MATCH_RULES.deckSize }, (_, i) => CARD_IDS[i % CARD_IDS.length] ?? CARD_IDS[0]);
