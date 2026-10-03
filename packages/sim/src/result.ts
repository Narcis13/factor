import type { MatchResult, Side, SimState } from './state.ts';

/**
 * The result the match reaches at `state.tick`, or `null` while play goes on (VISION §4, Winning).
 * A fallen Keep ends the match at once: more stars wins (both Keeps falling together is a draw).
 * Once regulation runs out, any star lead wins, which also makes the first star in overtime win.
 * Stars still tied when overtime runs out go to the tiebreak: the side whose weakest standing tower
 * has less hp loses; the same hp is a draw.
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
  const [weakest0, weakest1] = [weakestTower(state, 0), weakestTower(state, 1)];
  return { winner: weakest0 === weakest1 ? null : weakest0 < weakest1 ? 1 : 0 };
}

/** The hp of `side`'s weakest standing tower. Its Keep stands, or the match would have ended. */
function weakestTower(state: SimState, side: Side): number {
  let weakest = Number.MAX_SAFE_INTEGER;
  for (const tower of state.towers) {
    if (tower.side === side && tower.hp > 0) {
      weakest = Math.min(weakest, tower.hp);
    }
  }
  return weakest;
}
