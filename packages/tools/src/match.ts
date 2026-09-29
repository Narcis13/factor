import { MATCH_RULES } from '@factor/content';
import { checkInvariants, createMatch, hashState, step, TICKS_PER_SECOND, type SimState } from '@factor/sim';

/**
 * Plays a match with no commands, checking invariants after every tick.
 * Stops when the match ends, or at `stopTick` if that comes first.
 */
export function runMatch(seed: number, stopTick?: number): SimState {
  let state = createMatch({ seed, rules: MATCH_RULES });
  assertHealthy(state);
  while (state.result === null && state.tick !== stopTick) {
    state = step(state, []);
    assertHealthy(state);
  }
  return state;
}

/** A short, line-per-fact summary of a finished match. */
export function describeResult(seed: number, state: SimState): string {
  const { result, stars, rules, tick } = state;
  const outcome =
    result === null ? 'unfinished' : result.winner === null ? 'draw' : `side ${String(result.winner)} wins`;
  const period = tick > rules.regulationTicks ? ', overtime' : '';
  return [
    `seed    ${String(seed)}`,
    `result  ${outcome}`,
    `ended   tick ${String(tick)} (${formatClock(tick)}${period})`,
    `stars   ${String(stars[0])}-${String(stars[1])}`,
    `hash    ${hashState(state)}`,
  ].join('\n');
}

/** Match time as m:ss. */
export function formatClock(ticks: number): string {
  const seconds = Math.floor(ticks / TICKS_PER_SECOND);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

function assertHealthy(state: SimState): void {
  const violations = checkInvariants(state);
  if (violations.length > 0) {
    throw new Error(`Invariants broken at tick ${String(state.tick)}:\n  ${violations.join('\n  ')}`);
  }
}
