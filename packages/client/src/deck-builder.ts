import { CARDS, DECK_CARD_IDS, MATCH_RULES, parseDeck, STARTER_DECK, type ContentCardId } from '@factor/content';
import { MILLI_PER_TILE, TICKS_PER_SECOND } from '@factor/sim';

/** Where the player's deck is kept in the browser. */
export const DECK_STORAGE_KEY = 'factor.deck';

/** The deck kept in storage, if it is still a valid deck; the starter deck otherwise. */
export function storedDeck(text: string | null): ContentCardId[] {
  if (text === null) {
    return [...STARTER_DECK];
  }
  try {
    return parseDeck(JSON.parse(text)) ?? [...STARTER_DECK];
  } catch {
    return [...STARTER_DECK];
  }
}

/** Takes `card` out of the draft if it's in, or adds it at the end if there is room. A copy. */
export function toggleCard(draft: readonly ContentCardId[], card: ContentCardId): ContentCardId[] {
  if (draft.includes(card)) {
    return draft.filter((id) => id !== card);
  }
  return draft.length < MATCH_RULES.deckSize ? [...draft, card] : [...draft];
}

/** Whether the draft is a deck the match will take. */
export function isComplete(draft: readonly ContentCardId[]): boolean {
  return parseDeck(draft) !== null;
}

/** What the deck builder shows for a card: its name, cost, kind and a few plain facts from its stats. */
export interface CardSummary {
  id: ContentCardId;
  name: string;
  cost: number;
  kind: 'Troop' | 'Building' | 'Spell';
  facts: string[];
}

/** Every deck card's summary, in catalog order. */
export function cardSummaries(): CardSummary[] {
  return DECK_CARD_IDS.map(cardSummary);
}

export function cardSummary(id: ContentCardId): CardSummary {
  const card = CARDS[id];
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  if (card.type === 'spell') {
    const { radius, damage, towerDamageBp } = card.spell;
    return { id, name, cost: card.cost, kind: 'Spell', facts: [`${String(damage)} damage`, `${tiles(radius)}-tile radius`, `${String(towerDamageBp / 100)}% to towers`] };
  }
  if (card.type === 'building') {
    const { hp, damage, range, targets } = card.unit;
    const { lifetimeTicks, spawn } = card;
    const life = `${String(lifetimeTicks / TICKS_PER_SECOND)} s`;
    const job = spawn === null ? `${String(damage)} damage · ${tiles(range)} tiles · ${reach(targets)}` : `spawns ${spawn.card}s every ${String(spawn.everyTicks / TICKS_PER_SECOND)} s`;
    return { id, name, cost: card.cost, kind: 'Building', facts: [`${String(hp)} hp · ${life}`, job] };
  }
  const { hp, damage, range, targets, layer, count, splash } = card.unit;
  const group = count > 1 ? `×${String(count)} · ` : '';
  const style = range >= MILLI_PER_TILE ? `ranged ${tiles(range)} tiles` : 'melee';
  return {
    id,
    name,
    cost: card.cost,
    kind: 'Troop',
    facts: [`${group}${String(hp)} hp · ${String(damage)} damage`, `${style}${splash > 0 ? ' · splash' : ''}`, `${layer === 'air' ? 'flies · ' : ''}${reach(targets)}`],
  };
}

function tiles(milli: number): string {
  return String(milli / MILLI_PER_TILE);
}

function reach(targets: string): string {
  return targets === 'buildings' ? 'hits buildings only' : targets === 'air' ? 'hits air and ground' : 'hits ground';
}

/** The page that starts a live match on `seed`. */
export function matchUrl(seed: number): string {
  return `?play&seed=${String(seed)}`;
}


