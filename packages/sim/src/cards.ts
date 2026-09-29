import type { AttackStats } from './arena.ts';
import { shuffle, type Rng } from './rng.ts';

/** A card's id, as `content` names it. */
export type CardId = string;

/**
 * What a unit may lock on to (VISION §4): `ground` means ground units and buildings; `buildings` means
 * towers only. Air comes with flying units.
 */
export type TargetFilter = 'ground' | 'buildings';

/** What a troop's unit is made of (VISION §4). `range` is how close its edge gets to its target's edge. */
export interface UnitStats extends AttackStats {
  hp: number;
  /** Milli-tiles moved per tick. */
  speed: number;
  /** The unit is a circle of this radius, in milli-tiles. */
  radius: number;
  /** Edge to edge, in milli-tiles: how far it notices enemies. */
  sight: number;
  targets: TargetFilter;
}

/**
 * A spell's instant area effect (VISION §4): every enemy unit its circle touches and every enemy tower
 * whose footprint it touches takes `damage`, towers only `towerDamageBp` basis points of it.
 */
export interface SpellStats {
  /** In milli-tiles, from the aim point. */
  radius: number;
  damage: number;
  /** The share of `damage` a tower takes, in basis points (10000 = all of it). */
  towerDamageBp: number;
}

/**
 * What the sim needs to know about a card. A troop deploys one unit on its side's half; a spell
 * lands anywhere. Energy spent to play it is `cost`.
 */
export type CardStats = { cost: number; type: 'troop'; unit: UnitStats } | { cost: number; type: 'spell'; spell: SpellStats };

/** Energy (VISION §4). The numbers come from `content`. */
export interface EnergyRules {
  /** Each side's energy when the match starts. */
  start: number;
  max: number;
  /** Ticks to regenerate one energy at the normal rate. */
  ticksPerEnergy: number;
  /** From this tick on, overtime included, energy regenerates twice as fast. */
  doubleFromTick: number;
}

/** One side's resources: energy, hand and the queue behind it. */
export interface Player {
  /** Whole energy, in [0, max]. */
  energy: number;
  /**
   * Regeneration toward the next energy, in normal-rate ticks: in [0, ticksPerEnergy). It grows by
   * 1 per tick, or 2 at double rate, and stays 0 while energy is at max.
   */
  energyProgress: number;
  /** Indexed by `Command.handSlot`. */
  hand: CardId[];
  /** The rest of the deck. The first is shown as next; a played card joins the back. */
  queue: CardId[];
}

/** Shuffles a copy of `deck` with the match rng and deals the first `handSize` cards into the hand. */
export function dealPlayer(rng: Rng, deck: readonly CardId[], handSize: number, energy: number): Player {
  const order = [...deck];
  shuffle(rng, order);
  return { energy, energyProgress: 0, hand: order.slice(0, handSize), queue: order.slice(handSize) };
}

export function copyPlayer({ energy, energyProgress, hand, queue }: Player): Player {
  return { energy, energyProgress, hand: [...hand], queue: [...queue] };
}

/**
 * Spends the card in `slot` and cycles it (VISION §4): it goes to the back of the queue and the next
 * card takes its slot. The caller has checked the slot and the energy.
 */
export function playCard(player: Player, slot: number, cost: number): void {
  const [played, next] = [player.hand[slot], player.queue.shift()];
  if (played === undefined || next === undefined) {
    throw new RangeError(`Cannot play hand slot ${String(slot)}`);
  }
  player.energy -= cost;
  player.hand[slot] = next;
  player.queue.push(played);
}

/** One tick of regeneration: `rate` is 1, or 2 at double rate. */
export function regenerate(player: Player, rules: EnergyRules, rate: number): void {
  if (player.energy >= rules.max) {
    player.energyProgress = 0;
    return;
  }
  player.energyProgress += rate;
  if (player.energyProgress >= rules.ticksPerEnergy) {
    player.energy += 1;
    player.energyProgress = player.energy >= rules.max ? 0 : player.energyProgress - rules.ticksPerEnergy;
  }
}

/** Copies the stats of every card in `ids` from `catalog`, and nothing else. Throws on an unknown id. */
export function pickCards(catalog: Readonly<Record<CardId, CardStats>>, ids: readonly CardId[]): Record<CardId, CardStats> {
  const cards: Record<CardId, CardStats> = {};
  for (const id of [...ids].sort()) {
    const stats = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
    if (stats === undefined) {
      throw new RangeError(`Unknown card: ${id}`);
    }
    cards[id] = copyCard(stats);
  }
  return cards;
}

function copyCard(stats: CardStats): CardStats {
  if (stats.type === 'spell') {
    const { radius, damage, towerDamageBp } = stats.spell;
    return { cost: stats.cost, type: 'spell', spell: { radius, damage, towerDamageBp } };
  }
  const { hp, speed, radius, range, sight, targets, damage, hitTicks, firstHitTicks } = stats.unit;
  return {
    cost: stats.cost,
    type: 'troop',
    unit: { hp, speed, radius, range, sight, targets, damage, hitTicks, firstHitTicks },
  };
}
