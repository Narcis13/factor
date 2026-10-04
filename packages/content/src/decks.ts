import { nextBelow, seedRng } from '@factor/sim';
import { DECK_CARD_IDS, type ContentCardId } from './cards.ts';
import { MATCH_RULES } from './match.ts';

/** Keeps a seed's deck apart from the match's own rng stream on the same seed. */
const DEAL_SALT = 0x5eed_deca;

/** A deck of eight different deck cards dealt from `seed`: the same seed always deals the same deck. */
export function dealDeck(seed: number): ContentCardId[] {
  const rng = seedRng((seed ^ DEAL_SALT) >>> 0);
  const pool = [...DECK_CARD_IDS];
  const deck: ContentCardId[] = [];
  while (deck.length < MATCH_RULES.deckSize) {
    const [card] = pool.splice(nextBelow(rng, pool.length), 1);
    if (card !== undefined) {
      deck.push(card);
    }
  }
  return deck;
}

/**
 * `cards` as a deck if it is one: exactly eight different deck cards. Anything else, `null`. For decks
 * that come from outside the type system (the browser's storage, a URL).
 */
export function parseDeck(cards: unknown): ContentCardId[] | null {
  if (!Array.isArray(cards) || cards.length !== MATCH_RULES.deckSize) {
    return null;
  }
  const deck: ContentCardId[] = [];
  for (const card of cards) {
    const known = DECK_CARD_IDS.find((id) => id === card);
    if (known === undefined || deck.includes(known)) {
      return null;
    }
    deck.push(known);
  }
  return deck;
}
