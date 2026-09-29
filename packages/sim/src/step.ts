import { copyPlayer, playCard, regenerate } from './cards.ts';
import { decideResult } from './result.ts';
import { copyCards, copyRules, copyTerrain, type Command, type RejectReason, type SimState } from './state.ts';
import { actUnit, deployZone, inRect } from './troops.ts';

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
        next.units.push({ id: next.nextId, side, card: card.id, x, y, hp, maxHp: hp, deployTicks: next.rules.deployDelayTicks });
        next.nextId += 1;
      }
    } else {
      next.rejected.push({ command: { ...command }, reason });
    }
  }
  // Units act in id order; new ones start their deploy delay this very tick.
  for (const unit of next.units) {
    const stats = next.cards[unit.card];
    if (stats?.type !== 'troop') {
      throw new RangeError(`Unit ${String(unit.id)} comes from ${unit.card}, which is not a troop`);
    }
    actUnit(unit, stats.unit, next.arena, next.towers);
  }
  const { energy } = next.rules;
  const rate = state.tick >= energy.doubleFromTick ? 2 : 1;
  for (const player of next.players) {
    regenerate(player, energy, rate);
  }
  next.result = decideResult(next);
  return next;
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
