import type { SimState } from './state.ts';

const UINT32_MAX = 0xffffffff;

/**
 * Rules that must hold after every tick (VISION §6). Returns one message per violation, so an
 * empty list means the state is healthy. Tools and tests run it every tick; `step` never does.
 */
export function checkInvariants(state: SimState): string[] {
  const violations: string[] = [];
  const { tick, rng, rules, stars, result } = state;
  const endTick = rules.regulationTicks + rules.overtimeTicks;

  if (!isIntegerIn(tick, 0, endTick)) {
    violations.push(`tick ${String(tick)} is outside [0, ${String(endTick)}]`);
  }
  if (tick === endTick && result === null) {
    violations.push('the timer ran out but the match has no result');
  }
  for (const word of ['a', 'b', 'c', 'counter'] as const) {
    if (!isIntegerIn(rng[word], 0, UINT32_MAX)) {
      violations.push(`rng.${word} ${String(rng[word])} is not a uint32`);
    }
  }
  for (const side of [0, 1] as const) {
    if (!isIntegerIn(stars[side], 0, Number.MAX_SAFE_INTEGER)) {
      violations.push(`side ${String(side)} has ${String(stars[side])} stars`);
    }
  }
  if (result !== null) {
    if (result.winner === null && stars[0] !== stars[1]) {
      violations.push(`a draw with stars ${String(stars[0])}-${String(stars[1])}`);
    }
    if (result.winner !== null) {
      const loser = result.winner === 0 ? 1 : 0;
      if (stars[result.winner] < stars[loser]) {
        violations.push(`side ${String(result.winner)} won with fewer stars`);
      }
    }
  }
  return violations;
}

function isIntegerIn(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
