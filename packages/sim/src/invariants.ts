import { MAX_STARS, type SimState } from './state.ts';

const UINT32_MAX = 0xffffffff;

/**
 * Rules that must hold after every tick (VISION §6). Returns one message per violation, so an
 * empty list means the state is healthy. Tools and tests run it every tick; `step` never does.
 */
export function checkInvariants(state: SimState): string[] {
  const violations: string[] = [];
  const { tick, rng, rules, arena, towers, units, nextId, cards, players, stars, result } = state;
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
    violations.push(...checkAttack(name, tower));
    if (tower.dormant) {
      const lost = towers.some((other) => other.side === tower.side && other.kind === 'outpost' && other.hp === 0);
      if (tower.kind !== 'keep' || hp !== maxHp || lost || tower.targetId !== null) {
        violations.push(`${name} is dormant, but only an unhurt Keep with its Outposts standing and no target can be`);
      }
    } else if (typeof tower.dormant !== 'boolean') {
      violations.push(`${name} has dormant ${String(tower.dormant)}, not a boolean`);
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
  for (const unit of units) {
    const { id, x, y, hp, maxHp, deployTicks, card } = unit;
    const name = `unit ${String(id)}`;
    if (!Number.isSafeInteger(id) || id <= previousId || id >= nextId) {
      violations.push(`${name} breaks unique ascending ids (after ${String(previousId)}, next ${String(nextId)})`);
    }
    previousId = id;
    if (!isIntegerIn(maxHp, 1, Number.MAX_SAFE_INTEGER) || !isIntegerIn(hp, 1, maxHp)) {
      violations.push(`${name} has hp ${String(hp)} of ${String(maxHp)}`);
    }
    violations.push(...checkAttack(name, unit));
    if (!isIntegerIn(deployTicks, 0, rules.deployDelayTicks)) {
      violations.push(`${name} has ${String(deployTicks)} deploy ticks left`);
    }
    const stats = Object.hasOwn(cards, card) ? cards[card] : undefined;
    const flying = stats?.type === 'troop' && stats.unit.layer === 'air';
    if (!isIntegerIn(x, 0, arena.width - 1) || !isIntegerIn(y, 0, arena.height - 1)) {
      violations.push(`${name} (${String(x)}, ${String(y)}) is outside the arena`);
    } else if (!flying && inRiver(arena, x, y) && !arena.bridges.some((bridge) => x >= bridge.x && x <= bridge.x + bridge.width)) {
      violations.push(`${name} (${String(x)}, ${String(y)}) is in the river off any bridge`);
    }
    if (stats?.type !== 'troop') {
      violations.push(`${name} comes from ${card}, which is not a known troop`);
    }
  }
  const { max, ticksPerEnergy } = rules.energy;
  for (const side of [0, 1] as const) {
    const { energy, energyProgress, hand, queue } = players[side];
    const name = `side ${String(side)}`;
    if (!isIntegerIn(energy, 0, max)) {
      violations.push(`${name} has ${String(energy)} energy, outside [0, ${String(max)}]`);
    }
    const progressMax = energy === max ? 0 : ticksPerEnergy - 1;
    if (!isIntegerIn(energyProgress, 0, progressMax)) {
      violations.push(`${name} has energy progress ${String(energyProgress)} at ${String(energy)} energy`);
    }
    if (hand.length !== rules.handSize || hand.length + queue.length !== rules.deckSize) {
      const counts = `${String(hand.length)} + ${String(queue.length)}`;
      violations.push(`${name} holds ${counts} cards, not ${String(rules.handSize)} + ${String(rules.deckSize - rules.handSize)}`);
    }
    for (const id of [...hand, ...queue]) {
      if (!Object.hasOwn(cards, id)) {
        violations.push(`${name} holds an unknown card: ${id}`);
      }
    }
  }
  for (const { side, card, x, y } of state.blasts) {
    if (cards[card]?.type !== 'spell' || !isIntegerIn(x, 0, arena.width - 1) || !isIntegerIn(y, 0, arena.height - 1)) {
      violations.push(`side ${String(side)}'s blast of ${card} at (${String(x)}, ${String(y)}) is not a known spell inside the arena`);
    }
  }
  for (const side of [0, 1] as const) {
    if (!isIntegerIn(stars[side], 0, MAX_STARS)) {
      violations.push(`side ${String(side)} has ${String(stars[side])} stars`);
    }
  }
  for (const keep of towers) {
    if (keep.kind === 'keep' && keep.hp === 0 && result === null) {
      violations.push(`side ${String(keep.side)}'s Keep has fallen but the match has no result`);
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

/** A target id, if any, is an id an entity has had; the cooldown is a whole number of ticks. */
function checkAttack(name: string, { targetId, cooldown }: { targetId: number | null; cooldown: number }): string[] {
  const bad = (targetId !== null && !isIntegerIn(targetId, 0, Number.MAX_SAFE_INTEGER)) || !isIntegerIn(cooldown, 0, Number.MAX_SAFE_INTEGER);
  return bad ? [`${name} has target ${String(targetId)} and cooldown ${String(cooldown)}`] : [];
}

function inRiver({ river }: SimState['arena'], x: number, y: number): boolean {
  return x >= river.x && x < river.x + river.width && y >= river.y && y < river.y + river.height;
}

function isIntegerIn(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
