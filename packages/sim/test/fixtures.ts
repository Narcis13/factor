import {
  createMatch,
  step,
  type ArenaLayout,
  type MatchRules,
  type SimState,
  type TowerKind,
  type TowerStats,
} from '../src/index.ts';

/** Test fixture rules sized like a real match: 3:00 plus 2:00 of overtime at 20 ticks/s. */
export const RULES: MatchRules = { regulationTicks: 3600, overtimeTicks: 2400 };

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

export function newMatch(seed: number, rules: MatchRules = RULES): SimState {
  return createMatch({ seed, rules, arena: ARENA, towerStats: TOWER_STATS });
}

/** Steps `ticks` times with no commands. */
export function idle(state: SimState, ticks: number): SimState {
  let current = state;
  for (let i = 0; i < ticks; i++) {
    current = step(current, []);
  }
  return current;
}
