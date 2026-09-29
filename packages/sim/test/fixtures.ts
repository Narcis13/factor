import {
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
} from '../src/index.ts';

/**
 * Test fixture rules sized like a real match: 3:00 plus 2:00 of overtime at 20 ticks/s, decks of 8,
 * hands of 4, and energy from 5 up to 10 at one per 56 ticks, twice as fast from 2:00 on.
 */
export const RULES: MatchRules = {
  regulationTicks: 3600,
  overtimeTicks: 2400,
  deckSize: 8,
  handSize: 4,
  energy: { start: 5, max: 10, ticksPerEnergy: 56, doubleFromTick: 2400 },
};

/** Eight cards named by their cost, so a test can read what a play spends. */
export const CARDS: Record<CardId, CardStats> = {
  c1: { cost: 1 },
  c2: { cost: 2 },
  c3: { cost: 3 },
  c4: { cost: 4 },
  c5: { cost: 5 },
  c6: { cost: 6 },
  c7: { cost: 7 },
  c8: { cost: 8 },
};

export const DECK: CardId[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

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

export const TOWER_STATS: Record<TowerKind, TowerStats> = { keep: { hp: 300 }, outpost: { hp: 200 } };

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
