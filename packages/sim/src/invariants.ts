import type { SimState } from './state.ts';

const UINT32_MAX = 0xffffffff;

/**
 * Rules that must hold after every tick (VISION §6). Returns one message per violation, so an
 * empty list means the state is healthy. Tools and tests run it every tick; `step` never does.
 */
export function checkInvariants(state: SimState): string[] {
  const violations: string[] = [];
  const { tick, rng, rules, arena, towers, stars, result } = state;
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
  let previousId = -1;
  for (const tower of towers) {
    const { id, hp, maxHp, x, y, size } = tower;
    const name = `tower ${String(id)}`;
    if (!Number.isSafeInteger(id) || id <= previousId) {
      violations.push(`${name} breaks unique ascending ids (after ${String(previousId)})`);
    }
    previousId = id;
    if (!isIntegerIn(maxHp, 1, Number.MAX_SAFE_INTEGER) || !isIntegerIn(hp, 0, maxHp)) {
      violations.push(`${name} has hp ${String(hp)} of ${String(maxHp)}`);
    }
    const half = Math.floor(size / 2);
    const inside =
      isIntegerIn(size, 1, arena.width) &&
      isIntegerIn(x - half, 0, arena.width - size) &&
      isIntegerIn(y - half, 0, arena.height - size);
    if (!inside) {
      violations.push(`${name} (${String(x)}, ${String(y)}) size ${String(size)} is not inside the arena`);
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
