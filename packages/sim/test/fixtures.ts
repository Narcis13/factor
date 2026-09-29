import { createMatch, step, type MatchRules, type SimState } from '../src/index.ts';

/** Test fixture rules sized like a real match: 3:00 plus 2:00 of overtime at 20 ticks/s. */
export const RULES: MatchRules = { regulationTicks: 3600, overtimeTicks: 2400 };

export function newMatch(seed: number, rules: MatchRules = RULES): SimState {
  return createMatch({ seed, rules });
}

/** Steps `ticks` times with no commands. */
export function idle(state: SimState, ticks: number): SimState {
  let current = state;
  for (let i = 0; i < ticks; i++) {
    current = step(current, []);
  }
  return current;
}
