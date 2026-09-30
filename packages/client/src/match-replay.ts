import { loadReplay, REPLAY_VERSION, type ContentCardId, type Replay } from '@factor/content';
import type { MatchLoop } from './match-loop.ts';

/** Where the last finished match's replay is kept in the browser. */
export const REPLAY_STORAGE_KEY = 'factor.lastReplay';

/** The replay of the match the loop has played so far: its seed, both decks and every command it sent. */
export function loopReplay(seed: number, decks: readonly [readonly ContentCardId[], readonly ContentCardId[]], loop: MatchLoop): Replay {
  return { version: REPLAY_VERSION, seed, decks: [[...decks[0]], [...decks[1]]], commands: loop.commands.map((command) => ({ ...command })) };
}

/** Where a replay's text comes from: this browser's storage, or the network. */
export interface ReplaySources {
  /** The text kept under `REPLAY_STORAGE_KEY`, or `null` if there is none. */
  stored: () => string | null;
  fetchText: (url: string) => Promise<string>;
}

/**
 * The replay `?replay=` names, validated: `last` is the last finished match kept in this browser;
 * anything else is a URL, relative to the page. Throws if there is none or it isn't a valid replay.
 */
export async function readReplay(name: string, sources: ReplaySources): Promise<Replay> {
  if (name === 'last') {
    const text = sources.stored();
    if (text === null) {
      throw new Error('No replay is saved in this browser yet: finish a match first');
    }
    return loadReplay(text);
  }
  return loadReplay(await sources.fetchText(name));
}
