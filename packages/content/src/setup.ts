import type { CardId, MatchSetup } from '@factor/sim';
import { ARENA } from './arena.ts';
import { CARDS, STARTER_DECK, type ContentCardId } from './cards.ts';
import { MATCH_RULES } from './match.ts';
import { TOWER_STATS } from './towers.ts';

/** Both sides play the starter deck until there is a deck builder. */
export const STARTER_DECKS: [ContentCardId[], ContentCardId[]] = [STARTER_DECK, STARTER_DECK];

/** A match on the one arena with the current rules and stats: everything but the seed and decks is content. */
export function matchSetup(seed: number, decks: readonly [readonly CardId[], readonly CardId[]] = STARTER_DECKS): MatchSetup {
  return { seed, rules: MATCH_RULES, arena: ARENA, towerStats: TOWER_STATS, cards: CARDS, decks: [[...decks[0]], [...decks[1]]] };
}
