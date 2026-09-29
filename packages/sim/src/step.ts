import { copyPlayer, playCard, regenerate } from './cards.ts';
import { decideResult } from './result.ts';
import { copyCards, copyRules, copyTerrain, copyTowerStats, type Command, type RejectReason, type SimState } from './state.ts';
import { actTower, actUnit, deployZone, inRect, unitStats, type Hit } from './troops.ts';

/**
 * Advances the match by exactly one tick. `commands` are the commands for `state.tick`.
 * Never mutates its inputs: the client keeps the previous state to interpolate from.
 * Throws if the match has already ended; callers stop stepping once `result` is set.
 */
export function step(state: SimState, commands: readonly Command[]): SimState {
  if (state.result !== null) {
    throw new Error(`The match already ended at tick ${String(state.tick)}`);
  }
  const next: SimState = {
    tick: state.tick + 1,
    rng: { ...state.rng },
    rules: copyRules(state.rules),
    arena: copyTerrain(state.arena),
    towers: state.towers.map((tower) => ({ ...tower })),
    towerStats: copyTowerStats(state.towerStats),
    units: state.units.map((unit) => ({ ...unit })),
    nextId: state.nextId,
    cards: copyCards(state.cards),
    players: [copyPlayer(state.players[0]), copyPlayer(state.players[1])],
    stars: [state.stars[0], state.stars[1]],
    result: null,
    rejected: [],
  };
  // Side 0 resolves first, whatever order the commands arrived in; order within a side is kept.
  // Each command sees the energy and hand the ones before it left.
  const ordered = [...commands].sort((p, q) => p.side - q.side);
  for (const command of ordered) {
    const reason = validate(state.tick, next, command);
    if (reason === null) {
      const card = handCard(next, command);
      playCard(next.players[command.side], command.handSlot, card.stats.cost);
      if (card.stats.type === 'troop') {
        const { hp } = card.stats.unit;
        const { side, x, y } = command;
        const deployTicks = next.rules.deployDelayTicks;
        next.units.push({ id: next.nextId, side, card: card.id, x, y, hp, maxHp: hp, deployTicks, targetId: null, cooldown: 0 });
        next.nextId += 1;
      }
    } else {
      next.rejected.push({ command: { ...command }, reason });
    }
  }
  fight(next);
  const { energy } = next.rules;
  const rate = state.tick >= energy.doubleFromTick ? 2 : 1;
  for (const player of next.players) {
    regenerate(player, energy, rate);
  }
  next.result = decideResult(next);
  return next;
}

/**
 * Towers, then units, act in id order; a new unit starts its deploy delay this very tick. Their hits
 * land together afterwards, so a unit that dies this tick still lands its own hit. Then the dead leave
 * the field and fallen towers score (VISION §4, Winning): an Outpost earns its destroyer 1 star, the
 * Keep brings them to 3.
 */
function fight(state: SimState): void {
  const hits: Hit[] = [];
  for (const tower of state.towers) {
    actTower(tower, state.towerStats[tower.kind], state, hits);
  }
  for (const unit of state.units) {
    actUnit(unit, unitStats(state, unit), state, hits);
  }
  const standing = state.towers.filter((tower) => tower.hp > 0);
  for (const { targetId, damage } of hits) {
    const target = state.towers.find((tower) => tower.id === targetId) ?? state.units.find((unit) => unit.id === targetId);
    if (target !== undefined) {
      target.hp = Math.max(0, target.hp - damage);
    }
  }
  state.units = state.units.filter((unit) => unit.hp > 0);
  for (const tower of standing) {
    if (tower.hp === 0) {
      const scorer = tower.side === 0 ? 1 : 0;
      state.stars[scorer] = tower.kind === 'keep' ? 3 : Math.min(3, state.stars[scorer] + 1);
    }
  }
}

/** `null` if `command` can be played on `state`, which is the state being built for the tick after `tick`. */
function validate(tick: number, state: SimState, command: Command): RejectReason | null {
  if (command.tick !== tick) {
    return 'wrong-tick';
  }
  const { handSlot, x, y } = command;
  if (!Number.isSafeInteger(handSlot) || handSlot < 0 || handSlot >= state.players[command.side].hand.length) {
    return 'bad-slot';
  }
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || x >= state.arena.width || y < 0 || y >= state.arena.height) {
    return 'out-of-bounds';
  }
  const { stats } = handCard(state, command);
  if (stats.type === 'troop' && !inRect(deployZone(state.arena, command.side), x, y)) {
    return 'outside-deploy-zone';
  }
  if (state.players[command.side].energy < stats.cost) {
    return 'not-enough-energy';
  }
  return null;
}

/** The card in the command's hand slot, and its stats. The slot has been checked. */
function handCard(state: SimState, command: Command) {
  const id = state.players[command.side].hand[command.handSlot];
  const stats = id !== undefined && Object.hasOwn(state.cards, id) ? state.cards[id] : undefined;
  if (id === undefined || stats === undefined) {
    throw new RangeError(`No card in side ${String(command.side)}'s hand slot ${String(command.handSlot)}`);
  }
  return { id, stats };
}
