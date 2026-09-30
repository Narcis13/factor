import { checkInvariants, createMatch, step, type Command, type RejectedCommand, type SimState } from '@factor/sim';
import { matchSetup, STARTER_DECKS } from '@factor/content';
import type { CardId } from '@factor/sim';

/** Plays `commands` back from the seed, checking invariants every tick; returns every state and every rejection. */
export function replayChecked(
  seed: number,
  commands: readonly Command[],
  decks: readonly [readonly CardId[], readonly CardId[]] = STARTER_DECKS,
): { states: SimState[]; rejected: RejectedCommand[] } {
  let state = createMatch(matchSetup(seed, decks));
  const states = [state];
  const rejected: RejectedCommand[] = [];
  let next = 0;
  while (state.result === null) {
    const first = next;
    while (commands[next]?.tick === state.tick) {
      next++;
    }
    state = step(state, commands.slice(first, next));
    const violations = checkInvariants(state);
    if (violations.length > 0) {
      throw new Error(`Invariants broken at tick ${String(state.tick)}:\n  ${violations.join('\n  ')}`);
    }
    states.push(state);
    rejected.push(...state.rejected);
  }
  if (next < commands.length) {
    throw new Error(`${String(commands.length - next)} commands were never played`);
  }
  return { states, rejected };
}
