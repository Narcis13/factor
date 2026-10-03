import type { ArenaLayout, AttackStats, Terrain, Tower, TowerKind, TowerStats } from './arena.ts';
import { dealPlayer, pickCards, type CardId, type CardStats, type EnergyRules, type Player } from './cards.ts';
import { hashJson } from './hash.ts';
import { seedRng, type Rng } from './rng.ts';
import { BASIS_POINTS } from './units.ts';
import type { Blast } from './spells.ts';
import type { Unit } from './troops.ts';

export type Side = 0 | 1;

/** A player action (VISION §5). The sim validates it; invalid commands do nothing and are recorded. */
export interface Command {
  tick: number;
  side: Side;
  handSlot: number;
  x: number;
  y: number;
}

/**
 * Why a command did nothing: `wrong-tick` (stamped for another tick), `bad-slot` (no such hand slot),
 * `out-of-bounds` (the point is outside the arena), `outside-deploy-zone` (a troop aimed outside its
 * side's half), `occupied` (a troop aimed on a standing tower) or `not-enough-energy` (less energy than the card costs).
 */
export type RejectReason = 'wrong-tick' | 'bad-slot' | 'out-of-bounds' | 'outside-deploy-zone' | 'occupied' | 'not-enough-energy';

export interface RejectedCommand {
  command: Command;
  reason: RejectReason;
}

/** Match timing in ticks, deck and hand sizes, and energy (VISION §4). The numbers come from `content`, which the sim can't import. */
export interface MatchRules {
  /** When regulation runs out, the side with more stars wins. */
  regulationTicks: number;
  /** Runs while stars are tied after regulation. The first star wins; still tied at its end is a draw. */
  overtimeTicks: number;
  /** Cards in each deck. */
  deckSize: number;
  /** Cards in each hand; the rest of the deck waits in the queue. Less than `deckSize`, so there is a next card. */
  handSize: number;
  energy: EnergyRules;
  /** Ticks a troop's unit stands on the field before it acts. */
  deployDelayTicks: number;
}

/** The most stars a side can hold: destroying the Keep brings its destroyer here and ends the match (VISION §4). */
export const MAX_STARS = 3;

/** How the match ended. A `null` winner is a draw. */
export interface MatchResult {
  winner: Side | null;
}

/** The whole match as plain JSON: integers only, no classes or Maps (VISION §5). */
export interface SimState {
  tick: number;
  rng: Rng;
  rules: MatchRules;
  /** Never changes during a match; each state has its own copy. */
  arena: Terrain;
  /** Ascending by id. */
  towers: Tower[];
  /** Never changes during a match. */
  towerStats: Record<TowerKind, TowerStats>;
  /** Troops on the field, ascending by id. Their ids follow the towers'. */
  units: Unit[];
  /** The id the next unit gets. */
  nextId: number;
  /** The stats of every card in either deck, by id. Never changes during a match. */
  cards: Record<CardId, CardStats>;
  /** Energy, hand and queue, indexed by `Side`. */
  players: [Player, Player];
  /** Stars earned, indexed by `Side`. */
  stars: [number, number];
  /** `null` while the match runs. Set by the step that ends it; stepping further throws. */
  result: MatchResult | null;
  /** Commands rejected by the step that produced this state, in resolution order. */
  rejected: RejectedCommand[];
  /** Spells that landed in the step that produced this state, in resolution order. */
  blasts: Blast[];
}

/** Everything a match starts from. The numbers come from `content` (D7). */
export interface MatchSetup {
  seed: number;
  rules: MatchRules;
  arena: ArenaLayout;
  towerStats: Record<TowerKind, TowerStats>;
  /** Card stats by id: at least every card in the decks. */
  cards: Record<CardId, CardStats>;
  /** Indexed by `Side`, in deck-list order. Each is shuffled from the seed, side 0's first. */
  decks: [CardId[], CardId[]];
}

export function createMatch(setup: MatchSetup): SimState {
  const rules = copyRules(setup.rules);
  const { regulationTicks, overtimeTicks, deckSize, handSize, energy, deployDelayTicks } = rules;
  requireInteger('regulationTicks', regulationTicks, 1);
  requireInteger('overtimeTicks', overtimeTicks, 0);
  requireInteger('handSize', handSize, 1);
  requireInteger('deckSize', deckSize, handSize + 1);
  requireInteger('energy max', energy.max, 1);
  requireInteger('energy start', energy.start, 0, energy.max);
  requireInteger('ticksPerEnergy', energy.ticksPerEnergy, 1);
  requireInteger('doubleFromTick', energy.doubleFromTick, 0);
  requireInteger('deployDelayTicks', deployDelayTicks, 0);
  const towerStats = copyTowerStats(setup.towerStats);
  for (const kind of ['keep', 'outpost'] as const) {
    requireInteger(`${kind} hp`, towerStats[kind].hp, 1);
    requireAttack(kind, towerStats[kind]);
  }
  for (const side of [0, 1] as const) {
    const size = setup.decks[side].length;
    if (size !== deckSize) {
      throw new RangeError(`Side ${String(side)}'s deck has ${String(size)} cards, not ${String(deckSize)}`);
    }
  }
  const cards = pickCards(setup.cards, [...setup.decks[0], ...setup.decks[1]]);
  for (const [id, card] of Object.entries(cards)) {
    requireInteger(`${id} cost`, card.cost, 0, energy.max);
    if (card.type === 'troop') {
      const { hp, speed, radius, mass, sight, targets } = card.unit;
      requireInteger(`${id} hp`, hp, 1);
      requireInteger(`${id} speed`, speed, 1);
      requireInteger(`${id} radius`, radius, 1);
      requireInteger(`${id} mass`, mass, 1);
      requireAttack(id, card.unit);
      requireInteger(`${id} sight`, sight, card.unit.range);
      // Setups come from outside the type system too (hand-edited content), so check the string.
      if (!(['ground', 'buildings'] as readonly string[]).includes(targets)) {
        throw new RangeError(`${id} targets must be ground or buildings, got ${targets}`);
      }
    } else {
      const { radius, damage, towerDamageBp } = card.spell;
      requireInteger(`${id} radius`, radius, 0);
      requireInteger(`${id} damage`, damage, 0);
      requireInteger(`${id} towerDamageBp`, towerDamageBp, 0, BASIS_POINTS);
    }
  }
  // Fields are copied one by one, so nothing from the setup is shared with the state or leaks into it.
  const towers = setup.arena.towers.map(({ kind, side, lane, x, y, size }, id): Tower => {
    const { hp } = towerStats[kind];
    return { id, kind, side, lane, x, y, size, hp, maxHp: hp, targetId: null, cooldown: 0, dormant: kind === 'keep' };
  });
  const rng = seedRng(setup.seed);
  const players: [Player, Player] = [
    dealPlayer(rng, setup.decks[0], handSize, energy.start),
    dealPlayer(rng, setup.decks[1], handSize, energy.start),
  ];
  return {
    tick: 0,
    rng,
    rules,
    arena: copyTerrain(setup.arena),
    towers,
    towerStats,
    units: [],
    nextId: towers.length,
    cards,
    players,
    stars: [0, 0],
    result: null,
    rejected: [],
    blasts: [],
  };
}

/** FNV-1a over the canonical serialization of the state, as 8 hex digits. */
export function hashState(state: SimState): string {
  return hashJson(state);
}

export function copyTerrain({ width, height, river, bridges }: Terrain): Terrain {
  return {
    width,
    height,
    river: { x: river.x, y: river.y, width: river.width, height: river.height },
    bridges: bridges.map(({ lane, x, y, width: w, height: h }) => ({ lane, x, y, width: w, height: h })),
  };
}

export function copyRules({ regulationTicks, overtimeTicks, deckSize, handSize, energy, deployDelayTicks }: MatchRules): MatchRules {
  const { start, max, ticksPerEnergy, doubleFromTick } = energy;
  return {
    regulationTicks,
    overtimeTicks,
    deckSize,
    handSize,
    energy: { start, max, ticksPerEnergy, doubleFromTick },
    deployDelayTicks,
  };
}

export function copyTowerStats(stats: Readonly<Record<TowerKind, TowerStats>>): Record<TowerKind, TowerStats> {
  const copy = ({ hp, damage, hitTicks, firstHitTicks, range }: TowerStats): TowerStats => ({ hp, damage, hitTicks, firstHitTicks, range });
  return { keep: copy(stats.keep), outpost: copy(stats.outpost) };
}

function requireAttack(name: string, { damage, hitTicks, firstHitTicks, range }: AttackStats): void {
  requireInteger(`${name} damage`, damage, 0);
  requireInteger(`${name} hitTicks`, hitTicks, 1);
  requireInteger(`${name} firstHitTicks`, firstHitTicks, 1);
  requireInteger(`${name} range`, range, 0);
}

export function copyCards(cards: Readonly<Record<CardId, CardStats>>): Record<CardId, CardStats> {
  return pickCards(cards, Object.keys(cards));
}

function requireInteger(name: string, value: number, min: number, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `≥ ${String(min)}` : `in [${String(min)}, ${String(max)}]`;
    throw new RangeError(`${name} must be an integer ${range}, got ${String(value)}`);
  }
}
