import { playBotMatch } from '@factor/bot';
import { matchSetup, parseReplay, REPLAY_VERSION, STARTER_DECK, type Replay } from '@factor/content';
import { checkInvariants, createMatch, hashState, step, TICKS_PER_SECOND, type SimState } from '@factor/sim';

/** A match on the starter decks with no commands. */
export function emptyReplay(seed: number): Replay {
  return { version: REPLAY_VERSION, seed, decks: [[...STARTER_DECK], [...STARTER_DECK]], commands: [] };
}

/** The replay of a random bot playing each side on the starter decks: what every CLI match is. */
export function botReplay(seed: number): Replay {
  return playBotReplay(seed).replay;
}

/** Plays a bot-vs-bot match live, as `botReplay` does, and returns its replay with the state it ended in. */
export function playBotReplay(seed: number): { replay: Replay; state: SimState } {
  const decks: Replay['decks'] = [[...STARTER_DECK], [...STARTER_DECK]];
  const { state, commands } = playBotMatch(seed, decks);
  return { replay: { version: REPLAY_VERSION, seed, decks, commands }, state };
}

/**
 * Validates and plays a replay, feeding each command at its tick and checking invariants after every tick
 * (a broken one throws an `InvariantError`).
 * Stops when the match ends, or at `stopTick` if that comes first. `onStep` sees every state it steps to.
 * Throws if the match ends with commands still unplayed: the replay can't be from this match.
 */
export function playReplay(replay: Replay, stopTick?: number, onStep?: (state: SimState) => void): SimState {
  const { seed, decks, commands } = parseReplay(replay);
  let state = createMatch(matchSetup(seed, decks));
  assertHealthy(state);
  let next = 0;
  while (state.result === null && state.tick !== stopTick) {
    const first = next;
    while (commands[next]?.tick === state.tick) {
      next++;
    }
    state = step(state, commands.slice(first, next));
    assertHealthy(state);
    onStep?.(state);
  }
  if (state.result !== null && next < commands.length) {
    const left = commands.length - next;
    throw new Error(`The match ended at tick ${String(state.tick)} with ${String(left)} commands unplayed`);
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

/** A state that broke the sim's invariants, as opposed to a replay that doesn't fit its match. */
export class InvariantError extends Error {}

function assertHealthy(state: SimState): void {
  const violations = checkInvariants(state);
  if (violations.length > 0) {
    throw new InvariantError(`Invariants broken at tick ${String(state.tick)}:\n  ${violations.join('\n  ')}`);
  }
}
