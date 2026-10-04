import { playBotMatch } from '@factor/bot';
import { BOT_TUNING, DECK_CARD_IDS, MATCH_RULES, REPLAY_VERSION, type ContentCardId, type Replay } from '@factor/content';
import { hashState, nextBelow, seedRng, type CardId } from '@factor/sim';
import { formatClock, playReplay } from './match.ts';

/** How one card fared across a balance sweep. */
export interface CardRecord {
  card: CardId;
  /** Decks it was in. */
  decks: number;
  /** Matches won and lost by a deck holding it (a card in both decks counts for neither). */
  wins: number;
  losses: number;
  /** Times it was played. */
  plays: number;
}

/** What a balance sweep found (VISION §8, Stage 3: balance sweeps flag outliers for the director). */
export interface BalanceReport {
  from: number;
  matches: number;
  /** Matches won, indexed by side, and drawn. */
  wins: [number, number];
  draws: number;
  totalTicks: number;
  /** Stars earned, both sides together. */
  stars: number;
  /** Per deck card, in catalog order. */
  cards: CardRecord[];
  /** Seeds whose replay broke an invariant or didn't reproduce the live match, with why. */
  failures: { seed: number; message: string }[];
}

/** A card's win rate is flagged once it is this far from 50%, in percentage points... */
export const OUTLIER_POINTS = 6;
/** ...and at least this many standard errors away, so noise alone rarely flags one. */
export const OUTLIER_ERRORS = 2;

/**
 * Two different random decks of eight deck cards for `seed`: the same seed always deals the same pair.
 * Each deck holds eight different cards.
 */
export function balanceDecks(seed: number): [ContentCardId[], ContentCardId[]] {
  const rng = seedRng(seed);
  const deal = (): ContentCardId[] => {
    const pool = [...DECK_CARD_IDS];
    const deck: ContentCardId[] = [];
    while (deck.length < MATCH_RULES.deckSize) {
      const [card] = pool.splice(nextBelow(rng, pool.length), 1);
      if (card !== undefined) {
        deck.push(card);
      }
    }
    return deck;
  };
  return [deal(), deal()];
}

/**
 * Plays `matches` heuristic-bot mirror matches on consecutive seeds from `from`, each on `balanceDecks`,
 * and tallies how every card fared. Each is played live, then from its replay with invariants checked
 * every tick, and both must end on the same hash; a match that fails is recorded and left out of the
 * tallies. `onMatch` hears each finished seed.
 */
export function balance(from: number, matches: number, onMatch?: (seed: number) => void): BalanceReport {
  const records = new Map<CardId, CardRecord>(DECK_CARD_IDS.map((card) => [card, { card, decks: 0, wins: 0, losses: 0, plays: 0 }]));
  const report: BalanceReport = { from, matches, wins: [0, 0], draws: 0, totalTicks: 0, stars: 0, cards: [...records.values()], failures: [] };
  for (let seed = from; seed < from + matches; seed++) {
    const decks = balanceDecks(seed);
    const live = playBotMatch(seed, decks, BOT_TUNING, ['heuristic', 'heuristic']);
    const replay: Replay = { version: REPLAY_VERSION, seed, decks: [[...decks[0]], [...decks[1]]], commands: live.commands };
    const plays: CardId[] = [];
    try {
      let next = 0;
      const played = playReplay(replay, undefined, (state) => {
        // A command taken on the tick before this state sent its card to the back of its side's queue.
        for (let command = live.commands[next]; command?.tick === state.tick - 1; command = live.commands[++next]) {
          if (!state.rejected.some((rejected) => rejected.command.side === command.side && rejected.command.handSlot === command.handSlot)) {
            plays.push(state.players[command.side].queue.at(-1) ?? '');
          }
        }
      });
      if (hashState(played) !== hashState(live.state)) {
        throw new Error(`live match hashed ${hashState(live.state)}, its replay ${hashState(played)}`);
      }
    } catch (error) {
      report.failures.push({ seed, message: error instanceof Error ? error.message : String(error) });
      onMatch?.(seed);
      continue;
    }
    const { result, tick, stars } = live.state;
    const winner = result?.winner ?? null;
    if (winner === null) {
      report.draws++;
    } else {
      report.wins[winner]++;
    }
    report.totalTicks += tick;
    report.stars += stars[0] + stars[1];
    for (const side of [0, 1] as const) {
      for (const card of new Set(decks[side])) {
        const record = records.get(card);
        const other = decks[side === 0 ? 1 : 0];
        if (record === undefined) {
          continue;
        }
        record.decks++;
        if (winner !== null && !other.includes(card)) {
          if (winner === side) {
            record.wins++;
          } else {
            record.losses++;
          }
        }
      }
    }
    for (const card of plays) {
      const record = records.get(card);
      if (record !== undefined) {
        record.plays++;
      }
    }
    onMatch?.(seed);
  }
  return report;
}

/** A card's win rate in [0, 1] and its standard error, from its decided matches (`null` with none). */
export function winRate({ wins, losses }: Pick<CardRecord, 'wins' | 'losses'>): { rate: number; error: number } | null {
  const decided = wins + losses;
  if (decided === 0) {
    return null;
  }
  const rate = wins / decided;
  return { rate, error: Math.sqrt((rate * (1 - rate)) / decided) };
}

/** Whether a card's win rate is an outlier: `OUTLIER_POINTS` off even, and `OUTLIER_ERRORS` standard errors clear of it. */
export function isOutlier(record: Pick<CardRecord, 'wins' | 'losses'>): boolean {
  const fared = winRate(record);
  if (fared === null) {
    return false;
  }
  const off = Math.abs(fared.rate - 0.5);
  return off * 100 >= OUTLIER_POINTS && off >= OUTLIER_ERRORS * fared.error;
}

/** The report as aligned lines: the totals, then every card from the highest win rate down, outliers marked. */
export function describeBalance(report: BalanceReport): string {
  const healthy = report.matches - report.failures.length;
  const lines = [
    `seeds       ${String(report.from)}..${String(report.from + report.matches - 1)} (${String(report.matches)} matches, ${String(healthy)} healthy, heuristic mirror on random decks)`,
    `results     side 0 ${String(report.wins[0])} · side 1 ${String(report.wins[1])} · draw ${String(report.draws)}`,
    `length      mean ${healthy === 0 ? '-' : formatClock(Math.round(report.totalTicks / healthy))} · ${healthy === 0 ? '-' : (report.stars / healthy).toFixed(2)} stars a match`,
    `card        win rate      decided  plays/deck`,
  ];
  const ranked = [...report.cards].sort((a, b) => (winRate(b)?.rate ?? 0) - (winRate(a)?.rate ?? 0));
  for (const record of ranked) {
    const fared = winRate(record);
    const rate = fared === null ? '   -  ' : `${(fared.rate * 100).toFixed(1).padStart(5)}% ±${(fared.error * 100).toFixed(1)}`;
    const perDeck = record.decks === 0 ? '-' : (record.plays / record.decks).toFixed(1);
    const flag = isOutlier(record) ? (fared !== null && fared.rate > 0.5 ? '  OUTLIER (strong)' : '  OUTLIER (weak)') : '';
    lines.push(`${record.card.padEnd(12)}${rate.padEnd(14)}${String(record.wins + record.losses).padStart(7)}  ${perDeck.padStart(10)}${flag}`);
  }
  const outliers = report.cards.filter(isOutlier).map((record) => record.card);
  lines.push(`outliers    ${outliers.length === 0 ? 'none' : outliers.join(', ')}`);
  for (const { seed, message } of report.failures) {
    lines.push(`\nfailure at seed ${String(seed)}:\n  ${message.replaceAll('\n', '\n  ')}`);
  }
  return lines.join('\n');
}
