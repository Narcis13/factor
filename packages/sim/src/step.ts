import type { Command, RejectReason, SimState } from './state.ts';

/**
 * Advances the match by exactly one tick. `commands` are the commands for `state.tick`.
 * Never mutates its inputs: the client keeps the previous state to interpolate from.
 */
export function step(state: SimState, commands: readonly Command[]): SimState {
  const next: SimState = {
    tick: state.tick + 1,
    rng: { ...state.rng },
    rejected: [],
  };
  // Side 0 resolves first, whatever order the commands arrived in; order within a side is kept.
  const ordered = [...commands].sort((p, q) => p.side - q.side);
  for (const command of ordered) {
    const reason = validate(state, command);
    next.rejected.push({ command: { ...command }, reason });
  }
  return next;
}

function validate(state: SimState, command: Command): RejectReason {
  if (command.tick !== state.tick) {
    return 'wrong-tick';
  }
  return 'empty-slot';
}
