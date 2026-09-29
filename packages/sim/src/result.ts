import type { MatchResult, SimState } from './state.ts';

/**
 * The result the match reaches at `state.tick`, or `null` while play goes on (VISION §4, Winning).
 * A fallen Keep ends the match at once: more stars wins (both Keeps falling together is a draw).
 * Once regulation runs out, any star lead wins, which also makes the first star in overtime win.
 * Stars still tied when overtime runs out is a draw. The tower-HP tiebreak comes in Stage 2.
 */
export function decideResult(state: SimState): MatchResult | null {
  const { tick, stars, rules } = state;
  if (state.towers.some((tower) => tower.kind === 'keep' && tower.hp === 0)) {
    return { winner: stars[0] === stars[1] ? null : stars[0] > stars[1] ? 0 : 1 };
  }
  if (tick < rules.regulationTicks) {
    return null;
  }
  if (stars[0] !== stars[1]) {
    return { winner: stars[0] > stars[1] ? 0 : 1 };
  }
  if (tick < rules.regulationTicks + rules.overtimeTicks) {
    return null;
  }
  return { winner: null };
}
