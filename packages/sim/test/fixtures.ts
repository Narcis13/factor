import { expect } from 'vitest';
import {
  checkInvariants,
  createMatch,
  step,
  type ArenaLayout,
  type CardId,
  type CardStats,
  type MatchRules,
  type MatchSetup,
  type SimState,
  type TowerKind,
  type TowerStats,
  type Unit,
} from '../src/index.ts';

/**
 * Test fixture rules sized like a real match: 3:00 plus 2:00 of overtime at 20 ticks/s, decks of 8,
 * hands of 4, energy from 5 up to 10 at one per 56 ticks (twice as fast from 2:00 on), and a 1 s deploy delay.
 */
export const RULES: MatchRules = {
  regulationTicks: 3600,
  overtimeTicks: 2400,
  deckSize: 8,
  handSize: 4,
  energy: { start: 5, max: 10, ticksPerEnergy: 56, doubleFromTick: 2400 },
  deployDelayTicks: 20,
};

/** A spell of this cost that touches nothing. */
export function dud(cost: number): CardStats {
  return { cost, type: 'spell', spell: { radius: 0, damage: 0, towerDamageBp: 0 } };
}

/**
 * Eight spells named by their cost, so a test can read what a play spends and nothing lands on the field.
 * Then two troops: `walker` (speed 50, radius 500, melee, 50 damage) and `archer` (speed 40, radius 400,
 * range 3000, 20 damage).
 */
export const CARDS: Record<CardId, CardStats> = {
  c1: dud(1),
  c2: dud(2),
  c3: dud(3),
  c4: dud(4),
  c5: dud(5),
  c6: dud(6),
  c7: dud(7),
  c8: dud(8),
};

/**
 * Both hit every 10 ticks, the first time 5 ticks after locking on, and notice enemies 4 tiles off.
 * Their hits land at once, on their target alone.
 */
const FIGHT = { hitTicks: 10, firstHitTicks: 5, sight: 4000, targets: 'ground', layer: 'ground', count: 1, splash: 0, projectileSpeed: 0 } as const;

export const TROOPS: Record<CardId, CardStats> = {
  walker: { cost: 1, type: 'troop', unit: { hp: 500, speed: 50, radius: 500, mass: 5, range: 0, damage: 50, ...FIGHT } },
  archer: { cost: 1, type: 'troop', unit: { hp: 200, speed: 40, radius: 400, mass: 3, range: 3000, damage: 20, ...FIGHT } },
};

/**
 * Flying units and who can reach them: `flyer` (radius 400, speed 50, range 1000, `air`: hits air and
 * ground), `gunner` (a ground archer whose filter is `air`), plus the walker and archer from `TROOPS`.
 */
export const AIR_TROOPS: Record<CardId, CardStats> = {
  ...TROOPS,
  flyer: { cost: 1, type: 'troop', unit: { hp: 300, speed: 50, radius: 400, mass: 3, range: 1000, damage: 30, ...FIGHT, targets: 'air', layer: 'air' } },
  gunner: { cost: 1, type: 'troop', unit: { hp: 200, speed: 40, radius: 400, mass: 3, range: 3000, damage: 20, ...FIGHT, targets: 'air' } },
};

export const AIR_DECK: CardId[] = ['walker', 'archer', 'flyer', 'gunner', 'walker', 'archer', 'flyer', 'gunner'];

/** A match where both sides play `AIR_DECK`, towers at full strength unless `harmless`. */
export function airMatch(seed: number, harmless = false): SimState {
  const towerStats = harmless ? { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } } : TOWER_STATS;
  return createMatch({ ...matchSetup(seed), towerStats, cards: AIR_TROOPS, decks: [AIR_DECK, AIR_DECK] });
}

export const DECK: CardId[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

/** Only `walker`s and `archer`s, alternating, so any hand slot holds a troop that costs 1. */
export const TROOP_DECK: CardId[] = ['walker', 'archer', 'walker', 'archer', 'walker', 'archer', 'walker', 'archer'];

/** `TROOPS` and `TOWER_STATS` that deal no damage, for tests about movement alone. */
export const HARMLESS_TROOPS: Record<CardId, CardStats> = Object.fromEntries(
  Object.entries(TROOPS).map(([id, card]) => [id, card.type === 'troop' ? { ...card, unit: { ...card.unit, damage: 0 } } : card]),
);

/** A troop match where nothing can hurt anything: units still lock on, but only walk and stand. */
export function walkMatch(seed: number): SimState {
  const towerStats = { keep: { ...TOWER_STATS.keep, damage: 0 }, outpost: { ...TOWER_STATS.outpost, damage: 0 } };
  return createMatch({ ...matchSetup(seed), towerStats, cards: HARMLESS_TROOPS, decks: [TROOP_DECK, TROOP_DECK] });
}

/** A match where both sides play `TROOP_DECK`. */
export function troopMatch(seed: number, rules: MatchRules = RULES): SimState {
  return createMatch({ ...matchSetup(seed, rules), cards: TROOPS, decks: [TROOP_DECK, TROOP_DECK] });
}

/**
 * A small arena for sim tests, which can't import `content`: 10 × 20 tiles, a river across the middle,
 * one bridge per lane, and a Keep with two Outposts per side.
 */
export const ARENA: ArenaLayout = {
  width: 10_000,
  height: 20_000,
  river: { x: 0, y: 9000, width: 10_000, height: 2000 },
  bridges: [
    { lane: 'left', x: 1000, y: 9000, width: 2000, height: 2000 },
    { lane: 'right', x: 7000, y: 9000, width: 2000, height: 2000 },
  ],
  towers: [
    { kind: 'keep', side: 0, lane: null, x: 5000, y: 2000, size: 2000 },
    { kind: 'outpost', side: 0, lane: 'left', x: 2000, y: 5000, size: 2000 },
    { kind: 'outpost', side: 0, lane: 'right', x: 8000, y: 5000, size: 2000 },
    { kind: 'keep', side: 1, lane: null, x: 5000, y: 18_000, size: 2000 },
    { kind: 'outpost', side: 1, lane: 'left', x: 2000, y: 15_000, size: 2000 },
    { kind: 'outpost', side: 1, lane: 'right', x: 8000, y: 15_000, size: 2000 },
  ],
};

/**
 * Towers reach 2 tiles past their footprint and hit for 10 every 10 ticks, the first time 5 ticks
 * after locking on. Their hits land at once.
 */
const TOWER_ATTACK = { damage: 10, hitTicks: 10, firstHitTicks: 5, range: 2000, splash: 0, projectileSpeed: 0 };

export const TOWER_STATS: Record<TowerKind, TowerStats> = {
  keep: { hp: 300, ...TOWER_ATTACK },
  outpost: { hp: 200, ...TOWER_ATTACK },
};

export function matchSetup(seed: number, rules: MatchRules = RULES): MatchSetup {
  return { seed, rules, arena: ARENA, towerStats: TOWER_STATS, cards: CARDS, decks: [DECK, DECK] };
}

export function newMatch(seed: number, rules: MatchRules = RULES): SimState {
  return createMatch(matchSetup(seed, rules));
}

/** Steps `ticks` times with no commands. */
export function idle(state: SimState, ticks: number): SimState {
  let current = state;
  for (let i = 0; i < ticks; i++) {
    current = step(current, []);
  }
  return current;
}

export type Placement = Pick<Unit, 'side' | 'card' | 'x' | 'y'> & Partial<Unit>;

/** Puts units straight onto the field, ready to act, with ids from `nextId`. */
export function place(state: SimState, ...placements: Placement[]): SimState {
  const units = placements.map((placement, i): Unit => {
    const card = state.cards[placement.card];
    const hp = card?.type === 'troop' ? card.unit.hp : 1;
    return { id: state.nextId + i, hp, maxHp: hp, deployTicks: 0, targetId: null, cooldown: 0, ...placement };
  });
  return { ...state, units: [...state.units, ...units], nextId: state.nextId + units.length };
}

/** Steps with no commands, checking invariants every tick; returns every state, the first one included. */
export function runChecked(state: SimState, ticks: number): SimState[] {
  const states = [state];
  for (let i = 0; i < ticks; i++) {
    const next = step(states[states.length - 1] ?? state, []);
    expect(checkInvariants(next)).toEqual([]);
    states.push(next);
  }
  return states;
}
