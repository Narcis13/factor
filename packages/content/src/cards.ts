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
 * Stage 3 adds the `hive` (a building that sends out two mites every 5 s for 40 s), the `charger` (a
 * fast building-hunter), the `airship` (a flying building-hunter whose bomb hits a tower and the
 * buildings by it), `wisps` (four fragile flyers that hit air), `meteor` (a heavy, narrow spell),
 * `spark` (a cheap, wide one), the `reaver` (a melee swing that hits everything round its target) and
 * the `duelist` (slow, huge single blows).
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
    unit: { hp: 660, speed: 50, radius: 450, mass: 4, range: 5000, sight: 5500, targets: 'air', layer: 'ground', count: 1, damage: 90, splash: 0, projectileSpeed: 500, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  flare: { cost: 4, type: 'spell', spell: { radius: 2200, damage: 380, towerDamageBp: 3000 } },
  harrier: {
    cost: 4,
    type: 'troop',
    unit: { hp: 750, speed: 55, radius: 450, mass: 4, range: 2000, sight: 5500, targets: 'air', layer: 'air', count: 1, damage: 110, splash: 0, projectileSpeed: 600, hitTicks: (6 * TICKS) / 5, firstHitTicks: (2 * TICKS) / 5 },
  },
  rabble: {
    cost: 3,
    type: 'troop',
    unit: { hp: 330, speed: 60, radius: 300, mass: 2, range: 200, sight: 5000, targets: 'ground', layer: 'ground', count: 4, damage: 80, splash: 0, projectileSpeed: 0, hitTicks: TICKS, firstHitTicks: (3 * TICKS) / 10 },
  },
  bombardier: {
    cost: 4,
    type: 'troop',
    unit: { hp: 700, speed: 45, radius: 500, mass: 6, range: 4500, sight: 5500, targets: 'ground', layer: 'ground', count: 1, damage: 150, splash: 1200, projectileSpeed: 400, hitTicks: (9 * TICKS) / 5, firstHitTicks: TICKS / 2 },
  },
  bastion: {
    cost: 4,
    type: 'building',
    lifetimeTicks: 30 * TICKS,
    spawn: null,
    unit: { hp: 1100, speed: 0, radius: 600, mass: 1, range: 5000, sight: 5000, targets: 'air', layer: 'ground', count: 1, damage: 65, splash: 0, projectileSpeed: 700, hitTicks: (4 * TICKS) / 5, firstHitTicks: TICKS / 2 },
  },
  // Stage 3 (VISION §8): eight more, for sixteen.
  hive: {
    cost: 5,
    type: 'building',
    lifetimeTicks: 40 * TICKS,
    spawn: { card: 'mite', everyTicks: 5 * TICKS },
    unit: { hp: 800, speed: 0, radius: 800, mass: 1, range: 0, sight: 0, targets: 'ground', layer: 'ground', count: 1, damage: 0, splash: 0, projectileSpeed: 0, hitTicks: TICKS, firstHitTicks: TICKS },
  },
  charger: {
    cost: 4,
    type: 'troop',
    unit: { hp: 1500, speed: 90, radius: 600, mass: 8, range: 300, sight: 5000, targets: 'buildings', layer: 'ground', count: 1, damage: 220, splash: 0, projectileSpeed: 0, hitTicks: (3 * TICKS) / 2, firstHitTicks: TICKS / 2 },
  },
  airship: {
    cost: 5,
    type: 'troop',
    unit: { hp: 1800, speed: 40, radius: 750, mass: 10, range: 0, sight: 5000, targets: 'buildings', layer: 'air', count: 1, damage: 650, splash: 800, projectileSpeed: 0, hitTicks: 3 * TICKS, firstHitTicks: TICKS },
  },
  wisps: {
    cost: 3,
    type: 'troop',
    unit: { hp: 100, speed: 70, radius: 280, mass: 1, range: 1500, sight: 5000, targets: 'air', layer: 'air', count: 4, damage: 48, splash: 0, projectileSpeed: 500, hitTicks: (9 * TICKS) / 10, firstHitTicks: (3 * TICKS) / 10 },
  },
  meteor: { cost: 6, type: 'spell', spell: { radius: 1800, damage: 1100, towerDamageBp: 3000 } },
  spark: { cost: 2, type: 'spell', spell: { radius: 1800, damage: 110, towerDamageBp: 3000 } },
  reaver: {
    cost: 4,
    type: 'troop',
    unit: { hp: 1450, speed: 55, radius: 550, mass: 6, range: 400, sight: 5500, targets: 'ground', layer: 'ground', count: 1, damage: 180, splash: 1300, projectileSpeed: 0, hitTicks: (3 * TICKS) / 2, firstHitTicks: TICKS / 2 },
  },
  duelist: {
    cost: 4,
    type: 'troop',
    unit: { hp: 1150, speed: 65, radius: 500, mass: 6, range: 300, sight: 5500, targets: 'ground', layer: 'ground', count: 1, damage: 380, splash: 0, projectileSpeed: 0, hitTicks: (9 * TICKS) / 5, firstHitTicks: TICKS / 2 },
  },
  // Not a deck card: what a hive deploys.
  mite: {
    cost: 1,
    type: 'troop',
    unit: { hp: 220, speed: 60, radius: 350, mass: 2, range: 200, sight: 5000, targets: 'ground', layer: 'ground', count: 2, damage: 60, splash: 0, projectileSpeed: 0, hitTicks: (11 * TICKS) / 10, firstHitTicks: (3 * TICKS) / 10 },
  },
} as const satisfies Record<CardId, CardStats>;

export type ContentCardId = keyof typeof CARDS;

/** Every card id, in catalog order: what a replay's decks may name. */
export const CARD_IDS = Object.keys(CARDS) as [ContentCardId, ...ContentCardId[]];

/** Cards that only ever come out of another card (a hive's mites): never dealt, never in the deck builder. */
export const SPAWN_ONLY: readonly ContentCardId[] = ['mite'];

/** The cards a deck can hold, in catalog order (VISION §3: sixteen). */
export const DECK_CARD_IDS = CARD_IDS.filter((id) => !SPAWN_ONLY.includes(id));

/** The eight Stage 2 archetypes, one each: tank, melee, ranged, spell, flyer, swarm, splash, building. */
export const STARTER_DECK: ContentCardId[] = DECK_CARD_IDS.slice(0, MATCH_RULES.deckSize);
