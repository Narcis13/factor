import { REPLAY_VERSION, type ContentCardId, type Replay } from '@factor/content';
import type { MatchLoop } from './match-loop.ts';

/** Where the last finished match's replay is kept in the browser. */
export const REPLAY_STORAGE_KEY = 'factor.lastReplay';

/** The replay of the match the loop has played so far: its seed, both decks and every command it sent. */
export function loopReplay(seed: number, decks: readonly [readonly ContentCardId[], readonly ContentCardId[]], loop: MatchLoop): Replay {
  return { version: REPLAY_VERSION, seed, decks: [[...decks[0]], [...decks[1]]], commands: loop.commands.map((command) => ({ ...command })) };
}
