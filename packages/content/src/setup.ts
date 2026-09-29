import type { MatchSetup } from '@factor/sim';
import { ARENA } from './arena.ts';
import { MATCH_RULES } from './match.ts';
import { TOWER_STATS } from './towers.ts';

/** A match on the one arena with the current rules and stats: everything but the seed is content. */
export function matchSetup(seed: number): MatchSetup {
  return { seed, rules: MATCH_RULES, arena: ARENA, towerStats: TOWER_STATS };
}
