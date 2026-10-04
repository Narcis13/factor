import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playBotMatch } from '@factor/bot';
import { BOT_TUNING, DECK_CARD_IDS, MATCH_RULES } from '@factor/content';
import { expect, test } from 'vitest';
import { balance, balanceDecks, describeBalance, isOutlier, OUTLIER_ERRORS, OUTLIER_POINTS, winRate } from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

const FROM = 30;
const MATCHES = 4;
const report = balance(FROM, MATCHES);

test('each seed deals two decks of eight different deck cards, the same every time', () => {
  for (let seed = 0; seed < 20; seed++) {
    const decks = balanceDecks(seed);
    for (const deck of decks) {
      expect(deck).toHaveLength(MATCH_RULES.deckSize);
      expect(new Set(deck).size).toBe(MATCH_RULES.deckSize);
      for (const card of deck) {
        expect(DECK_CARD_IDS).toContain(card);
      }
    }
    expect(balanceDecks(seed)).toEqual(decks);
  }
  expect(balanceDecks(1)).not.toEqual(balanceDecks(2));
});

test('a card’s record counts the decks it was in and the matches they decided, a card in both decks for neither', () => {
  const matches = Array.from({ length: MATCHES }, (_, i) => {
    const decks: [string[], string[]] = balanceDecks(FROM + i);
    return { decks, state: playBotMatch(FROM + i, decks, BOT_TUNING, ['heuristic', 'heuristic']).state };
  });
  expect(report.failures).toEqual([]);
  expect(report.wins[0] + report.wins[1] + report.draws).toBe(MATCHES);
  for (const record of report.cards) {
    const holding = matches.flatMap(({ decks, state }) => [0, 1].filter((side) => decks[side]?.includes(record.card)).map((side) => ({ side, decks, state })));
    expect(record.decks).toBe(holding.length);
    const counted = holding.filter(({ side, decks, state }) => state.result?.winner !== null && !decks[side === 0 ? 1 : 0].includes(record.card));
    expect(record.wins).toBe(counted.filter(({ side, state }) => state.result?.winner === side).length);
    expect(record.wins + record.losses).toBe(counted.length);
  }
  expect(report.cards.map((record) => record.card)).toEqual(DECK_CARD_IDS);
  expect(report.cards.reduce((sum, record) => sum + record.plays, 0)).toBeGreaterThan(MATCHES * 20);
});

test('a card is flagged only far from even and clear of the noise', () => {
  expect([OUTLIER_POINTS, OUTLIER_ERRORS]).toEqual([6, 2]);
  expect(winRate({ wins: 0, losses: 0 })).toBeNull();
  expect(winRate({ wins: 3, losses: 1 })?.rate).toBe(0.75);
  // 60% over 1000 decided: 10 points off, well clear of a 1.5-point error.
  expect(isOutlier({ wins: 600, losses: 400 })).toBe(true);
  expect(isOutlier({ wins: 400, losses: 600 })).toBe(true);
  // 54%: within 6 points.
  expect(isOutlier({ wins: 540, losses: 460 })).toBe(false);
  // 70% over 10: far off, but the error (14.5 points) swamps it.
  expect(isOutlier({ wins: 7, losses: 3 })).toBe(false);
});

test('the report lists every card best first, marks outliers, and repeats', () => {
  const text = describeBalance(report);
  expect(text).toContain(`seeds       30..33 (4 matches, 4 healthy, heuristic mirror on random decks)`);
  expect(text.split('\n').filter((line) => DECK_CARD_IDS.some((card) => line.startsWith(`${card} `)))).toHaveLength(16);
  expect(text).toMatch(/^outliers {4}/m);
  expect(balance(FROM, MATCHES)).toEqual(report);
  const flagged = describeBalance({ ...report, cards: report.cards.map((record, i) => (i === 0 ? { ...record, wins: 900, losses: 100 } : record)) });
  expect(flagged).toMatch(new RegExp(`^${String(DECK_CARD_IDS[0])} .*OUTLIER \\(strong\\)$`, 'm'));
});

test('balance prints its report and exits 0', () => {
  const { status, stdout } = spawnSync(process.execPath, [cli, 'balance', '--matches', '2', '--from', '30'], { encoding: 'utf8' });
  expect(status).toBe(0);
  expect(stdout).toContain(describeBalance(balance(30, 2)));
  expect(stdout).toMatch(/^took {8}\d+ s$/m);
});
